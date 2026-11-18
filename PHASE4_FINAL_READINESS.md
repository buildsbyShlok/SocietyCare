# SocietyCare Phase 4 readiness

**READY FOR STAGING DEPLOYMENT · Phase 4.1 · 19 November 2026**

## Phase 4 baseline changes

| Files | Change |
|---|---|
| client/src/utils/report-url.mjs, client/src/pages/Assets.jsx | Select and validate the label origin. Bind the generated PNG to its destination so changing equipment cannot reuse the previous image. Preview, print and download share the PNG. |
| client/vite.config.js, client/src/api/index.js | Validate public configuration during production builds and use same-origin /api as the production default. |
| client/Dockerfile, docker-compose.yml, .env.example, .env.compose.example, README.md, docs/deployment.md | Pass through the public origin and document the build contract. The loopback Compose demonstration uses local-demo mode. Generating labels in its compiled client still requires a valid public origin. |
| server/src/controllers/user.controller.js, server/src/services/user.service.js | Scope directory results, account-management targets and the final-admin count to the acting admin’s society. |
| server/src/routes/society.routes.js | Load and update the member’s society and count only its registered flats. |
| server/src/middleware/community-society.js, server/src/routes/community.routes.js, server/src/routes/event.routes.js, server/src/routes/notice.routes.js, server/src/services/notice.service.js | The legacy community tables belong to the original singleton society and lack tenant keys. Restrict these routes and pinned-notice recipients to that society. Other societies retain the tenant-aware equipment and complaint workflows. |
| client/tests/report-url.test.mjs, server/tests/unit/account-control.test.js, server/tests/database/phase3-admin-check.js | Regression coverage for URL selection, cross-society account management, community access and settings. |
| server/tests/integration/notices.test.js, server/tests/unit/errors.test.js | Supply database membership in mock identities used by existing tests. |
| PHASE4_FINAL_READINESS.md | Verification results and release checklist. |

## QR reporting

The label encodes /report/ followed by the URL-encoded existing token. Development defaults to the browser origin, which can be a reachable LAN address. Production requires VITE_PUBLIC_FRONTEND_URL to contain the public HTTPS frontend origin. Missing configuration, localhost and malformed origins produce a configuration error. Generating a label reads the token without writing to the asset. Existing physical labels retain their original destination and must be reprinted if that address is unreachable.

## Phase 4 baseline checks

| Command or exercise | Result |
|---|---|
| server · npm test | 131 passed, 0 failed, 0 skipped. |
| server · npm run test:database | Passed against local PostgreSQL. Asset, QR and admin database checks ran inside the workspace transaction. Covered negative QR cases, uploads, current permissions, status changes, history, dashboard figures, community, events, notices, directory and settings. Transaction rolled back. |
| server · npx prisma validate and npx prisma migrate status (local Prisma CLI) | Schema valid. All 12 local migrations applied. Reviewed the QR defaults and ownership backfill, which assume a single original society. No migration added or applied in this phase. |
| server · NODE_ENV=production node server.js | A separate local process started against PostgreSQL and returned HTTP 200 from /health. Backend runs directly as JavaScript. |
| client · npm run test:ui, npm run test:platform, npm run test:interactions | 18 rendering checks, 28 contrast pairs, font checks and the QR-return, directory and camera handler suites passed. |
| client · node --test tests/report-url.test.mjs | 1 test passed, including rejection of missing and loopback origins. |
| client · npm run build | Missing QR configuration rejected. Production build passed with a reserved test hostname and /api. Rebuild with the real values for release. |
| Local Chrome with Playwright | Admin API asset creation, resident registration via API, mobile-width QR landing, browser sign-in and return, refresh, submission, admin API resolution and resident detail refresh passed. Rendered equipment QR, downloaded PNG and produced print PDF. Smoke-tested Home, dashboard, chat, notices, events and settings at 390, 768 and 1440 px. These were page-load checks. Physical label scan and every form interaction remain unverified. |
| server · node tests/database/integrations-live-check.js | Passed real Cloudinary complaint, avatar, event and chat uploads, persisted URLs and public IDs, image retrieval, Groq analysis and duplicate matching. Browser and live-provider runs retained local QA records and test uploads. |
| npm audit and npm audit --omit=dev in client and server | npm registry advisory connection reset (ECONNRESET). No vulnerability count available. |
| Other checks | Neither package declares lint or type-check scripts. Resend delivery was untested because sender credentials were unavailable. |

## Deployment requirements

1. Use Node 24 per .nvmrc. Choose the actual HTTPS web and API origins. Set backend CLIENT_URL to the exact frontend origin for CORS. Set NODE_ENV=production, DATABASE_URL and a random JWT_SECRET of at least 32 characters. PORT, JWT_EXPIRES_IN and CRON_OVERDUE_INTERVAL are optional. Inject secrets through the host.
2. Back up PostgreSQL and verify restoration on a separate database. Configure the host-required TLS parameters and trusted CA in the connection settings. Review ownership before migrating any historical multi-society dataset. Test the upgrade on a representative copy, particularly the complaint backfill and foreign keys.
3. From server run npm ci --include=dev, npx prisma generate, npx prisma migrate deploy, npx prisma migrate status, then npm start. Use one API instance with the current in-memory rate limits. Verify /api/health, proxy IP handling, and a database-backed request through the intended ingress.
4. From client run npm ci, set VITE_PUBLIC_FRONTEND_URL and VITE_API_URL, then npm run build. Publish client/dist. Route deep links to index.html. If using same-origin /api, proxy that path to Express before the SPA rewrite. The supplied Vercel rewrite and nginx config provide SPA fallback only.
5. Optional server integrations use CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, GROQ_API_KEY, RESEND_API_KEY and FROM_EMAIL. For email, verify sender ownership and delivery to a designated test mailbox.
6. Verify authentication and CORS from the actual origin. Scan a printed label on a phone using mobile data, sign in, attach a photo, resolve the complaint as admin and confirm the resident sees the update. Check an inactive label as well.

