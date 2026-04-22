// Migra dados do banco antigo (cockpit-produtividade) para o Content-HUB.
//
// Uso:
//   OLD_DATABASE_URL="postgres://..." npm run migrate:from-cockpit
//
// Copia em ordem (respeitando FKs): User → Area → MonitorTerm → NewsEvidence
// → IdeaFeed → Content → ContentArea → SkillSource → ApiUsage.
//
// Idempotente via upsert por id: pode rodar várias vezes sem duplicar.

import { config as loadEnv } from "dotenv"
loadEnv({ path: ".env.local" })
loadEnv()

import { PrismaClient as NewPrisma } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const OLD_URL = process.env.OLD_DATABASE_URL
if (!OLD_URL) {
  console.error("OLD_DATABASE_URL não definida no .env.local. Defina pro banco antigo do cockpit-produtividade.")
  process.exit(1)
}

// Cliente NEW via Prisma (schema novo)
const newAdapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const neo = new NewPrisma({ adapter: newAdapter })

// Cliente OLD via pg direto (sem tipos — query manual)
const oldClient = new pg.Client({ connectionString: OLD_URL })

async function fetchAll<T>(table: string): Promise<T[]> {
  const res = await oldClient.query(`SELECT * FROM "${table}"`)
  return res.rows as T[]
}

