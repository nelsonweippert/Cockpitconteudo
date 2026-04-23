"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { sendMessage, getMe, escapeMdV2 } from "@/services/telegram.service"
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
    return {
      success: true,
      data: {
        chatId: user?.telegramChatId ?? null,
        tokenConfigured,
        botUsername,
      },
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro" }
  }
}
