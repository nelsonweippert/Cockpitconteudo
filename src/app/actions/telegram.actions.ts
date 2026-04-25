"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { sendMessage, getMe, escapeMdV2, setWebhook, deleteWebhook, getWebhookInfo } from "@/services/telegram.service"
import type { ActionResult } from "@/types"

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Não autorizado")
  return session.user.id
}

// Salva o chatId do Telegram no User. Valida formato (numérico, pode ser negativo p/ grupos).
export async function saveTelegramChatIdAction(chatId: string): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const clean = chatId.trim()
    if (!clean) {
      await db.user.update({ where: { id: userId }, data: { telegramChatId: null } })
      revalidatePath("/visao-geral")
      return { success: true, data: { chatId: null } }
    }
    // Telegram chat_id: inteiro (positivo p/ user, negativo p/ group/channel)
    if (!/^-?\d+$/.test(clean)) return { success: false, error: "chatId inválido — use o número que @userinfobot te enviou" }
    await db.user.update({ where: { id: userId }, data: { telegramChatId: clean } })
    revalidatePath("/visao-geral")
    return { success: true, data: { chatId: clean } }
  } catch (err) {
    console.error("[saveTelegramChatId]", err)
    return { success: false, error: err instanceof Error ? err.message : "Erro ao salvar" }
  }
}

// Envia mensagem de teste pro chatId vinculado. Valida também que o bot está configurado.
export async function sendTelegramTestAction(): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const user = await db.user.findUnique({ where: { id: userId }, select: { telegramChatId: true, name: true } })
    if (!user?.telegramChatId) return { success: false, error: "Vincule seu chatId primeiro" }

    // Checa se o bot está acessível (token válido)
    const me = await getMe()
    if (!me.ok) return { success: false, error: `Bot não responde: ${me.error}. Confira TELEGRAM_BOT_TOKEN.` }

    const name = escapeMdV2(user.name || "criador")
    const text = `🧪 *Teste — Cockpit Conteúdo*

Olá, ${name}\\! Seu bot *@${escapeMdV2(me.username)}* está vinculado\\.

A partir daqui você vai receber o *digest diário* com as principais novidades dos seus temas monitorados\\.`

    const sent = await sendMessage({ chatId: user.telegramChatId, text })
    if (!sent.ok) {
      // 403 = user bloqueou ou nunca deu /start no bot
      const hint = sent.code === 403
        ? " — abra o bot no Telegram e envie /start antes de testar"
        : sent.code === 400
        ? " — chatId pode estar errado, confira com @userinfobot"
        : ""
      return { success: false, error: `Falha ao enviar: ${sent.error}${hint}` }
    }
    return { success: true, data: { botUsername: me.username, messageId: sent.messageId } }
  } catch (err) {
    console.error("[sendTelegramTest]", err)
    return { success: false, error: err instanceof Error ? err.message : "Erro" }
  }
}

// Liga/desliga tema do digest. Tema continua ativo p/ geração de ideias.
export async function toggleDigestTermAction(termId: string, include: boolean): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    await db.monitorTerm.update({
      where: { id: termId, userId },
      data: { includeInDigest: include },
    })
    revalidatePath("/bot")
    return { success: true, data: { termId, includeInDigest: include } }
  } catch (err) {
    console.error("[toggleDigestTerm]", err)
    return { success: false, error: err instanceof Error ? err.message : "Erro" }
  }
}

// Lista temas ativos do user com flag includeInDigest e contagem de fontes.
export async function getDigestTermsAction(): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const terms = await db.monitorTerm.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, term: true, includeInDigest: true, sources: true },
    })
    const data = terms.map((t) => {
      const arr = Array.isArray(t.sources) ? (t.sources as unknown as { isActive?: boolean }[]) : []
      const activeSources = arr.filter((s) => s?.isActive !== false).length
      return {
        id: t.id,
        term: t.term,
        includeInDigest: t.includeInDigest,
        activeSources,
      }
    })
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" }
  }
}

// Lê status pra UI — se tem chatId e se o token do bot está OK.
export async function getTelegramStatusAction(): Promise<ActionResult> {
  try {
    const userId = await getUserId()
    const user = await db.user.findUnique({ where: { id: userId }, select: { telegramChatId: true } })
    const tokenConfigured = !!process.env.TELEGRAM_BOT_TOKEN
    let botUsername: string | null = null
    if (tokenConfigured) {
      const me = await getMe()
      if (me.ok) botUsername = me.username
    }
    // Webhook info
    const webhookSecretConfigured = !!process.env.TELEGRAM_WEBHOOK_SECRET
    let webhook: { url: string; pendingUpdates: number; lastError: string | null } | null = null
    if (tokenConfigured) {
      const info = await getWebhookInfo()
      if (info.ok) {
        webhook = {
          url: info.url,
          pendingUpdates: info.pendingUpdateCount,
          lastError: info.lastErrorMessage ?? null,
        }
      }
    }
    return {
      success: true,
      data: {
        chatId: user?.telegramChatId ?? null,
        tokenConfigured,
        botUsername,
        webhookSecretConfigured,
        webhook,
      },
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" }
  }
}

// Configura webhook do Telegram apontando pra essa instância.
// O user precisa fornecer a URL pública (ex: https://cockpitconteudo.vercel.app/api/telegram/webhook)
// porque em dev local, localhost não é alcançável pelo Telegram.
export async function setTelegramWebhookAction(publicUrl: string): Promise<ActionResult> {
  try {
    await getUserId() // só logado pode configurar
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (!secret) return { success: false, error: "TELEGRAM_WEBHOOK_SECRET não configurado no env" }
    const cleanUrl = publicUrl.trim().replace(/\/+$/, "")
    if (!cleanUrl.startsWith("https://")) {
      return { success: false, error: "URL precisa começar com https:// (Telegram exige)" }
    }
    const webhookUrl = cleanUrl.endsWith("/api/telegram/webhook") ? cleanUrl : `${cleanUrl}/api/telegram/webhook`
    const result = await setWebhook({ url: webhookUrl, secretToken: secret })
    if (!result.ok) return { success: false, error: result.error }
    return { success: true, data: { url: webhookUrl } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" }
  }
}

export async function deleteTelegramWebhookAction(): Promise<ActionResult> {
  try {
    await getUserId()
    const result = await deleteWebhook()
    if (!result.ok) return { success: false, error: result.error }
    return { success: true, data: null }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" }
  }
}
