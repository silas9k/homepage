# Authentication implementation and security review

This is the historical implementation-pass review. The subsequent [final production audit and release gate](PRODUCTION_SECURITY_AUDIT.md) found and fixed static-bundle exposure caused by the automatic locale matcher, hardened Compose and login input handling, and added the [Debian runbook](PRODUCTION_RUNBOOK.md). Use those documents for deployment decisions.

Reviewed locally on 2026-10-10. No commit, push, deployment or Cloudflare configuration was performed.

Temporary test passwords and TLS private keys were removed. Automatic approval review blocked deletion of four ignored test SQLite files with the reason "blocked by policy"; their accounts were disabled and all sessions/throttles revoked instead. No actual dashboard account data was changed.

| Requested item | Implemented behavior / evidence |
| --- | --- |
| 1. Architecture | Mandatory local authentication; Next Node Proxy plus independent API and page guards. NextAuth/JWT/OIDC are retired. Dashboard SSR avoids public static inventories. |
| 2. Password hashing | Maintained @node-rs/argon2 Argon2id, m=19456 KiB, t=2, p=1, salted 32-byte output. |
| 3. Sessions | 256-bit random opaque IDs, only SHA-256 ID digests in SQLite; account enabled checks on each lookup; absolute 12-hour expiry; login rotation; logout/password reset revocation. |
| 4. Cookies | Production __Host-silas-session; HttpOnly, Secure, SameSite=Lax, Path=/, no Domain, Max-Age/Expires. Local dev uses a separate non-Secure cookie name. |
| 5. CSRF | Exact allowed same-origin and session-bound header token on unsafe authenticated methods. Same-origin JSON-only login. Cross-site/missing Origin rejected. Refresh/logout POST only. |
| 6. Throttling | SQLite atomic username budget of 5 attempts/15 minutes plus global 20 attempts/minute before hashing; success resets username budget; automatic expiry, no permanent lockout. |
| 7. Coverage | Every sensitive API independently guarded, including config/custom CSS/JS, all service/widget proxies, Docker, Proxmox, Kubernetes, metrics, Beszel/Nextcloud/Portainer/Tailscale/Cloudflare via widget proxy, and MCP. Unknown /api/silas paths denied anonymously. |
| 8. Bootstrap | Environment username/password are used only with zero accounts; first login provisions the account atomically. Existing accounts cannot be overwritten, including across restarts. Remove bootstrap values after setup and restart. No real account was provisioned during development. |
| 9. Persistence | Node built-in SQLite; data/auth/auth.sqlite locally, /app/data/auth/auth.sqlite in homepage-auth Docker volume. WAL, foreign keys, expiry index and busy timeout. Non-root storage ownership. |
| 10. Proxy | Auth ignores forwarded Host/protocol/IP and CF-Connecting-IP. Exact external Host plus allowed HTTPS Origin required. Host-side port stays loopback. Production HTTPS tested behind a local HTTPS-to-HTTP validation proxy. |
| 11. Headers | Nonce CSP, nosniff, no-referrer, Permissions-Policy, DENY/frame-ancestors none and private/no-store. Production no script eval. HSTS deferred to the future HTTPS edge. |
| 12. UI | Small light centered Silasnet login with username/password autocomplete; no registration/recovery links. Discreet logout in the existing footer; full navigation clears client data. Dashboard card/layout configuration unchanged. |
| 13. Tests | 577 files / 1,807 unit and integration tests passed; 22 production Playwright tests passed. Real store tests cover all requested session/account/throttle/CSRF cases and cross-process persistence. Legacy business-logic tests stub the auth wrapper; dedicated security tests use the real wrapper/store and E2E tests hit actual HTTP routes. |
| 14. Build | pnpm build passed. Dashboard route is dynamic, not prerendered. pnpm lint passed; pnpm typecheck passed with JS checks enabled for auth modules; git diff --check passed. |
| 15. Files | Complete changed/new/deleted file manifest below; one pre-existing SilasSend asset edit from the previous branding task is preserved. |
| 16. Environment | New HOMEPAGE_AUTH_BOOTSTRAP_USERNAME, HOMEPAGE_AUTH_BOOTSTRAP_PASSWORD, HOMEPAGE_AUTH_DB and HOMEPAGE_AUTH_ORIGINS. Existing HOMEPAGE_ALLOWED_HOSTS still validates exact hosts. No auth-disable switch or session secret is needed. |
| 17. Docker | homepage-auth named volume, /app/data/auth with node ownership/mode 0700; local admin script and store included in image; host loopback mapping retained. Docker CLI is unavailable locally, so no Docker image was built/run. |
| 18. Limitations | Single instance/shared SQLite filesystem, equally trusted owner accounts, no MFA, one-account bootstrap only. Actual Tailscale hostname/origins still need local values. Production browser access needs HTTPS. Global throttles can cause temporary shared denial of service. Keep runtime/dependencies patched. Native Linux/container execution remains unverified. |
| 19. Secrets | Reviewed changed files; credential/private-key/token/credential-URL scan found zero literals. Bootstrap example fields are empty. Environment/store/test credentials are ignored; no production credentials were created or printed. |
| 20. State | No commits, pushes, deployments or Cloudflare changes. |

