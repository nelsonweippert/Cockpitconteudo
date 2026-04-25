// GET /api/auth/youtube/connect — inicia o OAuth flow.
// Gera state aleatório (anti-CSRF), guarda em cookie short-lived, redireciona pro consent.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { buildAuthorizeUrl } from "@/services/youtube-oauth.service"
import { randomBytes } from "node:crypto"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login?next=/canal", req.url))
  }

  // State = userId + nonce — vamos validar no callback
  const nonce = randomBytes(16).toString("hex")
  const state = `${session.user.id}.${nonce}`

  try {
    const authorizeUrl = buildAuthorizeUrl(state)
    const res = NextResponse.redirect(authorizeUrl)
    // Cookie HttpOnly com o state pra validar no callback
    res.cookies.set("yt_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600, // 10 min
      path: "/",
    })
    return res
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro"
    return NextResponse.redirect(new URL(`/canal?error=${encodeURIComponent(msg)}`, req.url))
  }
}
