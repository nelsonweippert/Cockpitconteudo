import { db } from "@/lib/db"
import { CoachClient } from "./CoachClient"
import { requireUserId } from "../_lib/auth-helpers"

export const metadata = { title: "Coach · Content Hub" }

export default async function CoachPage() {
  const userId = await requireUserId()

  const conversations = await db.coachConversation.findMany({
    where: { userId, archivedAt: null },
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