async function main() {
  console.log("Conectando no banco antigo…")
  await oldClient.connect()

  try {
    // 1. Users
    const users = await fetchAll<any>("users")
    console.log(`\n→ Users: ${users.length}`)
    for (const u of users) {
      await neo.user.upsert({
        where: { id: u.id },
        create: { id: u.id, name: u.name, email: u.email, password: u.password, createdAt: u.createdAt, updatedAt: u.updatedAt },
        update: { name: u.name, email: u.email, password: u.password },
      })
    }

    // 2. Areas
    const areas = await fetchAll<any>("areas")
    console.log(`→ Areas: ${areas.length}`)
    for (const a of areas) {
      await neo.area.upsert({
        where: { id: a.id },
        create: { id: a.id, name: a.name, color: a.color, icon: a.icon, description: a.description, isArchived: a.isArchived, userId: a.userId, createdAt: a.createdAt, updatedAt: a.updatedAt },
        update: { name: a.name, color: a.color, icon: a.icon, description: a.description, isArchived: a.isArchived },
      })
    }

    // 3. MonitorTerms (já com sources Json, sourcesUpdatedAt)
    const terms = await fetchAll<any>("monitor_terms")
    console.log(`→ MonitorTerms: ${terms.length}`)
    for (const t of terms) {
      await neo.monitorTerm.upsert({
        where: { id: t.id },
        create: { id: t.id, term: t.term, intent: t.intent, isActive: t.isActive, sources: t.sources, sourcesUpdatedAt: t.sourcesUpdatedAt, userId: t.userId, createdAt: t.createdAt, updatedAt: t.updatedAt },
        update: { term: t.term, intent: t.intent, isActive: t.isActive, sources: t.sources, sourcesUpdatedAt: t.sourcesUpdatedAt },
      })
    }

    // 4. NewsEvidence (antes de IdeaFeed por causa da FK evidenceId)
    const evidence = await fetchAll<any>("news_evidence")
    console.log(`→ NewsEvidence: ${evidence.length}`)
    for (const e of evidence) {
      await neo.newsEvidence.upsert({
        where: { id: e.id },
        create: {
          id: e.id, term: e.term, url: e.url, title: e.title, publishedAt: e.publishedAt,
          summary: e.summary, keyQuote: e.keyQuote, sourceAuthority: e.sourceAuthority, language: e.language,
          relevanceScore: e.relevanceScore, freshnessHours: e.freshnessHours, processed: e.processed,
          capturedAt: e.capturedAt, userId: e.userId,
        },
        update: {
          title: e.title, summary: e.summary, keyQuote: e.keyQuote, sourceAuthority: e.sourceAuthority,
          language: e.language, relevanceScore: e.relevanceScore, freshnessHours: e.freshnessHours, processed: e.processed,
        },
      })
    }

    // 5. IdeaFeed
    const ideas = await fetchAll<any>("idea_feed")
    console.log(`→ IdeaFeed: ${ideas.length}`)
    for (const i of ideas) {
      await neo.ideaFeed.upsert({
        where: { id: i.id },
        create: {
          id: i.id, title: i.title, summary: i.summary, angle: i.angle, source: i.source, sourceUrl: i.sourceUrl,
          publishedAt: i.publishedAt, language: i.language, pioneerScore: i.pioneerScore, relevance: i.relevance,
          hook: i.hook, term: i.term, score: i.score,
          evidenceId: i.evidenceId, evidenceQuote: i.evidenceQuote,
          supportingEvidenceIds: i.supportingEvidenceIds ?? [],
          viralScore: i.viralScore, publisherHosts: i.publisherHosts ?? [],
          hasInternationalCoverage: i.hasInternationalCoverage, platformFit: i.platformFit,
          isUsed: i.isUsed, isDiscarded: i.isDiscarded, isFavorite: i.isFavorite ?? false,
          createdAt: i.createdAt, userId: i.userId,
        },
        update: {
          title: i.title, summary: i.summary, angle: i.angle, isUsed: i.isUsed, isDiscarded: i.isDiscarded,
          isFavorite: i.isFavorite ?? false, platformFit: i.platformFit,
        },
      })
    }

    // 6. Content
    const contents = await fetchAll<any>("contents")
    console.log(`→ Content: ${contents.length}`)
    for (const c of contents) {
      await neo.content.upsert({
        where: { id: c.id },
        create: {
          id: c.id, title: c.title, platform: c.platform, format: c.format, phase: c.phase, rawVideoUrl: c.rawVideoUrl,
          skill: c.skill, targetDuration: c.targetDuration, hook: c.hook, script: c.script, ideaFeedId: c.ideaFeedId,
          tags: c.tags ?? [], thumbnailNotes: c.thumbnailNotes, research: c.research, titleOptions: c.titleOptions ?? [],
          description: c.description, hashtags: c.hashtags ?? [], checklist: c.checklist, plannedDate: c.plannedDate,
          publishedAt: c.publishedAt, publishedUrl: c.publishedUrl, notes: c.notes, isArchived: c.isArchived,
          createdAt: c.createdAt, updatedAt: c.updatedAt, userId: c.userId, areaId: c.areaId,
        },
        update: {
          title: c.title, phase: c.phase, skill: c.skill, targetDuration: c.targetDuration, hook: c.hook,
          script: c.script, research: c.research, description: c.description, notes: c.notes,
        },
      })
    }

    // 7. ContentAreas (pivô)
    const contentAreas = await fetchAll<any>("content_areas")
    console.log(`→ ContentArea: ${contentAreas.length}`)
    for (const ca of contentAreas) {
      try {
        await neo.contentArea.upsert({
          where: { contentId_areaId: { contentId: ca.contentId, areaId: ca.areaId } },
          create: { contentId: ca.contentId, areaId: ca.areaId },
          update: {},
        })
      } catch (e) {
        console.warn(`  skip ContentArea ${ca.contentId}/${ca.areaId}: ${(e as Error).message}`)
      }
    }

    // 8. SkillSource
    const skillSources = await fetchAll<any>("skill_sources")
    console.log(`→ SkillSource: ${skillSources.length}`)
    for (const s of skillSources) {
      await neo.skillSource.upsert({
        where: { id: s.id },
        create: { id: s.id, skillId: s.skillId, title: s.title, url: s.url, content: s.content, type: s.type, userId: s.userId, createdAt: s.createdAt },
        update: { title: s.title, url: s.url, content: s.content, type: s.type },
      })
    }

    // 9. ApiUsage (opcional — historial de uso)
    const apiUsage = await fetchAll<any>("api_usage")
    console.log(`→ ApiUsage: ${apiUsage.length}`)
    for (const u of apiUsage) {
      await neo.apiUsage.upsert({
        where: { id: u.id },
        create: {
          id: u.id, action: u.action, model: u.model, inputTokens: u.inputTokens, outputTokens: u.outputTokens,
          costUsd: u.costUsd, durationMs: u.durationMs, createdAt: u.createdAt, userId: u.userId,
        },
        update: {},
      })
    }

    console.log("\n✓ Migração concluída.")
  } finally {
    await oldClient.end()
    await neo.$disconnect()
  }
}

main().catch(async (err) => {
  console.error("ERRO:", err)
  try { await oldClient.end() } catch {}
  try { await neo.$disconnect() } catch {}
  process.exit(1)
})
