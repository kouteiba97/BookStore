-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('facebook', 'instagram');

-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('draft', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "SocialSettings" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "tokenCheckedAt" TIMESTAMP(3),
    "pageId" TEXT,
    "pageName" TEXT,
    "igUserId" TEXT,
    "igUsername" TEXT,
    "calendar" JSONB,
    "autoApproveHours" INTEGER NOT NULL DEFAULT 48,
    "tickLockedUntil" TIMESTAMP(3),
    "lastTickAt" TIMESTAMP(3),
    "alertsSent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialChannel" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "pausedReason" TEXT,
    "pausedAt" TIMESTAMP(3),
    "blockedUntil" TIMESTAMP(3),
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastPublishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "status" "SocialPostStatus" NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "autoApproveAt" TIMESTAMP(3),
    "caption" TEXT NOT NULL,
    "imageUrl" TEXT,
    "remoteId" TEXT,
    "containerId" TEXT,
    "permalink" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "error" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialSettings_storeId_key" ON "SocialSettings"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialChannel_storeId_platform_key" ON "SocialChannel"("storeId", "platform");

-- CreateIndex
CREATE INDEX "SocialPost_storeId_status_scheduledAt_idx" ON "SocialPost"("storeId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "SocialPost_bookId_platform_scheduledAt_idx" ON "SocialPost"("bookId", "platform", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPost_storeId_platform_scheduledAt_key" ON "SocialPost"("storeId", "platform", "scheduledAt");

-- AddForeignKey
ALTER TABLE "SocialSettings" ADD CONSTRAINT "SocialSettings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialChannel" ADD CONSTRAINT "SocialChannel_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

