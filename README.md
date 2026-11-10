# SocietyCare

Residential society maintenance management with resident and admin portals. This is an existing React/Express application; PostgreSQL is the system of record.

## Architecture and features

- `client`: React 19, Vite 6, React Router 7, CSS, Framer Motion and Lucide React. Semantic light/dark themes with Geist headings, Inter body text and Geist Mono identifiers; fonts are served locally with their licenses.
- `server`: Node.js, Express 4, Prisma 6 and PostgreSQL. Routes → middleware → controllers → services → Prisma.
- Authentication: bcrypt passwords and Bearer JWTs. Every protected request reloads the user's current database identity/role. Demotion takes effect on the next request; deleted users receive 401. Disabled users cannot sign in or reuse an existing token.
- Residents: register/login, profile settings, submit and filter their own complaints, view details/history and read notices.
- Admins: dashboard statistics and overdue monitoring, complaint status/priority updates, remarks/history, notice creation/editing/pinning/deletion, searchable directory and role management.
- Complaint states: `OPEN → IN_PROGRESS → RESOLVED`, or `OPEN → RESOLVED`. `UNRESOLVED` is a list filter for open/in-progress complaints, not a stored status. Remarks are optional in the current implementation.
- Optional integrations: Cloudinary image attachments/avatars; Groq complaint assistance and ownership-scoped semantic duplicate detection; Resend status-change and pinned-notice emails.
- AI routes are only `POST /api/ai/analyze-complaint` and `POST /api/ai/detect-duplicates`, both authenticated and accepting `{ "complaint": "..." }`.

## Society workspace

Home opens at `/`. Admin Management → Society information controls its name, address, flat capacity, description and upcoming maintenance. Registered flats count distinct tower/unit pairs on active resident accounts. Physical occupancy is not inferred.

Maintenance & Billing is a manual INR ledger. Choose a responsible resident, month, amount and due date to generate an invoice. Open an invoice’s dedicated detail page to see its breakdown or, as an admin, verify a full external payment by reference. Each verified payment produces one receipt. Changing the resident's profile leaves the original invoice owner and unit intact.

Events at /events are published by residents or admins, with creator/admin editing and soft removal. Event times are entered/displayed in the browser’s local timezone and stored in UTC. Home shows upcoming events. Announcements have categories and dedicated detail pages.

Community supports text, images (JPEG/PNG/WebP, 5 MB), replies, avatars and unit labels. Messages refresh every seven seconds. Message options include reporting. Admins review reported messages and can remove them from the feed. Profiles display complaint history to the owner and admins; private profiles show verified payment history with links to invoice details; billing management stays in Maintenance & Billing. Residents can remove their own complaints with confirmation and an audit reason; admins can archive permitted complaints and review them from Admin Management. Archival preserves the record and history.

## Windows local setup (PowerShell)

Use Node.js **24.22.2 LTS** (the `.nvmrc` version), npm and a running local PostgreSQL service on port 5432. Existing databases must be preserved. Run each block from the indicated directory.

From the project root:

```powershell
Set-Location 'S:\PROJECTS\SOCIETY CARE\society-maintenance-management-main'
Set-Location server
npm ci
Set-Location ../client
npm ci
```

If PowerShell blocks npm scripts, use `npm.cmd` and `npx.cmd` instead of changing system execution policy.

For a fresh setup only, copy the root `.env.example` to `server/.env` if that file does not already exist. Edit its values locally. Never overwrite an existing `.env` or commit credentials.

```powershell
# Run from the project root; preserve existing configuration.
if (!(Test-Path server/.env)) { Copy-Item .env.example server/.env }
```

Create `client/.env` if missing, with:

```env
VITE_API_URL=http://localhost:5000/api
```

