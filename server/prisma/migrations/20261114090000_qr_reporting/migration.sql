-- SocietyCare currently registers accounts for the singleton configured society (id 1).
-- Only fresh installations without configuration need this initial configuration row.
INSERT INTO "Society" ("id", "name", "address", "description")
VALUES (1, 'SocietyCare', '', '') ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "users" ADD COLUMN "societyId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "assets" ADD COLUMN "societyId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "users" ADD CONSTRAINT "users_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "ComplaintSource" AS ENUM ('MANUAL', 'QR');
ALTER TABLE "complaints" ADD COLUMN "source" "ComplaintSource" NOT NULL DEFAULT 'MANUAL';
