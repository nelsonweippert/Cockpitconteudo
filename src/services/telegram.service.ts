// Telegram Bot API wrapper. Só o que precisamos: sendMessage.
// Docs: https://core.telegram.org/bots/api
//
// O token do bot é lido de process.env.TELEGRAM_BOT_TOKEN (criado via @BotFather).
// ChatId vem do User (setado pelo próprio usuário via UI após falar com @userinfobot).

const BASE = "https://api.telegram.org"

function getToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN não configurado (.env.local / Vercel env)")
  return t
}

// MarkdownV2 exige escape de: _ * [ ] ( ) ~ ` > # + - = | { } . !
// Usa isso dentro do TEXTO das mensagens. Não use pra quebrar a sintaxe (bold etc).
export function escapeMdV2(s: string): string {
  return s.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1")
}

export async function sendMessage(opts: {
  chatId: string
  text: string
  parseMode?: "MarkdownV2" | "HTML" | "Markdown"
  disableWebPreview?: boolean
}): Promise<{ ok: true; messageId: number } | { ok: false; error: string; code?: number }> {
  const { chatId, text, parseMode = "MarkdownV2", disableWebPreview = true } = opts
  const token = getToken()
  const url = `${BASE}/bot${token}/sendMessage`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: disableWebPreview,
      }),
    })
    const body = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string; error_code?: number }
    if (!body.ok) {
      return { ok: false, error: body.description ?? "erro desconhecido", code: body.error_code }
    }
    return { ok: true, messageId: body.result?.message_id ?? 0 }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "falha de rede" }
  }
}

// Checa se o bot consegue se autenticar — útil pro botão "verificar configuração".
export async function getMe(): Promise<{ ok: true; username: string; firstName: string } | { ok: false; error: string }> {
  try {
    const token = getToken()
    const res = await fetch(`${BASE}/bot${token}/getMe`)
    const body = (await res.json()) as { ok: boolean; result?: { username: string; first_name: string }; description?: string }
    if (!body.ok || !body.result) return { ok: false, error: body.description ?? "getMe falhou" }
    return { ok: true, username: body.result.username, firstName: body.result.first_name }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "falha" }
  }
}

// Edita uma mensagem já enviada (usado pra atualizar "pensando..." → resposta).
export async function editMessage(opts: {
  chatId: string
  messageId: number
  text: string
  parseMode?: "MarkdownV2" | "HTML" | "Markdown"
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { chatId, messageId, text, parseMode = "MarkdownV2" } = opts
  try {
    const res = await fetch(`${BASE}/bot${getToken()}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    })
    const body = (await res.json()) as { ok: boolean; description?: string }
    if (!body.ok) return { ok: false, error: body.description ?? "edit falhou" }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "falha" }
  }
}

// Configura o webhook na Bot API. Chama 1x quando o user vincula a integração.
export async function setWebhook(opts: {
  url: string
  secretToken: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${BASE}/bot${getToken()}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: opts.url,
        secret_token: opts.secretToken,
        allowed_updates: ["message"],
      }),
    })
    const body = (await res.json()) as { ok: boolean; description?: string }
    if (!body.ok) return { ok: false, error: body.description ?? "setWebhook falhou" }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "falha" }
  }
}

export async function deleteWebhook(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${BASE}/bot${getToken()}/deleteWebhook`, { method: "POST" })
    const body = (await res.json()) as { ok: boolean; description?: string }
    if (!body.ok) return { ok: false, error: body.description ?? "deleteWebhook falhou" }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "falha" }
  }
}

export async function getWebhookInfo(): Promise<{
  ok: true
  url: string
  hasCustomCertificate: boolean
  pendingUpdateCount: number
  lastErrorDate?: number
  lastErrorMessage?: string
} | { ok: false; error: string }> {
  try {
    const res = await fetch(`${BASE}/bot${getToken()}/getWebhookInfo`)
    const body = (await res.json()) as {
      ok: boolean
      result?: {
        url: string
        has_custom_certificate: boolean
        pending_update_count: number
        last_error_date?: number
        last_error_message?: string
      }
      description?: string
    }
    if (!body.ok || !body.result) return { ok: false, error: body.description ?? "getWebhookInfo falhou" }
    return {
      ok: true,
      url: body.result.url,
      hasCustomCertificate: body.result.has_custom_certificate,
      pendingUpdateCount: body.result.pending_update_count,
      lastErrorDate: body.result.last_error_date,
      lastErrorMessage: body.result.last_error_message,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "falha" }
  }
}
