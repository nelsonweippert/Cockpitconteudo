// Helper compartilhado — as pages que renderizam ConteudoClient precisam
// de { contents, areas } do usuário logado. Centraliza aqui pra não duplicar.

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getContents } from "@/services/content.service"
import { getAreas } from "@/services/area.service"

export async function loadInitialContentData() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const [contents, areas] = await Promise.all([
    getContents(session.user.id).catch(() => []),
    getAreas(session.user.id).catch(() => []),
  ])
  return { contents, areas, userId: session.user.id }
}
