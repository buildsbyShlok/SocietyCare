-- Preserve complaint and history records when removing archived tickets from views.
ALTER TABLE "complaints" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
