# SocietyCare architecture

SocietyCare is one React 19 / Vite SPA and one Express API, backed by PostgreSQL through Prisma 6. React Router handles public and role-protected pages. No MongoDB, repository layer or separate AI server is used.

## Layout

- `client/src/pages`: route screens, including the public Welcome page, resident portal and admin console.
- `client/src/components`: shared UI, data-loading helpers, dialogs, metric components and the CSS 3D society.
- `client/src/api`, `context`, `utils`, `styles`: HTTP requests, authentication state, helpers and shared design tokens.
- `client/public`: favicon and self-hosted fonts with their licenses.
- `server/src/routes`: API routing and authorization. Small society/event/community handlers remain colocated with their routes.
- `server/src/controllers` and `services`: response handling, business rules, database transactions and provider integrations.
- `server/src/middleware`, `validations`, `config`, `utils`: authentication/RBAC, input validation, environment/provider setup and reusable helpers.
- `server/prisma`: schema, immutable migration history and guarded provisioning/demo scripts.
- Each application's `tests` directory contains its own automated checks.

## Request and data boundaries

Protected requests verify an HS256 JWT, then reload the active database identity. Role changes, disabled accounts and permanent deletion therefore take effect on the next request. Resident complaint and profile access is ownership-scoped. Duplicate analysis uses complaints the requesting role may access.

Complaint status changes and history are transactional. Archive and deletion preserve complaint data. Permanent user deletion sets nullable foreign keys to null, preserving authored content and audit history. Legacy invoice/payment rows remain in the database but are deliberately not exposed by current product code. Role/deletion operations serialize the final-admin check with a PostgreSQL advisory lock.

Uploads use Multer memory storage, validate content/type/size, and stream to Cloudinary with a deadline. PostgreSQL stores HTTPS URLs and public IDs. Groq is optional, returns validated suggestions, and cannot prevent manual complaint submission. Resend email is best effort and sent individually.

## Frontend behavior

Shared light/dark tokens live in `client/src/styles/variables.css`; the surrounding CSS defines layout and components. Native dialogs provide focus containment. The three-tower society is illustrative CSS 3D geometry, not recorded building inventory. Its camera moves only during pointer dragging; vehicles and vegetation animate independently, with a reduced-motion fallback.

API response envelopes are endpoint-specific and documented in `api-reference.md`. Do not change them globally without updating callers. The client keeps its JWT in localStorage; XSS prevention and trusted script hosting remain important. Rate-limit stores are process-local: multi-instance hosting requires a reviewed shared-store/proxy setup.
