# SocietyCare API reference

Base path: `/api`. JSON responses unless otherwise noted. Protected endpoints require `Authorization: Bearer <JWT>`. The middleware verifies the signature and loads the current user role from PostgreSQL on every request. A missing/deleted identity receives 401; insufficient permissions receive 403. Error responses contain `message`; validation errors may contain `errors`.

## Authentication

| Method and path | Behavior |
| --- | --- |
| `POST /auth/register` | Body: `name`, `email`, `password` (8+ chars), `flatNumber`, optional `phone`. An optional active equipment `qrToken` routes the request to its society. Creates a disabled pending resident. Response 201 `{message}`. |
| `PATCH /users/:id/enrollment` | Same-society admin approves a pending resident after verifying their identity, request and unit. Login becomes available. |
| `POST /auth/login` | Body: `email`, `password`; response `{message, token, user}`. |
| `GET /auth/me` | Protected; current profile as `{user}`. |
| `POST /auth/logout` | Clears legacy token cookie; client also removes its local Bearer token. Does not revoke JWTs server-side. |

Login limits failed attempts to 15 per IP per 15 minutes. Registration has a separate 15-attempt window. Session restoration and logout are outside these limiters.

## Asset management and QR identification

Asset management endpoints require a current, enabled ADMIN account, including reads. The sole public exception is `GET /assets/qr/:qrToken`, described below. Unauthorized management requests return 401/403.

| Method and path | Behavior |
| --- | --- |
| `GET /assets?page=1&limit=12&search=...` | Returns `{items,total,page,hasNext}`; newest first. Limit capped at 100. `search` matches asset name/code. `options=true` returns the compact picker fields used by the complaint filter. |
| `POST /assets` | Creates an ACTIVE asset; returns the asset with status 201. |
| `GET /assets/:id` | Returns an asset, or 404. |
| `PUT /assets/:id` | Replaces editable details; preserves status, QR token and creation date. |
| `PATCH /assets/:id/status` | Body `{status:"ACTIVE"}` or `{status:"INACTIVE"}`; returns the updated asset. |
| `DELETE /assets/:id` | Permanently removes an unused asset. Returns 409 when any complaint history is linked, preserving the audit trail. |
| `GET /assets/:id/complaints?page=1&limit=10` | Returns only that asset's non-deleted complaint history plus `byStatus`, pagination and total. Archived entries remain visible to admins. |

Create/update fields: required `name` (120 chars), `assetCode` (64), `location` (240), `category` (80); optional `description` (2000, defaults to empty). Codes are trimmed, normalized to uppercase and restricted to ASCII letters, numbers, hyphens and underscores, beginning with a letter/number. Duplicate codes return 409, including concurrent writes. Unknown fields are rejected with 400. QR tokens contain 32 cryptographically random bytes, generated only on the server, and cannot be changed through these APIs.

The admin detail page creates a PNG QR for `<frontend-origin>/report/<qrToken>`. Legacy Phase 1 `/report/asset/<qrToken>` links remain supported. Generate final labels on the deployed origin. `DELETE /assets/:id` removes only an asset with no linked complaints; linked assets return 409 and must be deactivated to preserve complaint history.

`GET /assets/qr/:qrToken` is public and returns only `{name,assetCode,location,category}` with `Cache-Control: no-store`. It never returns asset IDs, society IDs, descriptions, tokens or timestamps. Invalid/unknown tokens return 404; inactive assets return 410. Rate limit: 60 lookups per IP per minute.

QR reports reuse `POST /complaints`, authenticated RESIDENT only: JSON or multipart fields `qrToken`, `title` (5–100 chars), `description` (10–2000), `priority` (LOW/MEDIUM/HIGH), plus optional multipart `photo` (JPEG/PNG/WebP, 5 MB). Other QR body fields, including category/assetId/residentId/societyId/source, are rejected. The server resolves the active asset and verifies current database membership; it sets residentId, assetId and source=QR itself. The asset category is mapped to an existing complaint enum when it matches, otherwise OTHER. Response remains 201 `{message,complaint}`. QR submissions are limited to 10 per resident per 10 minutes; 429 includes Retry-After. These limits do not apply to normal complaint creation. After uploads the database transaction takes shared user/asset row locks and rechecks authorization before inserting.

Anonymous visitors can read equipment identification; choosing Sign in to report opens the existing login page with a restricted local `returnTo` destination. Login/registration and switching between their pages preserve the full report path, query and hash. External destinations are rejected.

## Complaint endpoints

| Method and path | Access / response |
| --- | --- |
| `GET /complaints` | Residents see their own, admins see all complaints in their society. Returns `{currentPage,totalPages,totalItems,hasNextPage,hasPreviousPage,items}`. Filters: `status`, `category`, `priority`, `search`, `date`, `source=QR|MANUAL`, `assetId`; pagination: `page`, `limit`. `UNRESOLVED` means OPEN or IN_PROGRESS. Each item includes `source` and, when linked, a limited asset summary (`id`, name, code, category, location), never a QR token. |
| `POST /complaints` | Resident only. JSON or multipart: `title` (5–100 chars), `description` (10–2000), `category`, `priority`, optional `photo` (JPEG/PNG/WebP, 5 MB). Response 201 `{message,complaint}`. |
| `GET /complaints/:id` | Owner or an admin in the complaint's society. Returns `{complaint}` with `id`, source, title/description/category/priority/status, `isOverdue`, nullable `photoUrl`, timestamps, `resident`, optional limited asset summary and chronological `history`. Missing/out-of-society record: 404; another resident's record: 403. |
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
| `GET /dashboard` | Role-scoped complaint counts, category totals and recent activity. Admin results additionally include `assets`: active/inactive counts, QR complaint count, open linked-asset complaints and up to five most-reported assets. Asset metrics exclude archived/removed complaints and are scoped to the current society. |
| `GET /users?search=...` | Admin directory: `{success:true,data:[...]}`. |
| `PATCH /users/:id/role` | Admin: `{role:"ADMIN"}` or `{role:"RESIDENT"}`; self-role changes forbidden. Existing JWT privileges follow the updated database role on the next request. |
| `PATCH /users/profile` | Own profile: name/phone/flatNumber and optional multipart `avatar` (JPEG/PNG/WebP, 2 MB). |

## Society workspace API

| Routes under /api | Behavior |
| --- | --- |
| GET /society, PATCH /society | Authenticated settings, tower names and registered unit count. Only admins can edit settings. |
| GET /users/:id/record | Owner or admin profile and complaint history. |
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
