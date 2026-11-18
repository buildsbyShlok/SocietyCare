CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assets_assetCode_key" ON "assets"("assetCode");
CREATE UNIQUE INDEX "assets_qrToken_key" ON "assets"("qrToken");
CREATE INDEX "assets_createdAt_id_idx" ON "assets"("createdAt", "id");
ALTER TABLE "complaints" ADD COLUMN "assetId" TEXT;
CREATE INDEX "complaints_assetId_idx" ON "complaints"("assetId");
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
