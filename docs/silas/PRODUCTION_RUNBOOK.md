# Private Silasnet Homepage production runbook

Preparation only, reviewed 2026-10-10. None of these deployment commands has been executed. Read the [release gate](PRODUCTION_SECURITY_AUDIT.md) before proceeding.

## Architecture and non-negotiable boundaries

`Internet → Cloudflare Access → existing Cloudflare Tunnel → http://127.0.0.1:3000 → mandatory Homepage sessions → dashboard`.

Private ingress remains `https://debian-docker.tail277de6.ts.net` through Tailscale Serve to the same loopback service. Public ingress is `https://home.silasnet.win`. They use separate host-only browser cookies and the same persistent account store. Homepage logout invalidates its session; the Cloudflare Access session remains separate. Public flow: Access login, Homepage login, dashboard, Homepage logout, Homepage login again while Access remains valid.

Only Homepage may be recreated. Do not run project-wide `down`, delete volumes, restart cloudflared/Tailscale or unrelated containers, replace tunnel configuration wholesale, or change `send.silasnet.win` or other DNS/routes. Cloudflare changes below are future operator steps, not performed by this audit.

The tunnel connector must run in the Debian host network namespace (host daemon or an already host-networked connector) for `127.0.0.1:3000` to reach Homepage. A bridge-networked cloudflared container's localhost is its own container. **Stop if the existing connector cannot reach host loopback.** Resolve that architecture separately without widening Homepage's port or changing unrelated services. No new connector or network migration is authorized by this runbook.

## Required production environment

Edit `/srv/docker/silas-homepage/.env` locally with a private editor. Do not print it or use `docker inspect` without a narrowly selected output field. Use these literal comma-separated values, with no spaces required and no trailing slash on origins:

```dotenv
HOMEPAGE_ALLOWED_HOSTS=home.silasnet.win,debian-docker.tail277de6.ts.net,localhost:3000,127.0.0.1:3000
HOMEPAGE_AUTH_ORIGINS=https://home.silasnet.win,https://debian-docker.tail277de6.ts.net
HOMEPAGE_AUTH_DB=/app/data/auth/auth.sqlite
TZ=Europe/Berlin
# Select a unique local release image tag after recording the revision.
HOMEPAGE_IMAGE=silas-homepage:REVIEWED_RELEASE_TAG
# Existing config path: preserve the current correct local path.
HOMEPAGE_CONFIG_PATH=./config
```

For a genuinely empty account store only, set `HOMEPAGE_AUTH_BOOTSTRAP_USERNAME` and `HOMEPAGE_AUTH_BOOTSTRAP_PASSWORD` privately. Password: unique random value, at least 14 characters, at most 1024 bytes. No actual username/password belongs in the runbook. Quote secret `.env` values with single quotes when they contain `$`, `#` or spaces; handle literal quotes using Compose's documented syntax. Keep existing integration variables unchanged. Neither a session secret nor an auth-disable setting is needed.

Compose explicitly pins `NODE_ENV=production`, `PORT=3000`, internal `HOSTNAME=0.0.0.0`, `HOMEPAGE_AUTH_DB=/app/data/auth/auth.sqlite`, and host publish `127.0.0.1:3000:3000`. `.env` cannot select development cookies or widen that publish binding. The internal container listener is necessary for Docker forwarding; it is not a public host listener. Existing Compose overrides can still change configuration: inspect the effective invocation and actual published binding.

Auth volume: Compose key `homepage-auth`, normally Docker name `silas-homepage_homepage-auth` because the project name is fixed. Preserve the existing volume/project identity. Never mount a development/test database, the repository's `artifacts`, or `.next` from this Windows workspace as production storage.

## A. Back up configuration and record rollback identity

On Debian, in a private administrator shell:

```bash
set -euo pipefail
umask 077
cd /srv/docker/silas-homepage
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR="/srv/docker/backups/silas-homepage/$STAMP"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
git rev-parse HEAD > "$BACKUP_DIR/source-revision.txt"
git branch --show-current > "$BACKUP_DIR/source-branch.txt"
git diff --binary > "$BACKUP_DIR/local-source.patch"
cp -a .env compose.yaml "$BACKUP_DIR/"
tar -C . -czf "$BACKUP_DIR/config.tar.gz" config
CID=$(docker compose ps -q homepage)
test -n "$CID"
OLD_IMAGE=$(docker inspect --format '{{.Image}}' "$CID")
printf '%s\n' "$OLD_IMAGE" > "$BACKUP_DIR/image-id.txt"
docker image tag "$OLD_IMAGE" "silas-homepage:rollback-$STAMP"
docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/data/auth"}}{{.Name}}{{end}}{{end}}' "$CID" > "$BACKUP_DIR/auth-volume.txt"
```

