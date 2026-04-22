"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { createAreaSchema } from "@/validations/area.validation"
import { createArea, updateArea, archiveArea } from "@/services/area.service"
import type { ActionResult } from "@/types"

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Não autorizado")
  return session.user.id
}

export async function createAreaAction(data: unknown): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const parsed = createAreaSchema.safeParse(data)
    if (!parsed.success) return { success: false, error: "Dados inválidos" }
    const area = await createArea(userId, parsed.data)
    revalidatePath("/areas")
    return { success: true, data: area }
  } catch { return { success: false, error: "Erro ao criar área" } }
}

export async function archiveAreaAction(id: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    await archiveArea(id, userId)
    revalidatePath("/areas")
    return { success: true, data: null }
  } catch { return { success: false, error: "Erro ao arquivar área" } }
}
