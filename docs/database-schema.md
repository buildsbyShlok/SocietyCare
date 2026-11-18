# Database schema

The authoritative definition is `server/prisma/schema.prisma`. Committed migrations are additive history and must not be edited after application.

| Model | Purpose and integrity |
| --- | --- |
| User / users | Unique normalized email, bcrypt password, current role, disabled flag, unit/profile fields, avatar URL/public ID |
| Complaint / complaints | Resident report, category/priority/status, manual/QR source, optional asset and required society ownership, attachment URL/public ID, overdue flag, archive/deletion actor/time/reason |
| ComplaintHistory / complaint_history | Transactional append-only status/remark audit linked to a complaint |
| Notice / notices | Admin-authored title, full content, category, pin flag and publication timestamps |
| Society | Single configuration row with name, address, description and flat count |
| Event | Creator, title/description, UTC start time, location, poster URL/public ID and soft-removal timestamp |
| CommunityMessage | Sender, body, optional image URL/public ID, reply relationship and moderation metadata |
| MessageReport | One report per message/reporter; private admin moderation queue |
| Bill / Payment | Legacy preserved billing records; no current route, service or UI exposes them |

User deletion uses nullable `ON DELETE SET NULL` relationships for complaints, history actors, notices, legacy bills/payment verifiers, messages, reports and event creators. It does **not** cascade-delete these records. The application soft-deletes complaints/events and moderates messages. Complaint-history rows have a database cascade if a complaint is physically deleted, but no application route physically deletes complaints.

Image public-ID columns are nullable for legacy records. Existing hosted URLs remain valid. Complaint categories include PLUMBING, ELECTRICAL, CLEANING, SECURITY, LIFT, PARKING and OTHER.

Use `prisma validate`, `prisma migrate status`, `prisma migrate deploy`, then `prisma generate`. Never reset an existing database or use demo seeding to provision real data. The opt-in PostgreSQL regression test creates isolated fixtures in a transaction and rolls them back.

## Assets (Phase 1)

Migration `20261113100000_asset_management` adds `Asset` mapped to `assets`: cuid ID, name, unique normalized assetCode, description, location, category, unique server-generated qrToken, ACTIVE/INACTIVE AssetStatus, and timestamps. An index on createdAt/id supports the asset register ordering.

`Complaint.assetId` is nullable and indexed, referencing Asset with `ON DELETE SET NULL`. Existing complaints retain NULL and continue through the existing complaint APIs; QR submissions resolve asset linkage exclusively from the token on the backend; normal submissions cannot supply an assetId. Asset edits and deactivation retain the token and any future linked complaint history. No existing rows or applied migrations are replaced.

## QR reports and admin integration (Phases 2–3)

Migration `20261114090000_qr_reporting` adds ComplaintSource (MANUAL/QR), with existing complaints defaulting to MANUAL. User and Asset each gain a required societyId foreign key with default 1 and ON DELETE RESTRICT. Existing records are associated with the configured singleton society; an empty configuration record named SocietyCare is initialized only for fresh installations with no Society 1. Existing society settings are preserved. Membership cannot be selected through registration or asset request bodies. Multiple society rows are supported for membership checks, but management/provisioning and other platform modules remain single-society.

QR complaints use the existing Complaint, attachment and ComplaintHistory relationships. Tests exercise another society inside a rolled-back transaction, including current-session membership changes, asset deactivation, forged linkage, and ordinary manual complaint compatibility. No separate QR complaint table is introduced.

Migration `20261114100000_complaint_society_scope` adds required `Complaint.societyId` with a Society foreign key and indexes `(societyId, createdAt)` and `(societyId, assetId)`; it also adds `(societyId, status)` for assets. The additive backfill uses a linked asset's society, otherwise the reporting user's society, otherwise the original Society 1 for retained legacy rows. Nothing is deleted or reassigned across an existing valid asset/user relation. This ownership supports admin QR/manual filters, asset complaint histories, status updates and dashboard equipment metrics without relying on nullable links.
