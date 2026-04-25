-- CreateTable
CREATE TABLE "platform_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalName" TEXT NOT NULL,
    "externalHandle" TEXT,
    "thumbnailUrl" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),

    CONSTRAINT "platform_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platformConnectionId" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscribers" BIGINT NOT NULL,
    "totalViews" BIGINT NOT NULL,
    "videoCount" INTEGER NOT NULL,
    "extras" JSONB,

    CONSTRAINT "channel_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_connections_userId_platform_idx" ON "platform_connections"("userId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "platform_connections_userId_platform_externalId_key" ON "platform_connections"("userId", "platform", "externalId");

-- CreateIndex
CREATE INDEX "channel_snapshots_platformConnectionId_takenAt_idx" ON "channel_snapshots"("platformConnectionId", "takenAt");

-- CreateIndex
CREATE INDEX "channel_snapshots_userId_takenAt_idx" ON "channel_snapshots"("userId", "takenAt");

-- AddForeignKey
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_snapshots" ADD CONSTRAINT "channel_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_snapshots" ADD CONSTRAINT "channel_snapshots_platformConnectionId_fkey" FOREIGN KEY ("platformConnectionId") REFERENCES "platform_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