If configuration lives outside `./config`, back up the actual current bind source instead. Do not print the saved `.env`/patch or upload the backup: they can contain integration secrets. Record the current Compose file/override arguments privately and use the same project identity throughout. Stop if the server has unexplained tracked changes; preserve them before updating. Do not force-reset a dirty checkout.

## B. Back up existing authentication before source update

If the existing image already includes `scripts/auth-backup.cjs`, use:

```bash
docker compose exec -T homepage node scripts/auth-backup.cjs backup /tmp/homepage-auth-before.sqlite
docker compose cp homepage:/tmp/homepage-auth-before.sqlite "$BACKUP_DIR/auth.sqlite"
chmod 600 "$BACKUP_DIR/auth.sqlite"
```

For the preceding authentication image, which lacks that script, Node >=22.16 provides the same online backup API directly. This checks for an existing database without creating one, uses private file permissions, and does not log any rows or secrets:

```bash
if docker compose exec -T homepage node <<'NODE'
const fs = require('node:fs');
const { DatabaseSync, backup } = require('node:sqlite');
const source = process.env.HOMEPAGE_AUTH_DB || '/app/data/auth/auth.sqlite';
if (!fs.existsSync(source)) process.exit(2);
const db = new DatabaseSync(source, { readOnly: true });
if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') process.exit(1);
const target = '/tmp/homepage-auth-before.sqlite';
fs.closeSync(fs.openSync(target, 'wx', 0o600));
backup(db, target).then(() => {
  const saved = new DatabaseSync(target);
  saved.exec('PRAGMA journal_mode=DELETE');
  if (saved.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Backup integrity failure');
  saved.close(); db.close();
}).catch(() => { db.close(); process.exitCode = 1; });
NODE
then
  docker compose cp homepage:/tmp/homepage-auth-before.sqlite "$BACKUP_DIR/auth.sqlite"
  chmod 600 "$BACKUP_DIR/auth.sqlite"
else
  backup_status=$?
  if [ "$backup_status" -ne 2 ]; then
    echo 'Auth backup failed; stop and investigate locally.' >&2
    exit 1
  fi
  printf '%s\n' 'No existing auth database.' > "$BACKUP_DIR/no-auth-database.txt"
fi
```

If that old Node/image cannot use the backup API, stop **only Homepage**, verify it is stopped, then `docker cp "$CID:/app/data/auth/." "$BACKUP_DIR/auth-stopped/"` to save the entire stopped store, including any WAL/SHM. Never copy a live SQLite file. Preserve directory/file permissions and record that this is a stopped-store backup. If backup fails, do not proceed. A missing database is acceptable only when confirmed as a genuinely first deployment of auth.

## C. Update source safely

The historical branch is `feat/silas-homeserver-dashboard`; verify the actual server branch. This audit left all work uncommitted and unpushed, so **do not assume the remote already contains it**. A later separately authorized release must provide an immutable reviewed revision containing these changes.

```bash
git status --short
# Stop if tracked local modifications need reconciliation.
git fetch origin
# Set this to the supplied reviewed revision, not an invented branch/head.
RELEASE_REV='REVIEWED_FULL_COMMIT_SHA'
git show --no-patch --format=fuller "$RELEASE_REV"
git switch --detach "$RELEASE_REV"
```

If policy requires staying on the historical branch, fast-forward that verified clean branch to the same reviewed revision. Never blindly `git pull` over local configuration changes. Check that the release includes the auth guards, production matcher, Compose hardening, backup CLI and exact SilasSend asset.

## D–F. Configure, verify persistence, build

Privately edit `.env` with the exact hosts/origins above and an image tag such as `silas-homepage:auth-<short-reviewed-revision>`. Set bootstrap values only if B confirmed zero accounts. Protect `.env` with `chmod 600 .env`. Never export its values into build arguments, print full effective Compose configuration, or put passwords in shell history. Keep checked-in/build-context YAML as environment placeholders: actual API credentials must stay in the ignored runtime `.env` or an excluded external bind directory. Privately inspect the effective server build context before building; do not bake a locally customized YAML containing inline secrets into the image. This audit verified the local templates, not the remote server's private configuration.

