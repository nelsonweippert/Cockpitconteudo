import { loadInitialContentData } from "../_lib/load-initial"
import { ConteudoClient } from "../_components/conteudo/ConteudoClient"

export const metadata = { title: "Funil · Content Hub" }

export default async function FunilPage() {
  const { contents, areas } = await loadInitialContentData()
  return <ConteudoClient initialContents={contents} areas={areas} initialTab="pipeline" hideTabs />
}
