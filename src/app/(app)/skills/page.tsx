import { loadInitialContentData } from "../_lib/load-initial"
import { ConteudoClient } from "../_components/conteudo/ConteudoClient"

export const metadata = { title: "Skills · Content Hub" }

export default async function SkillsPage() {
  const { contents, areas } = await loadInitialContentData()
  return <ConteudoClient initialContents={contents} areas={areas} initialTab="skills" hideTabs />
}