In PostgreSQL/pgAdmin, create the `society_maintenance` database only if it does not already exist. Configure `server/.env` with your actual database user/password (URL-encode special characters):

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/society_maintenance
JWT_SECRET=YOUR_GENERATED_RANDOM_SECRET
JWT_EXPIRES_IN=7d
```

Generate a secret locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and save it in `server/.env`.

From `server`, validate and apply the committed migrations:

```powershell
npx prisma generate
npx prisma validate
npx prisma migrate status
npx prisma migrate deploy
```

`migrate status` reports pending migrations before they are applied. `migrate deploy` applies existing migration files; do not use `db push`, reset, or seed scripts to initialize an existing installation. Do not edit applied migrations. Committed migrations include overdue fields, the society workspace, notice categories, events, and chat attachments/replies. If Windows locks the Prisma engine DLL, stop the local API, regenerate Prisma Client and restart the API.

## Environment variables

| Variable | Purpose / default |
| --- | --- |
| `DATABASE_URL` | Required PostgreSQL connection string |
| `JWT_SECRET` | Required strong random signing secret; never expose to the client |
| `CLIENT_URL` | Required exact frontend origin for CORS, locally `http://localhost:5173` |
| `PORT` | Backend port, default `5000` |
| `NODE_ENV` | `development` locally; `production` when hosted |
| `JWT_EXPIRES_IN` | Token lifetime, default `7d` |
| `CRON_OVERDUE_INTERVAL` | Overdue check schedule, default `*/30 * * * *` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Optional; all three required for complaint images, avatars, event posters and chat attachments |
| `GROQ_API_KEY` | Optional; required for AI analysis and duplicate checks |
| `RESEND_API_KEY`, `FROM_EMAIL` | Optional; both required for email; sender must be verified in Resend |
| `VITE_API_URL` | Client only; API base URL including `/api` |

Leave unused integration values empty. Missing Cloudinary/Groq configuration returns an actionable 503 when requested; text-only complaints still work. Email is best effort: absent configuration skips delivery with a server warning, and failures are logged without rolling back complaint/notice changes. No production flow uses mock data.

Integration setup and troubleshooting:
- Keep provider keys only in `server/.env`; never prefix them with `VITE_`. The backend resolves this file from its own directory even when started with `node server/server.js` from the project root. Existing process environment values take precedence.
- Restart an already-running backend after adding credentials. New `npm run dev` sessions watch `server/.env` automatically; `npm start` still requires a restart. A healthy API with 503 “not configured” can indicate a stale process.
- Open the frontend at the exact `CLIENT_URL` origin. `http://localhost:5173` and `http://127.0.0.1:5173` are different browser origins; a mismatch causes CORS/network failures.
- Cloudinary accepts PNG/JPEG/WebP with matching file content, up to 5 MB (avatars: 2 MB). Uploads have a 30-second deadline. New uploads persist both HTTPS URLs and public IDs; existing URLs remain intact and their new ID columns are nullable.
- Groq uses `openai/gpt-oss-20b` with `openai/gpt-oss-120b` fallback, verified against the account's model list. Each call has a 12-second timeout. Authentication/quota/timeout failures stop retries and return actionable errors; model/unavailable or malformed responses allow one fallback. AI routes allow 12 requests per account per minute.
- HTTP 503 for provider access requires checking the server-side account/key permissions; 429 means wait for the usage window or provider quota; 504 means retry after a timeout. Provider response bodies are not returned or logged. Manual complaint submission remains available.
- Opt-in live verification: `node tests/database/integrations-live-check.js` from `server`. This requires an active local QA resident (set QA_EMAIL), makes real provider calls, consumes provider quota, and **retains clearly labelled QA records**. It writes results outside the project to the OS temporary directory (or QA_OUTPUT_DIR), and is not part of `npm test`.

Login permits 15 failed attempts per IP per 15 minutes; successful logins do not consume the allowance. Registration has a separate 15-attempt allowance. `/auth/me` and logout do not share those limits. The same protection runs locally and in production. The limiter store is per process; multiple production instances require a coordinated store and a reviewed proxy configuration.

## Start the application

Backend, in one PowerShell terminal:

