import { redirect } from "next/navigation"

// Rota legada: /conteudo agora vive fragmentado em /visao-geral, /ideias,
// /funil, /skills, /uso. Redireciona pro dashboard.
export default function ConteudoRedirect() {
  redirect("/visao-geral")
}
