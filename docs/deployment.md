# Deployment

No live deployment is assumed by this repository. Use your own HTTPS URLs and secrets.

## Runtime and database

Use a supported Node 24 LTS patch and PostgreSQL. See the [Node release schedule](https://github.com/nodejs/Release#release-schedule). Set server variables from README; JWT_SECRET must contain at least 32 random characters in production. Configure CLIENT_URL as the exact frontend origin.

Prisma uses `DATABASE_URL` for application queries and `DIRECT_URL` for migration commands. Both must select the intended database and schema. For a local database without a pooler, use the same connection string for both.

Before release, back up the database, run `npx prisma migrate deploy` from server, and generate the Prisma client. Do not reset or seed an existing database. Run a single API instance until shared rate limiting and reverse-proxy trust have been configured and verified. Do not blindly trust forwarded client-IP headers.

## Backend

Without Docker: `npm ci`, `npx prisma generate`, apply migrations, then `NODE_ENV=production npm start` (PowerShell: set `$env:NODE_ENV='production'` first). The backend is plain JavaScript and has no transpilation build.

Docker build context is **server/**: `docker build -t societycare-api ./server`. The production stage runs as the node user and excludes local .env files, tests and Windows node_modules. Migrations are a separate release step; the `builder` stage retains the Prisma CLI for it. Hosting configuration must inject runtime secrets. Never pass secrets as build arguments; see [Docker build context documentation](https://docs.docker.com/build/concepts/context/).

## Frontend

From client, run `npm ci`. Set `VITE_PUBLIC_FRONTEND_URL` to the exact public HTTPS frontend origin and `VITE_API_URL` to the HTTPS API URL ending in /api (or /api with a same-origin proxy). Then run `npm run build`. Set backend `CLIENT_URL` to the same frontend origin. Rebuild when either public value changes. A changed host requires reprinting old physical labels or maintaining the old host redirect. Existing asset tokens stay valid. Host client/dist as static files. Vercel uses client as its project root and the existing vercel.json SPA rewrite. The Docker client uses nginx and includes SPA fallback routing. Rebuild when VITE_API_URL changes. Provider keys must never use a VITE_ prefix.

## Local Docker demonstration

Copy .env.compose.example to .env.compose and fill every required secret. COMPOSE_DATABASE_URL must use hostname postgres and credentials matching POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB; URL-encode special password characters.

The checked-in Compose file passes only DATABASE_URL. When using Compose, supply a local Compose override that maps DIRECT_URL to the same internal PostgreSQL connection in the migration and API services. Verify the resolved targets privately before startup.

Run `docker compose --env-file .env.compose up --build -d`. The migration service must succeed before the API starts. Frontend/API ports bind only to local loopback; PostgreSQL is internal and has a persistent named volume. This stack is for local demonstration, not an automatically exposed production deployment. Stop with `docker compose --env-file .env.compose down`; retain volumes.

## Administrator provisioning

Set ADMIN_EMAIL and ADMIN_PASSWORD (12 characters minimum, at most 72 UTF-8 bytes), optionally ADMIN_NAME/ADMIN_FLAT/ADMIN_PHONE, then explicitly run `node prisma/create-admin.js` from server. It never promotes or changes an existing resident. Use the authorized directory for role changes. Clear provisioning password variables afterward.

Resend delivery requires a valid API key and verified FROM_EMAIL. Missing email configuration is supported but email must be tested before promising notifications. Verify Cloudinary, Groq, HTTPS/CORS, database backups, restore procedures and provider quotas in the chosen hosting environment.

## Enrollment rollout

Take older registration handlers out of service before admitting registration traffic. Apply the additive migrations and regenerate Prisma Client before starting the updated API. Existing accounts retain their prior access. Reconcile pre-enrollment accounts with the resident roster. Approve new requests only after independently verifying the requester, their unit and that they initiated the request.

Configure PostgreSQL TLS according to the host's requirements. For historical data from multiple societies, verify the complaint ownership backfill on a restored copy before upgrading. When using a same-origin /api, proxy API requests to Express before applying the frontend rewrite.

## Staging acceptance checklist


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

With both DATABASE_URL and DIRECT_URL pointed at the disposable restore database, run npx prisma migrate deploy and npx prisma migrate status from server. Compare user, asset, complaint and history counts at the backup snapshot, verify an existing label still identifies the same equipment and confirm approved and pending login behaviour. Record the restore duration and result. Protect and expire the backup according to the owner’s retention policy.
