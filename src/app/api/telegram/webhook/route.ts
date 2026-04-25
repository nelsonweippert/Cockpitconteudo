// Webhook do Telegram — recebe updates (mensagens) e roteia.
//
// Proteção: header X-Telegram-Bot-Api-Secret-Token deve bater com TELEGRAM_WEBHOOK_SECRET.
// Telegram envia esse header automaticamente quando setWebhook(secret_token=X).
//
// Comandos suportados:
//   /start, /help — boas-vindas e ajuda
//   /coach <pergunta> — pergunta direta ao coach
//   <texto livre> — também é tratado como pergunta ao coach
//
// Resposta: 200 OK rápido. Coach roda síncrono dentro do maxDuration.

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sendMessage, editMessage, escapeMdV2 } from "@/services/telegram.service"
import { generateCoachReply, generateConversationTitle } from "@/services/coach.service"

export const runtime = "nodejs"
export const maxDuration = 120 // coach pode levar ~30-60s; timeout 120 dá margem

type TgUpdate = {
  update_id: number
  message?: {
    message_id: number
    from?: { id: number; first_name?: string; username?: string }
    chat: { id: number; type: string }
    date: number
    text?: string
  }
}

// Helper: pega ou cria conversa única "📱 Telegram" pro user (memória persistente do bot)
async function getOrCreateTelegramConversation(userId: string): Promise<string> {
  const TG_TITLE = "📱 Telegram"
  const existing = await db.coachConversation.findFirst({
    where: { userId, title: TG_TITLE, archivedAt: null },
    select: { id: true },
  })
  if (existing) return existing.id
  const created = await db.coachConversation.create({
    data: { userId, title: TG_TITLE },
    select: { id: true },
  })
  return created.id
}

