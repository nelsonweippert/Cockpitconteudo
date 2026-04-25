import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { CoachClient } from "./CoachClient"

export const metadata = { title: "Coach · Content Hub" }

export default async function CoachPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const conversations = await db.coachConversation.findMany({
    where: { userId: session.user.id, archivedAt: null },
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      title: true,
      lastMessageAt: true,
      _count: { select: { messages: true } },
    },
    take: 50,
  })

  return (
    <CoachClient
      initialConversations={conversations.map((c) => ({
        id: c.id,
        title: c.title,
        lastMessageAt: c.lastMessageAt.toISOString(),
        messageCount: c._count.messages,
      }))}
    />
  )
}
