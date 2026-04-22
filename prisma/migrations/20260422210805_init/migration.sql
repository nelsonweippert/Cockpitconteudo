-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'TWITCH', 'OTHER');

-- CreateEnum
CREATE TYPE "ContentFormat" AS ENUM ('LONG_VIDEO', 'SHORT', 'REELS', 'POST', 'LIVE', 'THREAD');

-- CreateEnum
CREATE TYPE "ContentPhase" AS ENUM ('IDEATION', 'ELABORATION', 'BRIEFING', 'EDITING_SENT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentSkill" AS ENUM ('SHORT_VIDEO', 'LONG_VIDEO', 'INSTAGRAM', 'INSTAGRAM_REELS', 'YOUTUBE_SHORTS', 'YOUTUBE_VIDEO', 'TIKTOK_VIDEO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#00D6AB',
    "icon" TEXT NOT NULL DEFAULT '📁',
    "description" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "platform" "Platform" NOT NULL DEFAULT 'YOUTUBE',
    "format" "ContentFormat" NOT NULL DEFAULT 'LONG_VIDEO',
    "phase" "ContentPhase" NOT NULL DEFAULT 'IDEATION',
    "rawVideoUrl" TEXT,
    "skill" "ContentSkill",
    "targetDuration" INTEGER,
    "hook" TEXT,
    "script" TEXT,
    "ideaFeedId" TEXT,
    "tags" TEXT[],
    "thumbnailNotes" TEXT,
    "research" TEXT,
    "titleOptions" TEXT[],
    "description" TEXT,
    "hashtags" TEXT[],
    "checklist" JSONB,
    "plannedDate" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedUrl" TEXT,
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "areaId" TEXT,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_areas" (
    "contentId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,

    CONSTRAINT "content_areas_pkey" PRIMARY KEY ("contentId","areaId")
);

-- CreateTable
CREATE TABLE "content_metrics" (
    "id" TEXT NOT NULL,
    "views" INTEGER,
    "reach" INTEGER,
    "engagement" DOUBLE PRECISION,
    "ctr" DOUBLE PRECISION,
    "retention" DOUBLE PRECISION,
    "newFollowers" INTEGER,
    "directRevenue" DOUBLE PRECISION,
    "notes" TEXT,
    "contentId" TEXT NOT NULL,

    CONSTRAINT "content_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "api_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitor_terms" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "intent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sources" JSONB,
    "sourcesUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "monitor_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_feed" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "angle" TEXT,
    "source" TEXT,
    "sourceUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "language" TEXT DEFAULT 'pt-BR',
    "pioneerScore" INTEGER,
    "relevance" TEXT,
    "hook" TEXT,
    "term" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 90,
    "evidenceId" TEXT,
    "evidenceQuote" TEXT,
    "supportingEvidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "viralScore" INTEGER,
    "publisherHosts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasInternationalCoverage" BOOLEAN NOT NULL DEFAULT false,
    "platformFit" JSONB,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "isDiscarded" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "idea_feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_evidence" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "summary" TEXT NOT NULL,
    "keyQuote" TEXT,
    "sourceAuthority" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "relevanceScore" INTEGER NOT NULL DEFAULT 50,
    "freshnessHours" INTEGER,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "news_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_sources" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "content" TEXT,
    "type" TEXT NOT NULL DEFAULT 'source',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "skill_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "areas_userId_idx" ON "areas"("userId");

-- CreateIndex
CREATE INDEX "contents_userId_phase_idx" ON "contents"("userId", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "content_metrics_contentId_key" ON "content_metrics"("contentId");

-- CreateIndex
CREATE INDEX "api_usage_userId_createdAt_idx" ON "api_usage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "api_usage_userId_action_idx" ON "api_usage"("userId", "action");

-- CreateIndex
CREATE INDEX "monitor_terms_userId_idx" ON "monitor_terms"("userId");

-- CreateIndex
CREATE INDEX "idea_feed_userId_createdAt_idx" ON "idea_feed"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "idea_feed_userId_isUsed_isDiscarded_idx" ON "idea_feed"("userId", "isUsed", "isDiscarded");

-- CreateIndex
CREATE INDEX "idea_feed_userId_publishedAt_idx" ON "idea_feed"("userId", "publishedAt");

-- CreateIndex
CREATE INDEX "idea_feed_evidenceId_idx" ON "idea_feed"("evidenceId");

-- CreateIndex
CREATE INDEX "news_evidence_userId_capturedAt_idx" ON "news_evidence"("userId", "capturedAt");

-- CreateIndex
CREATE INDEX "news_evidence_userId_term_capturedAt_idx" ON "news_evidence"("userId", "term", "capturedAt");

-- CreateIndex
CREATE INDEX "news_evidence_userId_processed_idx" ON "news_evidence"("userId", "processed");

-- CreateIndex
CREATE UNIQUE INDEX "news_evidence_userId_url_key" ON "news_evidence"("userId", "url");

-- CreateIndex
CREATE INDEX "skill_sources_userId_skillId_idx" ON "skill_sources"("userId", "skillId");

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_areas" ADD CONSTRAINT "content_areas_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_areas" ADD CONSTRAINT "content_areas_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_metrics" ADD CONSTRAINT "content_metrics_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitor_terms" ADD CONSTRAINT "monitor_terms_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_feed" ADD CONSTRAINT "idea_feed_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "news_evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_feed" ADD CONSTRAINT "idea_feed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_evidence" ADD CONSTRAINT "news_evidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_sources" ADD CONSTRAINT "skill_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