export async function POST(req: NextRequest) {
  // 1. Validação do secret token
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) {
    console.error("[telegram/webhook] TELEGRAM_WEBHOOK_SECRET não configurado")
    return NextResponse.json({ ok: false, error: "webhook não configurado" }, { status: 500 })
  }
  const provided = req.headers.get("x-telegram-bot-api-secret-token")
  if (provided !== expected) {
    console.warn("[telegram/webhook] secret token inválido (provided vs expected diferentes)")
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 })
  }

  // 2. Parse update
  let update: TgUpdate
  try {
    update = (await req.json()) as TgUpdate
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 })
  }

  if (!update.message?.text || !update.message?.chat) {
    // Tipo de update que não tratamos (edited_message, etc.) — só 200 ok
    return NextResponse.json({ ok: true })
  }

  const chatId = String(update.message.chat.id)
  const text = update.message.text.trim()
  const messageId = update.message.message_id

  // 3. Identifica o user pelo chatId
  const user = await db.user.findFirst({
    where: { telegramChatId: chatId },
    select: { id: true, name: true },
  })
  if (!user) {
    // Chat não vinculado — responde com instrução
    await sendMessage({
      chatId,
      text: `Olá\\! Esse chat ainda não está vinculado a uma conta do Cockpit Conteúdo\\.

Pra vincular:
1\\. Acesse o cockpit no navegador
2\\. Vá em /bot
3\\. Cole o seu chatId: \`${escapeMdV2(chatId)}\`
4\\. Clique em "Salvar"

Depois disso, qualquer mensagem aqui vira uma pergunta pro Coach\\.`,
    })
    return NextResponse.json({ ok: true })
  }

  // 4. Roteia comandos
  if (text === "/start" || text === "/help" || text === "/start@" || text.startsWith("/help ")) {
    const name = escapeMdV2(user.name || "criador")
    await sendMessage({
      chatId,
      text: `Olá, ${name}\\! Eu sou o Coach do Cockpit Conteúdo\\.

*Como me usar*
\\- Mande qualquer pergunta direta \\(ex: "o que produzi semana passada?"\\)
\\- Ou use \`/coach <pergunta>\` explicitamente
\\- Eu leio os dados do seu cockpit \\(temas, ideias, conteúdos, custo de IA\\) a cada mensagem

*Exemplos*
\\- O que está parado no funil\\?
\\- Quais ideias favoritadas valem virar conteúdo essa semana\\?
\\- Resuma o que produzi nos últimos 30 dias

A conversa aqui é persistente \\(memória entre mensagens\\)\\. Pra ver o histórico completo no navegador, abra /coach no cockpit\\.`,
    })
    return NextResponse.json({ ok: true })
  }

  // Extrai pergunta — /coach <texto> ou texto livre
  let question = text
  if (text.startsWith("/coach ")) question = text.slice(7).trim()
  else if (text.startsWith("/coach")) {
    // /coach sem pergunta
    await sendMessage({
      chatId,
      text: `Use \`/coach <pergunta>\` ou simplesmente mande sua pergunta direto\\. Ex:\n\n\`/coach o que está em produção?\``,
    })
    return NextResponse.json({ ok: true })
  } else if (text.startsWith("/")) {
    // Outro comando não reconhecido
    await sendMessage({
      chatId,
      text: `Comando \`${escapeMdV2(text.split(" ")[0])}\` desconhecido\\. Use /help pra ver opções\\.`,
    })
    return NextResponse.json({ ok: true })
  }

  if (!question) {
    return NextResponse.json({ ok: true })
  }

  // 5. Manda "pensando..." imediatamente (UX: feedback rápido)
  const pendingMsg = await sendMessage({
    chatId,
    text: "🤔 _Pensando\\.\\.\\. \\(20\\-60s\\)_",
  })
  const pendingMessageId = pendingMsg.ok ? pendingMsg.messageId : null

  // 6. Roda coach
  try {
    const conversationId = await getOrCreateTelegramConversation(user.id)
    const reply = await generateCoachReply({
      userId: user.id,
      conversationId,
      userMessage: question,
    })

    // Auto-titulação na 1ª resposta — não muda título "📱 Telegram" mas deixamos o helper tentar
    // (ele só renomeia se title === "Nova conversa", então é no-op aqui)
    await generateConversationTitle(conversationId).catch(() => {})

    // 7. Telegram tem limite de 4096 chars por msg; se passar, quebra em pedaços.
    // Tentamos editar o "pensando..." pra primeira parte; resto vão como msgs novas.
    const safeText = escapeReplyForTelegram(reply)
    const chunks = chunkText(safeText, 3800)

    if (pendingMessageId !== null) {
      await editMessage({ chatId, messageId: pendingMessageId, text: chunks[0] })
    } else {
      await sendMessage({ chatId, text: chunks[0] })
    }

    for (let i = 1; i < chunks.length; i++) {
      await sendMessage({ chatId, text: chunks[i] })
    }
  } catch (err) {
    console.error("[telegram/webhook] coach falhou:", err)
    const msg = err instanceof Error ? err.message : "erro desconhecido"
    const errText = `❌ Erro ao consultar o Coach: ${escapeMdV2(msg.slice(0, 200))}\n\nTente novamente, ou abra /coach no cockpit web\\.`
    if (pendingMessageId !== null) {
      await editMessage({ chatId, messageId: pendingMessageId, text: errText })
    } else {
      await sendMessage({ chatId, text: errText })
    }
  }

  // Resposta `_id` original é ignorada por Telegram, só importa 200 OK
  void messageId
  return NextResponse.json({ ok: true })
}

// Telegram MarkdownV2 é estrito — tem que escapar caracteres especiais.
// Mas o coach gera markdown legível (bold, listas), e MarkdownV2 não tem essas
// construções intuitivamente. Estratégia: enviar como texto puro com escape total
// (preserva legibilidade, perde formatação rica). Bom o suficiente pro MVP.
function escapeReplyForTelegram(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1")
}

function chunkText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }
    // Quebra em \n mais próximo do limite pra não cortar palavra
    let breakAt = remaining.lastIndexOf("\n", maxLen)
    if (breakAt < maxLen / 2) breakAt = maxLen
    chunks.push(remaining.slice(0, breakAt))
    remaining = remaining.slice(breakAt).trimStart()
  }
  return chunks
}
