-- AlterTable
ALTER TABLE "CommunityMessage" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "replyToId" TEXT;

-- CreateIndex
CREATE INDEX "CommunityMessage_replyToId_idx" ON "CommunityMessage"("replyToId");

-- AddForeignKey
ALTER TABLE "CommunityMessage" ADD CONSTRAINT "CommunityMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "CommunityMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

