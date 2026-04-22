"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import type { ActionResult } from "@/types"

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Não autorizado")
  return session.user.id
}

export async function getSkillSourcesAction(skillId: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const sources = await db.skillSource.findMany({
      where: { userId, skillId },
      orderBy: { createdAt: "desc" },
    })
    return { success: true, data: sources }
  } catch { return { success: false, error: "Erro ao buscar fontes" } }
}

export async function addSkillSourceAction(data: {
  skillId: string
  title: string
  url?: string
  content?: string
  type: string
}): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const source = await db.skillSource.create({
      data: { ...data, userId },
    })
    revalidatePath("/conteudo")
    return { success: true, data: source }
  } catch { return { success: false, error: "Erro ao adicionar fonte" } }
}

export async function deleteSkillSourceAction(id: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    await db.skillSource.delete({ where: { id, userId } })
    revalidatePath("/conteudo")
    return { success: true, data: null }
  } catch { return { success: false, error: "Erro ao remover fonte" } }
}
