// POST /api/coach/chat — stream da resposta do coach via Server-Sent Events.
// Body: { conversationId, message }
// Resposta: stream de eventos `data: {"type":"text","content":"..."}\n\n`
// Final: `data: {"type":"done","usage":{...},"title":"..."}\n\n`

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { streamCoachReply, generateConversationTitle } from "@/services/coach.service"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401 })
  const userId = session.user.id

  let body: { conversationId?: string; message?: string }
  try { body = await req.json() } catch { return new Response(JSON.stringify({ error: "Body inválido" }), { status: 400 }) }
  if (!body.conversationId || typeof body.message !== "string" || !body.message.trim()) {
    return new Response(JSON.stringify({ error: "conversationId e message obrigatórios" }), { status: 400 })
  }

  // Verifica que a conversa pertence ao user
  const conv = await db.coachConversation.findFirst({
    where: { id: body.conversationId, userId },
    select: { id: true, title: true },
  })
  if (!conv) return new Response(JSON.stringify({ error: "Conversa não encontrada" }), { status: 404 })

  // Conta mensagens (pra decidir se vamos auto-titular depois)
  const msgCountBefore = await db.coachMessage.count({ where: { conversationId: conv.id } })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }
      try {
        const { usage } = await streamCoachReply({
          userId,
          conversationId: conv.id,
          userMessage: body.message!,
          onText: (delta) => send({ type: "text", content: delta }),
        })

        // Auto-titulação: se era a primeira troca (0 msgs antes), gera título
        let newTitle: string | null = null
        if (msgCountBefore === 0 || conv.title === "Nova conversa") {
          newTitle = await generateConversationTitle(conv.id)
        }

        send({ type: "done", usage, title: newTitle })
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro no chat"
        console.error("[coach/chat]", err)
        send({ type: "error", error: msg })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  })
}
