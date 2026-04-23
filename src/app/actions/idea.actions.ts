"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"
import type { ActionResult } from "@/types"

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Não autorizado")
  return session.user.id
}

// ── Monitor Terms ───────────────────────────────────────────────────────

export async function getMonitorTermsAction(): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const terms = await db.monitorTerm.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })
    return { success: true, data: terms }
  } catch { return { success: false, error: "Erro ao buscar termos" } }
}

export async function addMonitorTermAction(term: string, intent?: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const created = await db.monitorTerm.create({
      data: { term, intent: intent?.trim() || null, userId },
    })
    revalidatePath("/conteudo")
    return { success: true, data: created }
  } catch { return { success: false, error: "Erro ao adicionar termo" } }
}

export async function updateMonitorTermIntentAction(id: string, intent: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const clean = intent.trim()
    await db.monitorTerm.update({
      where: { id, userId },
      data: { intent: clean.length > 0 ? clean : null },
    })
    revalidatePath("/conteudo")
    return { success: true, data: null }
  } catch { return { success: false, error: "Erro ao atualizar intenção" } }
}

export async function toggleMonitorTermAction(id: string, isActive: boolean): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    await db.monitorTerm.update({ where: { id, userId }, data: { isActive } })
    return { success: true, data: null }
  } catch { return { success: false, error: "Erro ao atualizar termo" } }
}

export async function deleteMonitorTermAction(id: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    await db.monitorTerm.delete({ where: { id, userId } })
    revalidatePath("/conteudo")
    return { success: true, data: null }
  } catch { return { success: false, error: "Erro ao remover termo" } }
}

// ── Term Sources ────────────────────────────────────────────────────────
// Descoberta de fontes (pipeline de 3 estágios, ~2min) roda via API route dedicada
// em /api/content/sources/discover (maxDuration=300). Server actions tem timeout
// curto que corta o pipeline no meio.
//
// Aqui só o update simples (toggle/remove/add manual), que é síncrono.

export async function updateTermSourcesAction(termId: string, sources: unknown[]): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const updated = await db.monitorTerm.update({
      where: { id: termId, userId },
      data: { sources: sources as unknown as Prisma.InputJsonValue },
    })
    revalidatePath("/conteudo")
    return { success: true, data: updated }
  } catch { return { success: false, error: "Erro ao atualizar fontes" } }
}

// ── Idea Feed ───────────────────────────────────────────────────────────

export async function getIdeasAction(): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const ideas = await db.ideaFeed.findMany({
      where: { userId, isDiscarded: false },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
    return { success: true, data: ideas }
  } catch { return { success: false, error: "Erro ao buscar ideias" } }
}

export async function discardIdeaAction(id: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    await db.ideaFeed.update({ where: { id, userId }, data: { isDiscarded: true } })
    return { success: true, data: null }
  } catch { return { success: false, error: "Erro ao descartar ideia" } }
}

export async function markIdeaUsedAction(id: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    await db.ideaFeed.update({ where: { id, userId }, data: { isUsed: true } })
    return { success: true, data: null }
  } catch { return { success: false, error: "Erro" } }
}

export async function toggleIdeaFavoriteAction(id: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const current = await db.ideaFeed.findFirst({ where: { id, userId }, select: { isFavorite: true } })
    if (!current) return { success: false, error: "Ideia não encontrada" }
    const updated = await db.ideaFeed.update({
      where: { id, userId },
      data: { isFavorite: !current.isFavorite },
      select: { isFavorite: true },
    })
    return { success: true, data: updated }
  } catch { return { success: false, error: "Erro ao favoritar" } }
}