## Final source review

- Frontend bypass: auth is enforced before server rendering/data loading and again in each API handler, irrespective of the legacy HOMEPAGE_AUTH_ENABLED value.
- Route omissions: source coverage test audits every API file; production anonymous HTTP test enumerates all actual API routes plus custom CSS/JS and hypothetical /api/silas routes. Legacy auth providers and MCP bearer tokens cannot bypass the session guard.
- IDOR: there are no HTTP account/session-management endpoints accepting account IDs. All enabled accounts are trusted owners of the same inventory. Session lookups derive ownership solely from the opaque cookie; no user-supplied ID is used for authorization.
- Session fixation/randomness: login generates new crypto.randomBytes IDs and revokes the old ID. Guessed/malformed/revoked/expired sessions are denied; account disabling and password resets invalidate access.
- Password/logging/registration: salted Argon2id only, bootstrap password never logged, generic invalid credentials, no public registration or recovery flow. Local reset reads hidden input rather than argv.
- Rate limit/CSRF: persistent bounded budgets reserved before hashing; exact Origin plus CSRF token enforced for unsafe actions; successful login resets username failures. E2E also changes forwarded IPs during throttling.
- Proxy/hosts: wildcard host configuration fails closed; forwarded headers are irrelevant to auth decisions. Spoofed Host and middleware-subrequest bypass attempt both fail production HTTP tests.
- Error/cache handling: auth failures disclose no inventory; errors are generic; private/no-store prevents normal shared caching. CSP nonce is freshly generated and supplied to NextScript; incoming nonce headers are overwritten.

## Performance

A local Node 24.18.0 Windows harness measured 51 MiB baseline RSS, 53 MiB after store import/open, and 72 MiB idle after initial hashing (2 MiB import overhead, 21 MiB post-hash increase). Initial hash took 9 ms on this machine. This does not predict memory/time on the homeserver or in the Linux container. No idle hashing or periodic external service was added.

## Setup

See [AUTHENTICATION.md](AUTHENTICATION.md) for account bootstrap, exact hosts/origins, persistent storage, local password reset, session behavior, HTTPS requirements and future Cloudflare expectations. Local development also requires authentication. Typecheck is scoped to the new auth JS modules; the existing project is JavaScript and had no previous full-project typecheck.

## File manifest

- `.dockerignore`
- `.env.example`
- `.gitignore`
- `README.md`
- `compose.yaml`
- `deploy/Dockerfile`
- `docs/silas/AUTHENTICATION.md`
- `docs/silas/AUTH_SECURITY_REVIEW.md`
- `docs/silas/SECURITY.md`
- `eslint.config.mjs`
- `next.config.js`
- `package.json`
- `playwright.auth.config.mjs`
- `pnpm-lock.yaml`
- `public/silas/icons/silassend.svg`
- `scripts/auth-admin.cjs`
- `scripts/auth-e2e-server.mjs`
- `src/__tests__/pages/api/auth/[...nextauth].test.js`
- `src/__tests__/pages/api/mcp/index.test.js`
- `src/__tests__/pages/api/revalidate.test.js`
- `src/__tests__/pages/api/theme.test.js`
- `src/__tests__/pages/auth/signin.test.jsx`
- `src/__tests__/pages/index.test.jsx`
- `src/components/toggles/revalidate.jsx`
- `src/components/toggles/revalidate.test.jsx`
- `src/components/toggles/signout.jsx`
- `src/components/toggles/signout.test.jsx`
- `src/instrumentation.js`
- `src/instrumentation.test.js`
- `src/middleware.js`
- `src/middleware.test.js`
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
- `src/utils/auth/security.test.js`
- `src/utils/auth/store.cjs`
- `src/utils/env.js`
- `tests/browser/authentication.spec.mjs`
- `tests/browser/dashboard.spec.mjs`
- `tests/browser/fixtures.mjs`
- `tests/browser/server-details.spec.mjs`
- `tests/browser/service-search.spec.mjs`
- `tests/browser/system-overview.spec.mjs`
- `tsconfig.auth.json`
- `vitest.setup.js`