```powershell
Set-Location 'S:\PROJECTS\SOCIETY CARE\society-maintenance-management-main\server'
npm run dev
```

Frontend, in another terminal:

```powershell
Set-Location 'S:\PROJECTS\SOCIETY CARE\society-maintenance-management-main\client'
npm run dev
```

Open `http://localhost:5173`. API health is `http://localhost:5000/api/health`. Backend startup checks PostgreSQL connectivity and runs the overdue scheduler immediately, then every 30 minutes by default. Production backend command is `npm start` from `server`; `npm run build` from `client` writes `client/dist`.

Public registration creates residents only. Existing administrators can promote accounts through the directory. Do not run `prisma/seed.js` on an existing database. Administrator provisioning requires explicit ADMIN_EMAIL and ADMIN_PASSWORD and refuses to promote existing residents. See docs/deployment.md. Demo seeding is disabled by default and refuses non-empty or non-local databases; it requires development mode, ALLOW_DEMO_SEED=true and an explicit DEMO_PASSWORD. Never run it on the working database.

## Verification

```powershell
# From server
npx prisma validate
npx prisma migrate status
npm test
npm run test:database  # optional local PostgreSQL workflow checks with rollback

# From client
npm run build
```

The standard backend tests use mocked database/provider methods; they do not establish browser or external-provider success. The opt-in database check uses PostgreSQL inside a rolled-back transaction. Frontend checks cover component rendering, handlers, design-token contrast and assets. Run live provider/browser checks separately.

If a session cannot be verified due to a temporary service error, retry instead of signing in repeatedly. A 401 clears the session. Role updates are enforced by the API immediately and refreshed in the UI on window focus, reload or an authorization failure.

## Deployment

See `docs/deployment.md`. Apply committed migrations as an explicit deployment step before backend startup; the Dockerfile itself starts `node server.js`. Static hosting must rewrite deep links to `index.html` (Vercel and Nginx configurations are included). Set the correct production CORS origin and API base URL. Deployment is not part of local QA.

## License

MIT. See `LICENSE`.

## Platform UI verification

From `client`, run `npm run test:ui`, `npm run test:platform` and `npm run build`. The first checks component rendering with isolated fixtures; the second checks semantic color contrast and local font files. Neither replaces browser interaction, responsive-layout or runtime performance testing. Authenticated pages are loaded lazily, with a recovery screen for rendering/chunk failures. Profile payment history uses the existing self-or-admin API; no schema migration was needed for the platform refresh.

Local font provenance and OFL license files are in `client/public/fonts`. Sources: [Geist](https://github.com/vercel/geist-font) and [Inter](https://github.com/rsms/inter), distributed through Google Fonts.

## Permanent account deletion
Administrators can permanently delete another account from Resident Directory after an identifying confirmation. Self-deletion and removal of the final active admin are blocked; authorization always uses the current database role.

Migration `20261107140000_user_delete_preserve_records` makes eight account relationships nullable with `ON DELETE SET NULL`. Deletion removes the user row (login, password hash and profile). Complaints, status history, published notices/events/messages, reports, invoices and payments remain, with deleted-account fallbacks. Invoice unit/period/amount/reference and historical content remain for continuity; this is not a purge of all authored content or externally stored media. Existing JWTs cease to authenticate. Apply migrations with `npx prisma migrate deploy` from `server` and regenerate the Prisma client before starting the updated server.

## Maintenance

Keep server secrets in ignored environment files; .dockerignore also excludes them from images. Node 24 LTS is the supported deployment runtime. Backend source runs directly without a compilation step; Prisma Client generation is its required preparation. The Prisma CLI/client stay on matching 6.19.3 versions; the scoped deepmerge-ts override fixes its transitive advisory and is covered by Prisma validation/generation and database checks. Resend 6 uses the existing email API.

Useful documentation: [architecture](docs/architecture.md), [API](docs/api-reference.md), [database](docs/database-schema.md), [deployment](docs/deployment.md).
