-- CreateTable
CREATE TABLE "theme_discovery_runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "runDate" DATE NOT NULL,
    "runStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidates" JSONB NOT NULL,
    "digestText" TEXT,
    "digestSentAt" TIMESTAMP(3),
    "digestError" TEXT,
    "candidatesCount" INTEGER NOT NULL DEFAULT 0,
    "searchesUsed" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,

    CONSTRAINT "theme_discovery_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "theme_discovery_runs_userId_runDate_idx" ON "theme_discovery_runs"("userId", "runDate");

-- CreateIndex
CREATE INDEX "theme_discovery_runs_termId_runDate_idx" ON "theme_discovery_runs"("termId", "runDate");

-- CreateIndex
CREATE UNIQUE INDEX "theme_discovery_runs_userId_termId_runDate_key" ON "theme_discovery_runs"("userId", "termId", "runDate");

-- AddForeignKey
ALTER TABLE "theme_discovery_runs" ADD CONSTRAINT "theme_discovery_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theme_discovery_runs" ADD CONSTRAINT "theme_discovery_runs_termId_fkey" FOREIGN KEY ("termId") REFERENCES "monitor_terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
