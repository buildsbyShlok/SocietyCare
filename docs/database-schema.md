# Database schema

The authoritative definition is `server/prisma/schema.prisma`. Committed migrations are additive history and must not be edited after application.

| Model | Purpose and integrity |
| --- | --- |
| User / users | Unique normalized email, bcrypt password, current role, disabled flag, unit/profile fields, avatar URL/public ID |
| Complaint / complaints | Resident report, category/priority/status, attachment URL/public ID, overdue flag, archive/deletion actor/time/reason |
| ComplaintHistory / complaint_history | Transactional append-only status/remark audit linked to a complaint |
| Notice / notices | Admin-authored title, full content, category, pin flag and publication timestamps |
| Society | Single configuration row with name, address, description, flat count and optional maintenance information |
| Event | Creator, title/description, UTC start time, location, poster URL/public ID and soft-removal timestamp |
| CommunityMessage | Sender, body, optional image URL/public ID, reply relationship and moderation metadata |
| MessageReport | One report per message/reporter; private admin moderation queue |
| Bill | Immutable unit/month snapshot, decimal amount, due date and optional resident; unique tower/flat/month |
| Payment | Unique invoice and reference, verifier identity and receipt time |

User deletion uses nullable `ON DELETE SET NULL` relationships for complaints, history actors, notices, bills, payment verifiers, messages, reports and event creators. It does **not** cascade-delete these records. The application soft-deletes complaints/events and moderates messages. Complaint-history rows have a database cascade if a complaint is physically deleted, but no application route physically deletes complaints.

Image public-ID columns are nullable for legacy records. Existing hosted URLs remain valid. Amounts use `Decimal(12,2)`; billing periods are YYYY-MM and due dates are date-only. Complaint categories include PLUMBING, ELECTRICAL, CLEANING, SECURITY, LIFT, PARKING and OTHER.

Use `prisma validate`, `prisma migrate status`, `prisma migrate deploy`, then `prisma generate`. Never reset an existing database or use demo seeding to provision real data. The opt-in PostgreSQL regression test creates isolated fixtures in a transaction and rolls them back.