```bash
docker compose config --quiet
docker compose build homepage
```

Inspect the Dockerfile's non-root `node` runtime and storage directory, and verify any existing auth volume is the same one recorded in A. A fresh named volume inherits `/app/data/auth` ownership/mode from the image. Existing volumes are not automatically repaired: if ownership is wrong, stop and arrange a narrowly scoped permission repair for **that verified auth volume only**. Do not recursively chown an unverified host path. Do not use `down -v`.

### Container preflight before public exposure

After build, an operator may use `docker compose run --rm --no-deps --entrypoint node homepage -e 'const fs=require("node:fs");if(process.getuid()===0)process.exit(1);fs.accessSync("/app/data/auth",fs.constants.W_OK);if(!fs.existsSync(".next/build-manifest.json"))process.exit(1);console.log("Non-root storage and manifest preflight passed")'`. It creates no accounts. Test Linux Argon2 loading with `docker compose run --rm --no-deps --entrypoint node homepage -e 'require("@node-rs/argon2"); console.log("Native Argon2 loaded")'`. These required checks have not been run in this Windows audit environment.

## G–I. Recreate only Homepage and check loopback/privacy

```bash
docker compose up -d --no-deps --force-recreate homepage
CID=$(docker compose ps -q homepage)
docker inspect --format '{{.Image}}' "$CID" > "$BACKUP_DIR/release-image-id.txt"
docker inspect --format '{{json .HostConfig.PortBindings}}' "$CID"
docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/data/auth"}}{{.Name}} {{.Destination}}{{end}}{{end}}' "$CID"
docker inspect --format '{{.State.Health.Status}}' "$CID"
curl --fail --silent --show-error http://127.0.0.1:3000/api/healthcheck
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' http://127.0.0.1:3000/
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' http://127.0.0.1:3000/api/services
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' -X POST http://127.0.0.1:3000/api/services/proxy
```

Expect health `up`, root `307`, API GET/POST `401`. The root Location uses HTTPS intentionally; don't follow it on loopback HTTP. Published `3000/tcp` must have HostIp **127.0.0.1**, HostPort **3000**, no IPv6/public/LAN binding. Verify `ss -ltn`/Docker binding and a failed direct TCP connection from a separate LAN host; Docker may implement forwarding without a userspace listener. Do not expose a test public port.

Additional direct checks: protected `/api/config/custom.css`, `/api/widgets/resources`, `/api/docker/statuses`, `/api/proxmox/stats/test`, `/api/silas/hosts`, `/site.webmanifest` and dashboard JS chunks must be denied without a session. API GET/HEAD/POST responses must contain no inventory. `Host: evil.test` must produce `400`, even with an allowlisted X-Forwarded-Host. Required security headers must appear on login and denials. No secret values need to be displayed for these checks.

## J–N. Bootstrap privately, remove password, verify persistence and Tailscale

Read `tailscale serve status` locally without resetting or replacing existing service configuration. Verify its existing HTTPS root route points to `http://127.0.0.1:3000`. If no such route exists or an unrelated application already owns that path/port, stop and plan the isolated ingress change; do not overwrite it. Never use Tailscale Funnel.

Visit `https://debian-docker.tail277de6.ts.net` from a trusted tailnet device. It must redirect to Homepage login with no inventory. Sign in using the private bootstrap values. Provisioning happens only when accounts are absent, on the first login attempt; correct login must then show the dashboard. Inspect the cookie attributes in the browser without copying its value: `__Host-silas-session`, Secure, HttpOnly, SameSite=Lax, Path=/, no Domain. Log out, verify login and direct private API denial.

Remove **both** `HOMEPAGE_AUTH_BOOTSTRAP_PASSWORD` and `HOMEPAGE_AUTH_BOOTSTRAP_USERNAME` from `.env`. Merely editing `.env` or `docker compose restart` leaves the old environment in the running container. Recreate **only Homepage** to discard it:

```bash
docker compose up -d --no-deps --force-recreate homepage
```

Sign in again with the same account and confirm it survived recreation. Verify the same named volume and health/binding again. An existing account ignores bootstrap values and is never reset by restart. Do not delete the volume to reset an account.

