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
