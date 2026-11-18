ALTER TABLE "users" ADD COLUMN "enrollmentPending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD CONSTRAINT "pending_residents_are_disabled" CHECK (NOT "enrollmentPending" OR ("disabled" AND "role" = 'RESIDENT'));
