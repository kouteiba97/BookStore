-- AlterTable
ALTER TABLE "SocialSettings" ADD COLUMN     "digest" JSONB,
ADD COLUMN     "digestSentAt" TIMESTAMP(3);

