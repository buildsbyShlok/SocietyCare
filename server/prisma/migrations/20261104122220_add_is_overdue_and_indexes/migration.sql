-- DropForeignKey
ALTER TABLE "complaint_history" DROP CONSTRAINT "complaint_history_complaintId_fkey";

-- AlterTable
ALTER TABLE "complaints" ADD COLUMN     "isOverdue" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarUrl" TEXT;

-- CreateIndex
CREATE INDEX "complaint_history_complaintId_idx" ON "complaint_history"("complaintId");

-- CreateIndex
CREATE INDEX "complaint_history_changedById_idx" ON "complaint_history"("changedById");

-- CreateIndex
CREATE INDEX "complaint_history_createdAt_idx" ON "complaint_history"("createdAt");

-- CreateIndex
CREATE INDEX "complaints_residentId_idx" ON "complaints"("residentId");

-- CreateIndex
CREATE INDEX "complaints_status_idx" ON "complaints"("status");

-- CreateIndex
CREATE INDEX "complaints_category_idx" ON "complaints"("category");

-- CreateIndex
CREATE INDEX "complaints_priority_idx" ON "complaints"("priority");

-- CreateIndex
CREATE INDEX "complaints_isOverdue_idx" ON "complaints"("isOverdue");

-- CreateIndex
CREATE INDEX "complaints_createdAt_idx" ON "complaints"("createdAt");

-- CreateIndex
CREATE INDEX "notices_authorId_idx" ON "notices"("authorId");

-- CreateIndex
CREATE INDEX "notices_isPinned_idx" ON "notices"("isPinned");

-- CreateIndex
CREATE INDEX "notices_createdAt_idx" ON "notices"("createdAt");

-- AddForeignKey
ALTER TABLE "complaint_history" ADD CONSTRAINT "complaint_history_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
