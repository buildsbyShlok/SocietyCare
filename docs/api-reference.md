# SocietyCare API reference

Base path: `/api`. JSON responses unless otherwise noted. Protected endpoints require `Authorization: Bearer <JWT>`. The middleware verifies the signature and loads the current user role from PostgreSQL on every request. A missing/deleted identity receives 401; insufficient permissions receive 403. Error responses contain `message`; validation errors may contain `errors`.

## Authentication

| Method and path | Behavior |
| --- | --- |
| `POST /auth/register` | Body: `name`, `email`, `password` (8+ chars), `flatNumber`, optional `phone`. Always creates RESIDENT; response 201 `{message, token, user}`. |
| `POST /auth/login` | Body: `email`, `password`; response `{message, token, user}`. |
| `GET /auth/me` | Protected; current profile as `{user}`. |
| `POST /auth/logout` | Clears legacy token cookie; client also removes its local Bearer token. Does not revoke JWTs server-side. |

Login limits failed attempts to 15 per IP per 15 minutes. Registration has a separate 15-attempt window. Session restoration and logout are outside these limiters.

## Complaints

| Method and path | Access / response |
| --- | --- |
| `GET /complaints` | Residents see their own, admins see all. Returns `{currentPage,totalPages,totalItems,hasNextPage,hasPreviousPage,items}`. Filters: `status`, `category`, `priority`, `search`, `date`; pagination: `page`, `limit`. `UNRESOLVED` means OPEN or IN_PROGRESS. |
| `POST /complaints` | Resident only. JSON or multipart: `title` (5–100 chars), `description` (10–2000), `category`, `priority`, optional `photo` (JPEG/PNG/WebP, 5 MB). Response 201 `{message,complaint}`. |
| `GET /complaints/:id` | Owner or admin. Returns `{complaint}` with `id`, title/description/category/priority/status, `isOverdue`, nullable `photoUrl`, timestamps, `resident` and chronological `history`. Missing record: 404; other resident's record: 403. |
| `PATCH /complaints/:id/status` | Admin only. Body: `status` and/or `priority`, optional `remark`. Response `{message,complaint}`. Update and history entry are transactional. |

Statuses: `OPEN`, `IN_PROGRESS`, `RESOLVED`. Allowed transitions: OPEN → IN_PROGRESS/RESOLVED, IN_PROGRESS → RESOLVED. Priorities: LOW/MEDIUM/HIGH. Categories: PLUMBING/ELECTRICAL/CLEANING/SECURITY/LIFT/PARKING/OTHER.

History entries include `id`, `fromStatus`, `toStatus`, nullable `remark`, `createdAt` and `changedBy.name`.

## Notices, dashboard and profiles

| Method and path | Access / behavior |
| --- | --- |
| `GET /notices` | All signed-in users; paginated notices. |
| `POST /notices` | Admin: `title`, `content`, optional `isPinned`; returns `{message,notice}`. |
| `PATCH /notices/:id` | Admin: edit `title` and `content`; returns `{message,notice}`. |
| `PATCH /notices/:id/pin` | Admin: toggle pin; returns `{message,notice}`. |
| `DELETE /notices/:id` | Admin: permanent removal; returns `{message}`. |
| `GET /dashboard` | Role-scoped complaint counts, category totals and recent activity. |
| `GET /users?search=...` | Admin directory: `{success:true,data:[...]}`. |
| `PATCH /users/:id/role` | Admin: `{role:"ADMIN"}` or `{role:"RESIDENT"}`; self-role changes forbidden. Existing JWT privileges follow the updated database role on the next request. |
| `PATCH /users/profile` | Own profile: name/phone/flatNumber and optional multipart `avatar` (JPEG/PNG/WebP, 2 MB). |

## Society workspace API

| Routes under /api | Behavior |
| --- | --- |
| GET /society, PATCH /society | Authenticated settings, tower names and registered unit count. Only admins can edit settings. |
| GET /billing, POST /billing | Owner-scoped invoices or society ledger for admins. Admins issue by residentId, month, amount and dueDate. |
| POST /billing/:id/payment | Admin verifies full payment by external reference. Unique invoice/receipt and reference constraints. |
| GET /users/:id/record | Owner or admin profile, complaint history and verified payments. |
| POST /complaints/:id/archive | Admin records reason, actor and timestamp. Admin GET /complaints?archived=true lists archived tickets. |
| GET /community, POST /community | Read 50 recent messages, or earlier messages with before cursor. Send body up to 1,000 characters. |
| POST /community/:id/report | Report by reason once per user per message. |
| GET /community/reports, DELETE /community/:id | Admin report queue and soft removal. |

## Optional AI integrations

Both routes require authentication. Request body is `{ "complaint": "free-text description" }`.

- `POST /ai/analyze-complaint`: 20–5000 characters; `{success:true,data:{title,category,priority,refinedDescription,summary,reasoning,confidence}}`. Confidence is numeric 0–100.
- `POST /ai/detect-duplicates`: 10–5000 characters; `{success:true,data:[...]}` with matching complaint IDs, titles and similarity information.

These are the only supported AI routes. Missing Groq configuration returns 503. Missing Cloudinary configuration returns 503 when uploading an image; text-only submissions are supported. Email is best effort and has no direct send endpoint.

Duplicate detection is scoped to the requesting resident's own active complaints; admins can compare society-wide active complaints. AI routes allow 12 requests per authenticated account per minute and return controlled 429/503/504 errors for quota/configuration/timeouts. Normal complaint creation does not require AI. Complaint/notice pagination defaults to 10 records and is capped at 100 per page; invalid/negative values fall back to defaults.
