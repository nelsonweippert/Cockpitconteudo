import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getContents } from "@/services/content.service"
import { getAreas } from "@/services/area.service"
import { ConteudoClient } from "./ConteudoClient"

export default async function ConteudoPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const [contents, areas] = await Promise.all([
    getContents(session.user.id).catch(() => []),
    getAreas(session.user.id).catch(() => []),
  ])
  return <ConteudoClient initialContents={contents} areas={areas} />
}
