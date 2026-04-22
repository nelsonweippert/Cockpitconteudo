import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

// Redirect raiz: user logado → /visao-geral (dashboard), senão → login.
export default async function RootPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  redirect("/visao-geral")
}
