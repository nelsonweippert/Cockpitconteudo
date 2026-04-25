-- CreateTable
CREATE TABLE "competitor_channels" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalName" TEXT NOT NULL,
    "externalHandle" TEXT,
    "thumbnailUrl" TEXT,
    "subscribers" BIGINT,
    "totalViews" BIGINT,
    "videoCount" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),

    CONSTRAINT "competitor_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "competitorChannelId" TEXT,
    "videoId" TEXT NOT NULL,
    "videoTitle" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "durationSec" INTEGER,
    "thumbnailUrl" TEXT,
    "views" BIGINT NOT NULL,
    "likes" INTEGER NOT NULL,
    "comments" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewsPerHour" DOUBLE PRECISION,
    "outlierMultiplier" DOUBLE PRECISION,

    CONSTRAINT "video_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competitor_channels_userId_isActive_idx" ON "competitor_channels"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_channels_userId_platform_externalId_key" ON "competitor_channels"("userId", "platform", "externalId");

-- CreateIndex
CREATE INDEX "video_snapshots_userId_origin_takenAt_idx" ON "video_snapshots"("userId", "origin", "takenAt");

-- CreateIndex
CREATE INDEX "video_snapshots_videoId_takenAt_idx" ON "video_snapshots"("videoId", "takenAt");

-- CreateIndex
CREATE INDEX "video_snapshots_channelId_takenAt_idx" ON "video_snapshots"("channelId", "takenAt");

-- CreateIndex
CREATE INDEX "video_snapshots_competitorChannelId_takenAt_idx" ON "video_snapshots"("competitorChannelId", "takenAt");

-- AddForeignKey
ALTER TABLE "competitor_channels" ADD CONSTRAINT "competitor_channels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_snapshots" ADD CONSTRAINT "video_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_snapshots" ADD CONSTRAINT "video_snapshots_competitorChannelId_fkey" FOREIGN KEY ("competitorChannelId") REFERENCES "competitor_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
