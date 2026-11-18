# Deployment

No live deployment is assumed by this repository. Use your own HTTPS URLs and secrets.

## Runtime and database

Use a supported Node 24 LTS patch and PostgreSQL. See the [Node release schedule](https://github.com/nodejs/Release#release-schedule). Set server variables from README; JWT_SECRET must contain at least 32 random characters in production. Configure CLIENT_URL as the exact frontend origin.

Before release, back up the database, run `npx prisma migrate deploy` from server, and generate the Prisma client. Do not reset or seed an existing database. Run a single API instance until shared rate limiting and reverse-proxy trust have been configured and verified. Do not blindly trust forwarded client-IP headers.

## Backend

Without Docker: `npm ci`, `npx prisma generate`, apply migrations, then `NODE_ENV=production npm start` (PowerShell: set `$env:NODE_ENV='production'` first). The backend is plain JavaScript and has no transpilation build.

Docker build context is **server/**: `docker build -t societycare-api ./server`. The production stage runs as the node user and excludes local .env files, tests and Windows node_modules. Migrations are a separate release step; the `builder` stage retains the Prisma CLI for it. Hosting configuration must inject runtime secrets. Never pass secrets as build arguments; see [Docker build context documentation](https://docs.docker.com/build/concepts/context/).

## Frontend

From client, run `npm ci`. Set `VITE_PUBLIC_FRONTEND_URL` to the exact public HTTPS frontend origin and `VITE_API_URL` to the HTTPS API URL ending in /api (or /api with a same-origin proxy). Then run `npm run build`. Set backend `CLIENT_URL` to the same frontend origin. Rebuild when either public value changes. A changed host requires reprinting old physical labels or maintaining the old host redirect. Existing asset tokens stay valid. Host client/dist as static files. Vercel uses client as its project root and the existing vercel.json SPA rewrite. The Docker client uses nginx and includes SPA fallback routing. Rebuild when VITE_API_URL changes. Provider keys must never use a VITE_ prefix.

## Local Docker demonstration

Copy .env.compose.example to .env.compose and fill every required secret. COMPOSE_DATABASE_URL must use hostname postgres and credentials matching POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB; URL-encode special password characters.

Run `docker compose --env-file .env.compose up --build -d`. The migration service must succeed before the API starts. Frontend/API ports bind only to local loopback; PostgreSQL is internal and has a persistent named volume. This stack is for local demonstration, not an automatically exposed production deployment. Stop with `docker compose --env-file .env.compose down`; retain volumes.

## Administrator provisioning

Set ADMIN_EMAIL and ADMIN_PASSWORD (12 characters minimum, at most 72 UTF-8 bytes), optionally ADMIN_NAME/ADMIN_FLAT/ADMIN_PHONE, then explicitly run `node prisma/create-admin.js` from server. It never promotes or changes an existing resident. Use the authorized directory for role changes. Clear provisioning password variables afterward.

Resend delivery requires a valid API key and verified FROM_EMAIL. Missing email configuration is supported but email must be tested before promising notifications. Verify Cloudinary, Groq, HTTPS/CORS, database backups, restore procedures and provider quotas in the chosen hosting environment.
