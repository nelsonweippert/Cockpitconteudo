import { loadInitialContentData } from "../_lib/load-initial"
import { ConteudoClient } from "../conteudo/ConteudoClient"

export const metadata = { title: "Repositório de Ideias · Content Hub" }

export default async function IdeiasPage() {
  const { contents, areas } = await loadInitialContentData()
  return <ConteudoClient initialContents={contents} areas={areas} initialTab="ideas" hideTabs />
}