## Phase 4.1 enrollment and verification

Previously anyone could obtain a resident session by submitting a name and flat. Registration now stores a disabled resident with a pending enrollment flag and returns only a receipt. The additive migration defaults existing accounts to non-pending and enforces that a pending account is a disabled resident. Earlier account access is grandfathered. The migration does not establish the membership of previously self-registered accounts. The owner should reconcile those accounts against the society roster before admitting real residents.

The public form accepts no membership override. A valid active equipment token selects the reviewing society. Ordinary registration uses the original installation society. An admin must independently confirm the identity, unit and that the applicant actually initiated the request, using an established society contact or in person. In Settings → Resident Directory, select **Approve enrollment**. A conditional database update activates only a pending resident in that admin’s society. Ordinary deactivated accounts cannot be reactivated this way. The applicant follows the sign-in link on the receipt or rescans the label after approval.

No new environment variable or QR token rotation is required. During upgrade, take old registration handlers out of service before enabling traffic, apply migrations, regenerate Prisma Client and start only the updated API. Use the deployment requirements above for variables, HTTPS, CORS, API routing and startup.

| Phase 4.1 verification | Observed result |
|---|---|
| Backend npm test | 131 passed, zero failed or skipped. |
| npm run test:database against local PostgreSQL | Passed and rolled back. Covered forged registration fields, denied pending login and private routes, same-society admin approval, resident and cross-society approval denial, repeated approval, subsequent login and QR complaint linkage. |
| Prisma validate, migrate deploy, generate and migrate status | Schema valid. Applied one additive migration locally. All 13 current. Client regeneration succeeded after briefly restarting the local development backend to release its Windows DLL. |
| Local Chrome, mobile-width QR route | Registered from the QR page, saw the pending receipt, approved the request through the admin directory, followed the receipt’s sign-in link, returned to the original equipment, refreshed, submitted and saw the resolved complaint. Local PNG download and print rendering passed. Browser and API smoke tests retained designated local QA records. |
| Client test:ui, test:interactions, test:platform and node --test tests/report-url.test.mjs | 18 rendering checks passed. Handler, contrast, font and QR destination checks passed. |
| Production-mode checks | npm run build passed using an isolated test hostname. Express started locally in production mode and returned HTTP 200 from /health. Use actual hosting values for staging. |
| Dependency assessment | npm audit retried in both workspaces and failed with ECONNRESET. OSV’s npm batch API checked the exact installed-lock versions, including direct, transitive, optional and development entries. Client had 152 distinct package/version pairs, server had 184, and the combined set had 333. Zero pairs matched published OSV advisories. A known affected version returned advisories in a positive control. No dependency or lockfile change was indicated. Audit results are a point-in-time check. |

## Owner’s staging acceptance checklist

1. Provide the actual HTTPS origins and secrets. Open the public frontend, verify /api/health, confirm authenticated requests use the intended API and check CORS from the configured frontend.
2. Start a resident enrollment. Confirm private routes and login are inaccessible until approval. Independently verify the resident and approve the request in the directory.
3. Sign in as the resident and refresh a protected page to verify session persistence.
4. Print a label generated from a pre-existing asset. Scan it with a physical smartphone on mobile data.
5. Check the equipment name, code and location. Open and refresh the deep link while signed out, then sign in and confirm return to that asset.
6. Submit a fault with a photo and confirm the image still loads after refresh.
7. Log in as a same-society admin. Filter for QR complaints and find the resident’s report.
8. Open the report, add a remark and resolve it.
9. Refresh the resident detail page and confirm the new status and remark.
10. Open the asset history and verify the report appears against the correct equipment.
11. Check invalid and inactive labels, pending accounts, attempted role assignment, cross-society approval and cross-society complaint access using staging test identities.
12. Rehearse the database backup, restore and migration before approving production.

### Database restore rehearsal

Use PostgreSQL client tools compatible with the server. Configure separate libpq service entries and private password files for the staging source and a newly created, empty disposable restore database. Confirm the database and host with the first query on each connection. Restrict the backup file to authorised operators.

~~~sh
psql "service=sc_staging" -c "SELECT current_database(), inet_server_addr()"
pg_dump --dbname="service=sc_staging" --format=custom --file=societycare-stage.dump
pg_restore --list societycare-stage.dump
psql "service=sc_restore_test" -c "SELECT current_database(), inet_server_addr()"
pg_restore --dbname="service=sc_restore_test" --no-owner --no-acl --exit-on-error --single-transaction societycare-stage.dump
~~~

With DATABASE_URL pointed at the disposable restore database, run npx prisma migrate deploy and npx prisma migrate status from server. Compare user, asset, complaint and history counts at the backup snapshot, verify an existing label still identifies the same equipment and confirm approved and pending login behaviour. Record the restore duration and result. Protect and expire the backup according to the owner’s retention policy.

## Final verdict

READY FOR STAGING DEPLOYMENT

Public-host HTTPS, physical-phone scanning and the staging restore rehearsal remain owner acceptance steps. No deployment was performed.
