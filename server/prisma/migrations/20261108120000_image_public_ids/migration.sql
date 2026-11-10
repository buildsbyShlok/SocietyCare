-- Additive only: retain all existing records and image URLs.
ALTER TABLE "users" ADD COLUMN "avatarPublicId" TEXT;
ALTER TABLE "complaints" ADD COLUMN "photoPublicId" TEXT;
ALTER TABLE "Event" ADD COLUMN "imagePublicId" TEXT;
ALTER TABLE "CommunityMessage" ADD COLUMN "imagePublicId" TEXT;
