"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createContent, updateContent, archiveContent } from "@/services/content.service"
import type { ActionResult } from "@/types"

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Não autorizado")
  return session.user.id
}

export async function createContentAction(data: Record<string, unknown>): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const content = await createContent(userId, data as any)
    revalidatePath("/conteudo")
    return { success: true, data: content }
  } catch { return { success: false, error: "Erro ao criar conteúdo" } }
}

export async function updateContentAction(id: string, data: Record<string, unknown>): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const content = await updateContent(id, userId, data as any)
    revalidatePath("/conteudo")
    return { success: true, data: content }
  } catch { return { success: false, error: "Erro ao atualizar conteúdo" } }
}

export async function advanceContentPhaseAction(id: string, phase: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const content = await updateContent(id, userId, { phase: phase as any })
    revalidatePath("/conteudo")
    return { success: true, data: content }
  } catch { return { success: false, error: "Erro ao avançar fase" } }
}

export async function archiveContentAction(id: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    await archiveContent(id, userId)
    revalidatePath("/conteudo")
    return { success: true, data: null }
  } catch { return { success: false, error: "Erro ao arquivar conteúdo" } }
}

// Busca as fontes (evidências) associadas ao Content via IdeaFeed.ideaFeedId
// Retorna cards estruturados pra UI (Briefing, Elaboration, etc).
export async function getContentReferencesAction(contentId: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const content = await db.content.findFirst({
      where: { id: contentId, userId },
      select: { ideaFeedId: true },
    })
    if (!content?.ideaFeedId) {
      return { success: true, data: { primary: null, supporting: [] } }
    }
    const idea = await db.ideaFeed.findFirst({
      where: { id: content.ideaFeedId, userId },
      include: {
        evidence: true,
      },
    })
    if (!idea) return { success: true, data: { primary: null, supporting: [] } }

    const supIds = idea.supportingEvidenceIds ?? []
    const supporting = supIds.length > 0
      ? await db.newsEvidence.findMany({ where: { id: { in: supIds }, userId } })
      : []

    const mapEvidence = (ev: typeof idea.evidence | typeof supporting[number] | null) => {
      if (!ev) return null
      let host = ""
      try { host = new URL(ev.url).hostname.replace(/^www\./, "") } catch {}
      return {
        id: ev.id,
        title: ev.title,
        url: ev.url,
        host,
        publisher: host,
        language: ev.language,
        summary: ev.summary,
        keyQuote: ev.keyQuote,
        publishedAt: ev.publishedAt,
        sourceAuthority: ev.sourceAuthority,
        relevanceScore: ev.relevanceScore,
      }
    }

    return {
      success: true,
      data: {
        primary: mapEvidence(idea.evidence),
        supporting: supporting.map((s) => mapEvidence(s)).filter(Boolean),
        // Metadata adicional da ideia
        ideaTitle: idea.title,
        ideaTerm: idea.term,
        viralScore: idea.viralScore,
        hasInternationalCoverage: idea.hasInternationalCoverage,
      },
    }
  } catch (err) {
    console.error("[getContentReferences]", err)
    return { success: false, error: "Erro ao buscar referências" }
  }
}
