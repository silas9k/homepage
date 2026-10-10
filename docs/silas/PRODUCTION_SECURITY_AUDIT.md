# Final production security audit — 2026-10-10

## Release gate: NOT READY FOR DEPLOYMENT

The application source audit and local production-mode tests pass after the fixes below. The release gate remains open because this Windows environment has no Docker CLI/daemon: a real Linux image build, native Argon2 load, non-root named-volume permissions, account persistence across container recreation and a container backup/restore drill have not been verified. The Debian host's existing cloudflared network namespace/reachability and installed Tailscale Serve behavior are also unverified. A bridge-networked connector cannot reach host loopback at the required URL.

These are deployment preflight blockers, not permission to expose the service. Close them using the [production runbook](PRODUCTION_RUNBOOK.md) before activating any public route. This working tree is intentionally uncommitted/unpushed; a later separately authorized release must supply the reviewed immutable source revision. Cloudflare Access/Tunnel configuration and final external checks remain future operator steps, not actions performed in this audit.

## Findings fixed

1. **Anonymous dashboard bundle exposure.** The original `/:path*` matcher was transformed by Next's automatic i18n handling into a pattern excluding `/_next/static`. Actual production HTTP requests returned dashboard bundles containing private host labels. The matcher now explicitly uses `locale: false`, covering raw framework/static paths. Production public assets are restricted to the build manifest's login/shared framework/error dependencies, build metadata and fonts referenced by the login stylesheet. Dashboard bundles, arbitrary chunks, source maps and framework image/data paths require a session. Missing manifests fail closed. The expanded E2E test first demonstrated the leak, then verified denial after fixing the matcher.
2. **Username truncation and first-use timing.** Login silently shortened overlong usernames to 64 characters. It now rejects invalid/empty/overlong usernames and password inputs generically; a regression test verifies a long input cannot become a valid 64-character account. Known/unknown accounts also wait for the same one-time dummy-hash initialization, avoiding an account-existence-dependent extra initial hash delay. Hash verification and persistent budgets still apply; network timing is not guaranteed identical.
3. **Production settings could drift.** Compose allowed `.env` to widen the host publish address and override the image's production mode. Compose now fixes `127.0.0.1:3000:3000`, `NODE_ENV=production`, internal `PORT=3000`/`HOSTNAME=0.0.0.0`, and exact public/private host/origin defaults. Existing Compose overrides still need inspection on Debian. Older README/security guidance suggesting direct LAN/Tailscale binding or production HTTP login was corrected.
4. **Broad image CSP.** Audited card assets and icon code: current cards use local icons; the supported icon CDN is `https://cdn.jsdelivr.net`. Removed unrestricted `https:` image sources while retaining self/data/blob and that exact CDN. Scripts, fonts and API connections remain same-origin; production has no unsafe-eval.
5. **No supported backup procedure.** Added a tiny local SQLite backup/restore CLI using Node's native online backup API, integrity/schema checks, exclusive 0600 backup creation and portable DELETE-journal snapshots. Restore requires an explicit stopped-Homepage assertion and invalidates restored sessions/throttle windows, preventing logout replay after restoring an old backup. No database schema change or new service/framework was added. Node minimum is now 22.16, when the native backup API became available.
6. **Test/release hygiene.** Added E2E teardown that disables only the isolated fixture account, revokes sessions, and blanks generated password/private-key contents without deleting retained databases. Excluded public dependency fixture keys in `ssh2/test` and `xmlrpc/tmp` from standalone tracing. Stale copies in ignored local standalone output were removed; current traces and inspected standalone output contain no auth databases, runtime credential files or PEM/private-key files.
7. **Production dependency advisories.** `pnpm audit --prod` initially found two high-severity transitive advisories: [source-map-js indexed-map denial of service](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) and [sharp/librsvg vulnerability](https://github.com/advisories/GHSA-wq5f-xc86-pv6w). Updated only those package families within existing supported ranges: source-map-js 1.2.1 → 1.2.2 and sharp 0.35.4 → 0.35.5 (including native image packages). The subsequent production audit reports zero known vulnerabilities; frozen-lockfile installation succeeds. No dashboard feature/design change.

## Requested audit report

| # | Area | Result / evidence |
| --- | --- | --- |
| 1 | Release | **NOT READY FOR DEPLOYMENT** until the Linux/container/ingress preflight blockers above are closed. No source-level auth bypass remains in the audited tests. |
| 2 | Issues | Seven findings/preparation gaps fixed above; no dashboard/card/layout changes. |
| 3 | Routes/APIs | Node Proxy on raw paths, independent `withAuth` on every sensitive API, independent `requirePageSession` before config-reading SSR. Dashboard uses dynamic SSR. Enumerated every API route with anonymous GET/HEAD/POST and query parameters; all sensitive routes returned 401, empty HEAD body, or an appropriate page redirect. Beszel, Nextcloud, Portainer, Tailscale and Cloudflare data flow through guarded widget/service proxies; Docker, Proxmox, resources, config, inventory and MCP are guarded directly. Unknown `/api/silas/*` also denied. |
| 4 | Hosts/origins | Literal comma-separated values below; actual production HTTP login tested with both exact hostname/Origin pairs. Wildcard Host configuration fails closed; Origin must be canonical, allowlisted, HTTPS in production, and match the actual Host. No wildcard/subdomain/null/missing Origin acceptance. |
| 5 | Sessions/cookies | Argon2id accounts; 256-bit random session/CSRF IDs, only SHA-256 session-ID digests persisted. Enabled-account check on each lookup, absolute 12-hour expiry, login rotation, logout/password reset invalidation. Production cookie `__Host-silas-session; HttpOnly; Secure; SameSite=Lax; Path=/`, no Domain. Logout clears that exact production cookie with matching attributes. Browser cookie is host-only; unrelated subdomains receive none. Modified, random, malformed, expired, fixed and revoked IDs are rejected. |
| 6 | CSRF | Same-origin JSON POST login. All authenticated unsafe methods require exact Origin plus a session-bound 64-hex `x-silas-csrf`, compared in constant time. Missing/wrong token, missing/null/foreign Origin and cross-site fetch requests fail. Logout/refresh POST only. |
| 7 | Throttling | Atomic SQLite budgets before verification: five attempts/normalized username/15 minutes plus 20 total/minute. Success clears the username budget, not the global work budget. Unknown/disabled/wrong credentials use the same generic message and real verification. Tested 429/Retry-After, spoofed-IP resistance, automatic-window expiry and live HTTP recovery using only the isolated fixture's clock state. No permanent lockout. |
| 8 | Proxy headers | Auth ignores X-Forwarded-Host/Proto/For, CF-Connecting-IP and Access identity headers. Spoofed forwarded values cannot grant access, alter Secure cookies, evade budgets or select allowed origins. Invalid actual Host returns 400. Expected HTTPS-to-loopback forwarding works for both hostnames. |
| 9 | SQLite | `/app/data/auth/auth.sqlite` in persistent Compose `homepage-auth`, normally `silas-homepage_homepage-auth`; image USER node, directory 0700, main DB 0600, WAL/busy timeout/foreign keys. Store is outside public and immutable image filesystem. Cross-process persistence tested locally. Actual Linux volume initialization/recreate remains unverified and is a release blocker. |
| 10 | Temporary DBs | Exact retained paths below. Every inspected fixture account is disabled, sessions/throttles revoked, integrity OK. Main files/sidecars are ignored and isolated under Docker-excluded `artifacts/`; none appear in standalone output or production mounts. No retained database was deleted. |
| 11 | Bootstrap | Environment-only first account, only when account count is zero; atomic insert prevents overwrite/race. Never logged/client serialized/image-baked. Existing account survives process restart and ignores replacement bootstrap values in tests. Remove both bootstrap variables after initial private login and **recreate only Homepage**, because restart alone retains old container environment. |
| 12 | Access | Exact `home.silasnet.win` self-hosted app, all paths, owner identity entered privately, MFA where available, default deny, no Everyone/domain-wide/BYPASS rule. Health stays behind Access. Homepage auth remains mandatory; logout sessions remain separate. Plan only. |
| 13 | Tunnel | Add only `home.silasnet.win → http://127.0.0.1:3000`, route-specific Host `home.silasnet.win`, preserve all existing routes/catch-all and `send.silasnet.win`. Prepare route, configure/verify Access, then activate public route. Host-local connector reachability must be confirmed first. Plan only. |
| 14 | Tailscale | Exact private hostname/origin configured and tested through the production HTTPS test proxy. Current upstream Tailscale TCP HTTP proxy preserves original Host; installed server version and existing Serve routing must be checked before deployment. No Funnel, direct bind widening or Serve reset. |
| 15 | Headers | Per-response 128-bit script nonce, CSP, nosniff, no-referrer, restrictive Permissions-Policy, DENY/frame-ancestors none, private/no-store. No production script eval or arbitrary HTTPS image origin. Styles retain unsafe-inline because Homepage uses inline styles. HSTS planned at the HTTPS edge for only this hostname; no includeSubDomains/preload or proxy-derived protocol trust. |
| 16 | Secrets | Inspected git status, unstaged/staged diffs, 1,586 text source/docs/config/test files in the initial scan, Compose/Docker/example environment, auth code/logging and artifacts. No production credential literals found; no staged diff; no tracked real env/database/key files. One long-assignment scanner match was OpenWRT's public all-zero unauthenticated RPC sentinel, not a secret. Third-party public test-key artifacts were excluded as described above. No `.env` exists in this local checkout. Actual Debian secrets remain uninspected and must stay private. |
| 17 | SilasSend | SHA-256/byte equality with `C:\Users\silas\Documents\dev\silassend\web\public\favicon.svg`; `public/silas/icons/silassend.svg` and config/services.yaml reference retained exactly. Authenticated rendered screenshot shows the correct green brandmark. No edit to the icon or SilasSend project. |
| 18 | Validation | Full lint passes with the complete auth/icon working tree; typecheck passes (existing auth JS scope); 578 test files / 1,816 unit/integration tests pass; 46 dedicated security tests pass; 23 production-mode Playwright tests pass; production build passes; unstaged/staged `git diff --check` passes; frozen-lockfile install passes; production dependency audit has zero known vulnerabilities after patching. Detailed scope below. Docker image build/run is not claimed. |
| 19 | Performance | Windows Node 24.18 harness: baseline 54 MiB RSS, store open 56 MiB, idle after hashing 76 MiB, hash 11 ms. Approximately 2 MiB open-store overhead / 22 MiB post-hash increase, no idle hashing/external service. This is a local estimate, not Debian production memory. |
| 20 | Changed files | Audit-specific list and full retained working-tree manifest below. Existing auth-pass and SilasSend changes remain uncommitted. |
| 21 | Environment | Exact values below; no new secret/session signing key/auth-disable flag. Existing first-run bootstrap variables are temporary. Node mode/storage/binding pinned in Compose. |
| 22 | Runbook | `docs/silas/PRODUCTION_RUNBOOK.md`: configuration/auth backups, reviewed revision update, private env edit, volume/build, Homepage-only recreate, health/anonymous denial, bootstrap/removal/persistence, Tailscale, isolated Tunnel/Access staging, external QA. |
| 23 | Rollback | Preserve old source/image/config/auth snapshot, disable only Homepage's public route if needed, stop/recreate only Homepage using a known authenticated image and loopback bind, restore verified SQLite only when needed, revoke restored sessions. Never roll back to a publicly exposed image lacking auth or touch other routes/containers. Full commands in runbook. |
| 24 | Risks | Linux/native/volume/ingress gates outstanding. Shared global throttle can temporarily deny the owner; Access limits public attackers. All accounts are trusted owners (no account-scoped inventory); no web registration/reset/MFA inside Homepage. Local root/Docker administrators can read the store. Build/login dependency manifests must remain available. Keep Node/Next/native packages patched and cache bypass applied at the future edge. |
| 25 | Actions | No commit, push, deployment, production data deletion, production container restart, Cloudflare/DNS change, Tailscale change or SilasSend change. Only local source/docs/tests and isolated generated validation artifacts were touched. |

## Exact production settings

```dotenv
HOMEPAGE_ALLOWED_HOSTS=home.silasnet.win,debian-docker.tail277de6.ts.net,localhost:3000,127.0.0.1:3000
HOMEPAGE_AUTH_ORIGINS=https://home.silasnet.win,https://debian-docker.tail277de6.ts.net
HOMEPAGE_AUTH_DB=/app/data/auth/auth.sqlite
```

`HOMEPAGE_AUTH_BOOTSTRAP_USERNAME` / `HOMEPAGE_AUTH_BOOTSTRAP_PASSWORD`: only first empty store, private values, remove after first login and recreate Homepage. Existing optional `HOMEPAGE_IMAGE`, `HOMEPAGE_CONFIG_PATH`, `HOMEPAGE_ENV_FILE`, `TZ` and integration variables remain operator configuration. Compose forces `NODE_ENV=production`, `PORT=3000`, internal `HOSTNAME=0.0.0.0`, `LOG_TARGETS=stdout`, `NEXT_TELEMETRY_DISABLED=1`. Removed unused HOMEPAGE_BIND/HOMEPAGE_PORT example settings; they no longer control production publish binding.

## Validation scope and source-level review

- Re-read actual auth documentation, store, HTTP guards, login/logout/session routes, Proxy, SSR entry points, document nonce handling, logger redactor, config/inventory/proxy paths, Docker and environment files. Followed installed Next guides, including matcher locale behavior and output tracing.
- Frontend-only bypass: no client state/localStorage authority; session enforced before private rendering/loading and again at APIs. Login props do not serialize settings/inventory/account data. A legacy auth-disable environment variable cannot disable the guards.
- Coverage: every API file inspected by the guard coverage test and actual HTTP enumeration, with only public login/minimal health exceptions. Custom API paths, direct browser navigation, configuration/inventory, service/widget proxy, Docker, Proxmox, Kubernetes, resources, MCP and auth/session/logout denied before sensitive handlers run. Private SSR XML/manifest/robots, dashboard/unknown server routes, framework image/data and static dashboard files also tested.
- IDOR: no HTTP account management/session-ID lookup endpoint; ownership derives from the opaque server-validated cookie. Enabled owners intentionally share the whole dashboard. No public registration or recovery endpoint.
- Randomness/fixation: crypto.randomBytes; new ID/CSRF on every login; prior cookie revoked, credential state rechecked after async verification. Password reset/account disable revokes sessions. No raw session ID in SQLite, URL or logs.
- Real failures: empty/invalid/overlong credentials, unknown username/wrong password generic failures; malformed/random/modified/expired/replayed cookies, disabled account, original Host spoof, forged forwarded headers, missing/wrong CSRF, foreign/null/missing Origin, rate limiting/recovery all rejected as expected.
- Online backup verified while source WAL connection and session remained active; committed account/session data copied consistently. Snapshot integrity/schema checked, overwrite refused, restore into isolated file required stopped assertion, retained account hash and removed every session/throttle. Snapshot converted to DELETE journaling for read-only mount portability. Actual Linux volume restore remains a preflight gate.
- Playwright starts only its own production Node server on `127.0.0.1:3198` behind a local HTTPS fixture on `127.0.0.1:3443`; no existing service is restarted. Browser suite validates login→dashboard→logout→login and protected direct API denial, cookies/headers, account/session edges and unchanged dashboard behavior across desktop/mobile. Test TLS error bypass is fixture-only; global TLS validation is never disabled.
- Existing unit-suite warnings concern Vitest JSX options and nested legacy vi.unmock calls; no failures. Typecheck is the project's auth-scoped JS typecheck, not an invented full legacy-dashboard TypeScript gate.
- Secret scanning is heuristic plus manual review, not a claim about unknown remote `.env` contents or complete dependency vulnerability analysis. No production secrets were created, displayed or committed. Backups and screenshots remain private artifacts, excluded from releases.

## Retained temporary databases

All paths are local ignored artifacts, never production mounts. Original four:

- `C:\Users\silas\IdeaProjects\silas-homepage\artifacts\auth-e2e\3e4cbd66af5e3d95.sqlite`
- `C:\Users\silas\IdeaProjects\silas-homepage\artifacts\auth-e2e\44541f276f3a3ca0.sqlite`
- `C:\Users\silas\IdeaProjects\silas-homepage\artifacts\auth-e2e\451da826f04effa8.sqlite`
- `C:\Users\silas\IdeaProjects\silas-homepage\artifacts\auth-e2e\63965b6b813ff1b7.sqlite`

Additional audit-generated databases are listed in the generated artifact inventory below. Associated `.sqlite-wal`/`.sqlite-shm` share the same ignored directory; all inspected WAL files were empty after teardown. SQLite main files remain intentionally retained because previous automatic approval review blocked deletion with “blocked by policy.” No further attempt to delete databases was made. Test account/session data is disabled/revoked, runtime credential JSON is `{}`, and retained generated `.key` files are empty. Public one-day test certificates and private screenshot/log files remain ignored. `.dockerignore` excludes `artifacts/**`, auth data and SQLite files; inspected standalone output has no fixture databases/credentials/private keys. Unit test scratch databases live in OS temp and their test teardown removes them.

## Audit-specific changed files

- `.env.example`
- `README.md`
- `compose.yaml`
- `deploy/Dockerfile`
- `docs/silas/AUTHENTICATION.md`
- `docs/silas/AUTH_SECURITY_REVIEW.md`
- `docs/silas/PRODUCTION_RUNBOOK.md` (new)
- `docs/silas/PRODUCTION_SECURITY_AUDIT.md` (new)
- `docs/silas/SECURITY.md`
- `next.config.js`
- `package.json`
- `playwright.auth.config.mjs`
- `pnpm-lock.yaml`
- `scripts/auth-backup.cjs` (new)
- `scripts/auth-e2e-server.mjs`
- `scripts/auth-e2e-teardown.mjs` (new)
- `src/proxy.js`
- `src/proxy.test.js`
- `src/utils/auth/public-assets.js` (new)
- `src/utils/auth/public-assets.test.js` (new)
- `src/utils/auth/security.test.js`
- `src/utils/auth/store.cjs`
- `tests/browser/authentication.spec.mjs`

The SilasSend asset and all dashboard card/layout/config/component files have the same contents as at the start of this audit. The broader pre-existing authentication changes are preserved; full working-tree manifest follows.


## Final artifact inventory

| Retained database | Enabled accounts | Sessions | Integrity |
| --- | --- | --- | --- |
| `C:\Users\silas\IdeaProjects\silas-homepage\artifacts\auth-e2e\0330b58518b704c1.sqlite` | 0 | 0 | ok |
| `C:\Users\silas\IdeaProjects\silas-homepage\artifacts\auth-e2e\21e3971b41321930.sqlite` | 0 | 0 | ok |
| `C:\Users\silas\IdeaProjects\silas-homepage\artifacts\auth-e2e\3e4cbd66af5e3d95.sqlite` | 0 | 0 | ok |
| `C:\Users\silas\IdeaProjects\silas-homepage\artifacts\auth-e2e\42e6a03a13e1a769.sqlite` | 0 | 0 | ok |
| `C:\Users\silas\IdeaProjects\silas-homepage\artifacts\auth-e2e\44541f276f3a3ca0.sqlite` | 0 | 0 | ok |
| `C:\Users\silas\IdeaProjects\silas-homepage\artifacts\auth-e2e\451da826f04effa8.sqlite` | 0 | 0 | ok |
| `C:\Users\silas\IdeaProjects\silas-homepage\artifacts\auth-e2e\58cebedeb4dc734f.sqlite` | 0 | 0 | ok |
| `C:\Users\silas\IdeaProjects\silas-homepage\artifacts\auth-e2e\63965b6b813ff1b7.sqlite` | 0 | 0 | ok |
| `C:\Users\silas\IdeaProjects\silas-homepage\artifacts\auth-e2e\841fe487da7390ef.sqlite` | 0 | 0 | ok |
| `C:\Users\silas\IdeaProjects\silas-homepage\artifacts\auth-e2e\e84f7e59f7f1d756.sqlite` | 0 | 0 | ok |
| `C:\Users\silas\IdeaProjects\silas-homepage\artifacts\auth-e2e\f53566a935d92aac.sqlite` | 0 | 0 | ok |
| `C:\Users\silas\IdeaProjects\silas-homepage\artifacts\audit-backup-check.sqlite` | 0 | 0 | ok |

## Complete uncommitted working-tree manifest

- `.dockerignore`
- `.env.example`
- `.gitignore`
- `README.md`
- `compose.yaml`
- `deploy/Dockerfile`
- `docs/silas/AUTHENTICATION.md`
- `docs/silas/AUTH_SECURITY_REVIEW.md`
- `docs/silas/PRODUCTION_RUNBOOK.md`
- `docs/silas/PRODUCTION_SECURITY_AUDIT.md`
- `docs/silas/SECURITY.md`
- `eslint.config.mjs`
- `next.config.js`
- `package.json`
- `playwright.auth.config.mjs`
- `pnpm-lock.yaml`
- `public/silas/icons/silassend.svg`
- `scripts/auth-admin.cjs`
- `scripts/auth-backup.cjs`
- `scripts/auth-e2e-server.mjs`
- `scripts/auth-e2e-teardown.mjs`
- `src/__tests__/pages/api/auth/[...nextauth].test.js`
- `src/__tests__/pages/api/mcp/index.test.js`
- `src/__tests__/pages/api/revalidate.test.js`
- `src/__tests__/pages/api/theme.test.js`
- `src/__tests__/pages/auth/signin.test.jsx`
- `src/__tests__/pages/index.test.jsx`
- `src/components/silas/header.jsx`
- `src/components/toggles/revalidate.jsx`
- `src/components/toggles/revalidate.test.jsx`
- `src/components/toggles/signout.jsx`
- `src/components/toggles/signout.test.jsx`
- `src/instrumentation.js` (deleted by prior auth pass)
- `src/instrumentation.test.js` (deleted by prior auth pass)
- `src/middleware.js` (deleted by prior auth pass)
- `src/middleware.test.js` (deleted by prior auth pass)
- `src/pages/_app.jsx`
- `src/pages/_document.jsx`
- `src/pages/api/auth/[...nextauth].js`
- `src/pages/api/auth/login.js`
- `src/pages/api/auth/logout.js`
- `src/pages/api/auth/session.js`
- `src/pages/api/bookmarks.js`
- `src/pages/api/config/[path].js`
- `src/pages/api/docker/stats.js`
- `src/pages/api/docker/statuses.js`
- `src/pages/api/hash.js`
- `src/pages/api/kubernetes/stats/[...service].js`
- `src/pages/api/kubernetes/status/[...service].js`
- `src/pages/api/mcp/index.js`
- `src/pages/api/ping.js`
- `src/pages/api/proxmox/stats/[...service].js`
- `src/pages/api/releases.js`
- `src/pages/api/revalidate.js`
- `src/pages/api/search/searchSuggestion.js`
- `src/pages/api/services/index.js`
- `src/pages/api/services/proxy.js`
- `src/pages/api/siteMonitor.js`
- `src/pages/api/theme.js`
- `src/pages/api/validate.js`
- `src/pages/api/widgets/customapi.js`
- `src/pages/api/widgets/glances.js`
- `src/pages/api/widgets/index.js`
- `src/pages/api/widgets/kubernetes.js`
- `src/pages/api/widgets/longhorn.js`
- `src/pages/api/widgets/openmeteo.js`
- `src/pages/api/widgets/openweathermap.js`
- `src/pages/api/widgets/resources.js`
- `src/pages/api/widgets/stocks.js`
- `src/pages/api/widgets/weather.js`
- `src/pages/auth/signin.jsx`
- `src/pages/browserconfig.xml.jsx`
- `src/pages/index.jsx`
- `src/pages/robots.txt.js`
- `src/pages/site.webmanifest.jsx`
- `src/proxy.js`
- `src/proxy.test.js`
- `src/styles/silas-auth.css`
- `src/utils/auth/client.js`
- `src/utils/auth/http.js`
- `src/utils/auth/public-assets.js`
- `src/utils/auth/public-assets.test.js`
- `src/utils/auth/security.test.js`
- `src/utils/auth/store.cjs`
- `src/utils/env.js` (deleted by prior auth pass)
- `tests/browser/authentication.spec.mjs`
- `tests/browser/dashboard.spec.mjs`
- `tests/browser/fixtures.mjs`
- `tests/browser/server-details.spec.mjs`
- `tests/browser/service-search.spec.mjs`
- `tests/browser/system-overview.spec.mjs`
- `tsconfig.auth.json`
- `vitest.setup.js`
