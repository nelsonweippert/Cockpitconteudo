// Google OAuth2 — fluxo Auth Code pra YouTube. Sem dependência da lib oficial:
// só fetch + endpoints públicos.
//
// https://developers.google.com/identity/protocols/oauth2/web-server
//
// Setup necessário (Google Cloud Console):
// 1. Criar OAuth Client ID (tipo "Web application")
// 2. Authorized redirect URI: https://<seu-domain>/api/auth/youtube/callback
// 3. Habilitar APIs: YouTube Data API v3, YouTube Analytics API
// 4. .env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_URL (pra montar redirect)

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
]

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"

function getRedirectUri(): string {
  const base = process.env.NEXTAUTH_URL?.replace(/\/+$/, "")
  if (!base) throw new Error("NEXTAUTH_URL não configurado — necessário pra redirect URI do OAuth")
  return `${base}/api/auth/youtube/callback`
}

function getClientCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID/SECRET não configurados — vê env example")
  }
  return { clientId, clientSecret }
}

// Constrói a URL de consent. State serve pra:
// 1) verificar quem iniciou o flow (anti-CSRF)
// 2) saber pra onde redirecionar depois (returnTo)
export function buildAuthorizeUrl(state: string): string {
  const { clientId } = getClientCreds()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",        // garante refresh_token
    prompt: "consent",             // força consent → refresh_token vem mesmo se já tinha autorizado antes
    include_granted_scopes: "true",
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

export type TokenResponse = {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
  token_type: "Bearer"
  id_token?: string
}

// Troca code por tokens (chamado no callback)
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getClientCreds()
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => "")
    throw new Error(`Falha ao trocar code (${res.status}): ${errBody.slice(0, 300)}`)
  }
  return (await res.json()) as TokenResponse
}

// Refresha access_token usando refresh_token. Google retorna NOVO access_token mas
// geralmente NÃO retorna novo refresh_token — preserva o atual.
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  expiresIn: number
  scope: string
}> {
  const { clientId, clientSecret } = getClientCreds()
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => "")
    throw new Error(`Refresh falhou (${res.status}): ${errBody.slice(0, 300)}`)
  }
  const body = (await res.json()) as { access_token: string; expires_in: number; scope: string }
  return { accessToken: body.access_token, expiresIn: body.expires_in, scope: body.scope }
}

// Revoga token (usado no disconnect)
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
    })
    return res.ok
  } catch {
    return false
  }
}
