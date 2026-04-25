// Helpers de auth pra pages SSR. Centraliza o boilerplate
// `auth() + redirect("/login")` que se repetia em ~7 pages.

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

/**
 * Garante usuário logado e retorna o `userId` ou redireciona pra /login.
 * Usar em qualquer page.tsx que precisa do userId pra queries do Prisma.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  return session.user.id
}
