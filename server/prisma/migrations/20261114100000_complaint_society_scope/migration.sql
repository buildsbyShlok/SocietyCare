-- Persist ownership independently of nullable resident/asset relationships.
ALTER TABLE "complaints" ADD COLUMN "societyId" INTEGER;
UPDATE "complaints" c SET "societyId" = COALESCE(
  (SELECT a."societyId" FROM "assets" a WHERE a."id" = c."assetId"),
  (SELECT u."societyId" FROM "users" u WHERE u."id" = c."residentId"),
  1 -- Retained legacy records originated in the original singleton installation.
);
ALTER TABLE "complaints" ALTER COLUMN "societyId" SET NOT NULL;
ALTER TABLE "complaints" ALTER COLUMN "societyId" SET DEFAULT 1;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "complaints_societyId_createdAt_idx" ON "complaints"("societyId", "createdAt");
CREATE INDEX "complaints_societyId_assetId_idx" ON "complaints"("societyId", "assetId");
CREATE INDEX "assets_societyId_status_idx" ON "assets"("societyId", "status");
