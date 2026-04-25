import { loadInitialContentData } from "../_lib/load-initial"
import { ConteudoClient } from "../_components/conteudo/ConteudoClient"

export const metadata = { title: "Uso da API · Content Hub" }

export default async function UsoPage() {
  const { contents, areas } = await loadInitialContentData()
  return <ConteudoClient initialContents={contents} areas={areas} initialTab="usage" hideTabs />
}
