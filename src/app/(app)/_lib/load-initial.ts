// Helper compartilhado — as pages que renderizam ConteudoClient precisam
// de { contents, areas } do usuário logado. Centraliza aqui pra não duplicar.

import { getContents } from "@/services/content.service"
import { getAreas } from "@/services/area.service"
import { requireUserId } from "./auth-helpers"

export async function loadInitialContentData() {
  const userId = await requireUserId()
  const [contents, areas] = await Promise.all([
    getContents(userId).catch(() => []),
    getAreas(userId).catch(() => []),
  ])
  return { contents, areas, userId }
}
