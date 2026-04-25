import { loadInitialContentData } from "../_lib/load-initial"
import { ConteudoClient } from "../_components/conteudo/ConteudoClient"

export const metadata = { title: "Visão Geral · Content Hub" }

export default async function VisaoGeralPage() {
  const { contents, areas } = await loadInitialContentData()
  return <ConteudoClient initialContents={contents} areas={areas} initialTab="overview" hideTabs />
}