Local password reset after deployment: `docker compose exec homepage node scripts/auth-admin.cjs reset-password USERNAME` (interactive hidden input). It revokes all account sessions. The username is not a password; never put the new password in argv. For disable/enable, use the same CLI actions.

## O–P. Prepare an isolated Tunnel route and Access policy; activate safely

Only after all local/Tailscale gates pass, prepare this **single additive** hostname entry in the existing tunnel:

```yaml
# Fragment only: insert before the existing catch-all, preserve every other route.
- hostname: home.silasnet.win
  service: http://127.0.0.1:3000
  originRequest:
    httpHostHeader: home.silasnet.win
```

The fixed HTTP Host Header is route-specific and matches the browser's Origin. It does not grant authority to forwarded headers. No port other than 3000 is involved; no change to `send.silasnet.win`. If the tunnel is dashboard-managed, create only the corresponding published-application route; do not replace/recreate the tunnel. If file-managed, validate the complete existing config privately and preserve its catch-all and credentials. Do not restart an existing connector shared by other services as part of this runbook; if live route updates are unsupported, arrange a separately authorized change window.

**Do not activate public routing/DNS before Access exists.** The requested route is prepared first, then protected, then activated. Create a Cloudflare Access self-hosted application for exactly `home.silasnet.win`, all paths. Allow only the owner's exact identity/email entered privately in Cloudflare, not a whole email domain or Everyone. Require MFA through the configured identity provider/Access where available; choose a short sensible Access session such as 12 hours. Leave default deny for everyone else. No Bypass, public service-token policy, wildcard domain or unprotected path. Homepage authentication remains enabled and does not interpret Access identity headers as login authority.

Keep `/api/healthcheck` behind Access too. Docker and host-local checks need no Access bypass. If an external monitor later needs access, use a separately reviewed authenticated Access service-token monitor or document the information/availability tradeoff of a minimal route exception; do not silently exempt the dashboard or health endpoint now.

Verify Access policy while public routing is inactive. Then activate only the Homepage route/DNS record. Where the existing connector supports route-specific Access JWT validation, configure the application's exact audience/team in that route's `originRequest.access` using local Cloudflare values; do not bake connector credentials into Homepage. This is extra defense, not a replacement for either Access or Homepage sessions.

For only `home.silasnet.win`, plan cache bypass for **all paths**, disable script rewriting such as Rocket Loader, and retain origin security/cache headers. Do not apply a zone-wide change affecting other services. CSP permits same-origin scripts, API connections and fonts; its only external image origin is `https://cdn.jsdelivr.net`. Dashboard icons currently use local assets. Do not globally loosen CSP to allow injected edge scripts.

### HSTS

Enforce at Cloudflare using a hostname-specific response-header rule for `home.silasnet.win`: begin with `Strict-Transport-Security: max-age=86400`, verify HTTPS-only behavior and recovery, then increase to `max-age=15552000`. No `includeSubDomains`, no preload and no zone-wide rule affecting other Silasnet services. Keep HTTP-to-HTTPS handling at that hostname's edge. The app never infers TLS from forwarded headers and emits no HSTS on local HTTP health traffic. Do not enable parent-domain includeSubDomains until every subdomain has been audited. Browser HSTS can outlive route rollback.

## Q. Final external gates

In a fresh browser profile outside the tailnet, visit `https://home.silasnet.win`. Expect Access authentication first, then Homepage login, then dashboard after the second login. A non-owner must be denied at Access. Completing Access alone must not expose Homepage's inventory/API data. Repeat private API GET/HEAD/POST, invalid cookie and host/origin checks with no Homepage session after Access; status should be `401`/denied. Test logout and replay of the revoked session locally without recording cookie values in tickets/logs.

Confirm no cached private response is delivered to another browser, CSP has no eval/broad origins, app cookies are host-only, logout expires the same cookie and Tailscale still works. Homepage logout intentionally does not sign out Cloudflare. Verify unrelated service health/routes remain unchanged. Do not declare production released until these gates and a real container recreate/backup/restore drill pass.

## Ongoing safe SQLite backups and restore drill

Before releases/password changes, and periodically for this tiny store:

```bash
# Choose a new unique protected backup directory as in A.
docker compose exec -T homepage node scripts/auth-backup.cjs backup /tmp/homepage-auth-backup.sqlite
docker compose cp homepage:/tmp/homepage-auth-backup.sqlite "$BACKUP_DIR/auth.sqlite"
chmod 600 "$BACKUP_DIR/auth.sqlite"
```