// Novo modo: usuário dá UM tema/palavra-chave, pipeline roda focado gerando 1 ideia pesquisada.
// Não usa monitor terms. Não persiste o tema (não adiciona em MonitorTerm).
export async function generateIdeaForThemeAction(theme: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const clean = theme.trim()
    if (!clean) return { success: false, error: "Tema obrigatório" }
    if (clean.length > 100) return { success: false, error: "Tema muito longo (máx 100)" }

    const { generateIdeasWithResearch, safeDate } = await import("@/services/ai.service")
    const { ideas, usage } = await generateIdeasWithResearch({
      terms: [clean],
      ideasPerTerm: 1,
      hoursWindow: 72,
      language: "both",
      userId,
    })

    if (ideas.length === 0) {
      const stage = usage.candidatesFromRss === 0
        ? "discovery (nenhuma matéria encontrada pra esse tema nas últimas 72h)"
        : usage.qualifiedAfterTriage === 0
        ? `triagem (${usage.candidatesFromRss} candidatos lidos, nenhum passou)`
        : "narrativa (fontes insuficientes)"
      return { success: false, error: `Nenhuma ideia gerada — travou em: ${stage}` }
    }

    const created = await db.ideaFeed.createMany({
      data: ideas.map((idea) => ({
        title: idea.title,
        summary: idea.summary,
        angle: idea.angle,
        hook: idea.hook,
        term: idea.term,
        relevance: idea.relevance,
        source: idea.sourceTitle,
        sourceUrl: idea.sourceUrl,
        publishedAt: safeDate(idea.publishedAt),
        language: idea.language ?? "pt-BR",
        pioneerScore: idea.pioneerScore,
        evidenceId: idea.evidenceId,
        evidenceQuote: idea.evidenceQuote,
        supportingEvidenceIds: idea.supportingEvidenceIds,
        viralScore: idea.viralScore,
        publisherHosts: idea.publisherHosts,
        hasInternationalCoverage: idea.hasInternationalCoverage,
        platformFit: idea.platformFit as unknown as Prisma.InputJsonValue,
        score: Math.min(100, Math.max(0, idea.pioneerScore)),
        userId,
      })),
    })

    console.log(`[generateIdeaForTheme] user=${userId} theme="${clean}" rss=${usage.candidatesFromRss} qualified=${usage.qualifiedAfterTriage} ideas=${created.count}`)

    revalidatePath("/conteudo")
    return {
      success: true,
      data: {
        count: created.count,
        theme: clean,
        candidatesFromRss: usage.candidatesFromRss,
      },
    }
  } catch (err) {
    console.error("[generateIdeaForTheme]", err)
    const msg = err instanceof Error ? err.message : "Erro ao gerar ideia"
    return { success: false, error: msg }
  }
}

export async function generateIdeasNowAction(termIds?: string[]): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    // Se termIds fornecido, usa só esses. Caso contrário, pega todos ativos (legado).
    const where = termIds && termIds.length > 0
      ? { userId, id: { in: termIds } }
      : { userId, isActive: true }
    const terms = await db.monitorTerm.findMany({ where })
    if (terms.length === 0) {
      return {
        success: false,
        error: termIds && termIds.length > 0
          ? "Nenhum tema selecionado encontrado"
          : "Adicione termos de monitoramento primeiro",
      }
    }

    const { generateIdeasWithResearch, safeDate } = await import("@/services/ai.service")
    const termNames = terms.map((t) => t.term)

    const { ideas, usage } = await generateIdeasWithResearch({
      terms: termNames,
      ideasPerTerm: 2,
      hoursWindow: 72,
      language: "both",
      userId,
    })

    if (ideas.length === 0) {
      const stage = usage.candidatesFromRss === 0
        ? "discovery (RSS + web_search não trouxeram matérias válidas)"
        : usage.qualifiedAfterTriage === 0
        ? `triagem (${usage.candidatesFromRss} candidatos lidos, nenhum com relevance ≥ 70 ou todos violaram intent)`
        : "narrativa (fontes insuficientes para gerar ideia)"
      return {
        success: false,
        error: `Nenhuma ideia gerada — travou em: ${stage}. Counts: discovery=${usage.candidatesFromRss}, triagem=${usage.qualifiedAfterTriage}, apoio=${usage.supportingFound}.`,
      }
    }

    const created = await db.ideaFeed.createMany({
      data: ideas.map((idea) => ({
        title: idea.title,
        summary: idea.summary,
        angle: idea.angle,
        hook: idea.hook,
        term: idea.term,
        relevance: idea.relevance,
        source: idea.sourceTitle,
        sourceUrl: idea.sourceUrl,
        publishedAt: safeDate(idea.publishedAt),
        language: idea.language ?? "pt-BR",
        pioneerScore: idea.pioneerScore,
        evidenceId: idea.evidenceId,
        evidenceQuote: idea.evidenceQuote,
        supportingEvidenceIds: idea.supportingEvidenceIds,
        viralScore: idea.viralScore,
        publisherHosts: idea.publisherHosts,
        hasInternationalCoverage: idea.hasInternationalCoverage,
        platformFit: idea.platformFit as unknown as Prisma.InputJsonValue,
        score: Math.min(100, Math.max(0, idea.pioneerScore)),
        userId,
      })),
    })

    console.log(`[generateIdeasNow] user=${userId} rss=${usage.candidatesFromRss} qualified=${usage.qualifiedAfterTriage} supporting=${usage.supportingFound} ideas=${created.count} searches=${usage.searchesUsed} fetches=${usage.fetchesUsed}`)

    revalidatePath("/conteudo")
    revalidatePath("/conteudo/radar")
    return {
      success: true,
      data: {
        count: created.count,
        candidatesFromRss: usage.candidatesFromRss,
        qualifiedAfterTriage: usage.qualifiedAfterTriage,
        supportingFound: usage.supportingFound,
        evidencesCaptured: usage.evidencesCaptured,
      },
    }
  } catch (err) {
    console.error("[generateIdeasNow]", err)
    const msg = err instanceof Error ? err.message : "Erro ao gerar ideias"
    return { success: false, error: msg }
  }
}
