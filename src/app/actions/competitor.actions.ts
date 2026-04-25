"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { addCompetitor, removeCompetitor, pollCompetitor } from "@/services/competitor-tracker.service"
import type { ActionResult } from "@/types"

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Não autorizado")
  return session.user.id
}

export async function addCompetitorAction(input: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const result = await addCompetitor(userId, input)
    if (!result.ok) return { success: false, error: result.error }
    revalidatePath("/competidores")
    return { success: true, data: result.data }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" }
  }
}

export async function removeCompetitorAction(competitorId: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const ok = await removeCompetitor(userId, competitorId)
    if (!ok) return { success: false, error: "Competidor não encontrado" }
    revalidatePath("/competidores")
    return { success: true, data: null }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" }
  }
}

export async function pollCompetitorAction(competitorId: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const c = await db.competitorChannel.findFirst({ where: { id: competitorId, userId } })
    if (!c) return { success: false, error: "Competidor não encontrado" }
    const result = await pollCompetitor(competitorId)
    revalidatePath("/competidores")
    return { success: true, data: result }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" }
  }
}

export async function updateCompetitorNotesAction(competitorId: string, notes: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const c = await db.competitorChannel.findFirst({ where: { id: competitorId, userId } })
    if (!c) return { success: false, error: "Não encontrado" }
    await db.competitorChannel.update({
      where: { id: competitorId },
      data: { notes: notes.trim() || null },
    })
    return { success: true, data: null }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" }
  }
}