Choose a unique container filename per backup (for example `/tmp/auth-$STAMP.sqlite`) or recreate the container between uses: the CLI refuses to overwrite. Store backups outside the source tree/build context with directory 0700/file 0600 and protected or encrypted off-host storage if used. Backup includes password hashes/session records and is sensitive. The CLI uses the [Node SQLite online backup API](https://nodejs.org/download/release/latest-jod/docs/api/sqlite.html#sqlitebackupsourceDb-destination-options), which wraps SQLite's supported consistent [backup mechanism](https://www.sqlite.org/backup.html); it checks integrity and doesn't blindly copy a live main file.

First test restore into an **isolated scratch named volume**, using the reviewed image, a read-only mount of the backup directory, no published ports, no network, and no production secrets. Verify integrity, account enabled state and zero restored sessions. Delete no production data. Production restore only when required:

```bash
# Save a fresh online backup first; then stop only Homepage.
docker compose stop homepage
# BACKUP_DIR must be an absolute protected directory containing the verified auth.sqlite.
docker compose run --rm --no-deps --volume "$BACKUP_DIR:/backup:ro" \
  --entrypoint node homepage scripts/auth-backup.cjs restore /backup/auth.sqlite --homepage-stopped
docker compose up -d --no-deps homepage
```

This uses the same production auth volume, validates the source and invalidates all restored sessions; old logout sessions cannot return. Read-only backup access must work for UID 1000 (`node`) without making files world-readable: use matching ownership or a narrowly scoped ACL. Do not change the volume name. The `--homepage-stopped` flag requires the operator to have stopped every process using that production store. Restore attempts from a running server are unsafe and outside this procedure. A stopped-store fallback backup can be restored only with Homepage stopped, the verified existing volume path, and the whole saved directory including WAL/SHM; prefer the verified SQLite snapshot/CLI when available.

## Rollback

1. If public safety is uncertain, disable/remove **only** the `home.silasnet.win` published route/DNS association. Keep the Access deny/allow protection in place until the route is confirmed inactive. Never delete the tunnel, reset ingress, or touch `send.silasnet.win`/other routes. This is a future operator action.
2. Stop only Homepage. Preserve the current failed-release source/config/auth backup as above. Do not discard auth data reflexively.
3. In a clean checkout, `git switch --detach "$(cat "$BACKUP_DIR/source-revision.txt")"`. Retain the secure loopback publish and production environment settings. Reconcile saved configuration privately; do not overwrite current integration changes or automatically reintroduce bootstrap passwords.
4. Set `HOMEPAGE_IMAGE` privately to the preserved `silas-homepage:rollback-<recorded-STAMP>` tag. Recreate only Homepage using `docker compose up -d --no-deps --no-build --force-recreate homepage`. Verify loopback publish, cookies and anonymous denial again. **Do not run an old image lacking authentication.** If the previous image predates auth, keep Homepage stopped and the public route inactive until a secure image is available.
5. Restore auth only for actual corruption/incompatible schema, using the reviewed backup/restore CLI with Homepage stopped. If the old image lacks the new CLI, temporarily prefix the restore command with `HOMEPAGE_IMAGE="$(cat "$BACKUP_DIR/release-image-id.txt")"` to use the reviewed image just for the one-off restore, then start the preserved safe rollback image. An image/source rollback does not normally require reverting this unchanged auth schema. Restore retains accounts but deliberately invalidates sessions. Remove bootstrap values and verify account persistence again.
6. Re-enable only the Homepage route after Access, Tailscale, direct denial and header checks pass. HSTS remains cached in browsers for its max-age, so retain valid HTTPS even during rollback.

## Evidence required to close the release gate

Linux Docker build/native module load, non-root volume permissions, actual bind/health, account surviving recreate without bootstrap variables, consistent backup/isolated restore, installed Tailscale Host behavior, host-local tunnel reachability, exact owner Access policy and final external two-layer flow. None of these live-server/Cloudflare actions was performed during preparation.

Primary references: [Cloudflare self-hosted Access setup](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/), [Tunnel origin Host/Access parameters](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/origin-parameters/), [Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve), [Tailscale HTTP proxy Host preservation](https://github.com/tailscale/tailscale/blob/main/ipn/ipnlocal/serve.go), [Cloudflare HSTS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/http-strict-transport-security/).
