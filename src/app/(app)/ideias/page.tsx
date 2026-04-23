import { loadInitialContentData } from "../_lib/load-initial"
import { ConteudoClient } from "../conteudo/ConteudoClient"
import { db } from "@/lib/db"
import { IdeiasHeader } from "./IdeiasHeader"

export const metadata = { title: "Repositório de Ideias · Content Hub" }

export default async function IdeiasPage() {
  const { contents, areas, userId } = await loadInitialContentData()

  // SSR: carrega ideias e termos monitorados pra eliminar flash de loading.
  const [ideas, monitorTerms] = await Promise.all([
    db.ideaFeed.findMany({
      where: { userId, isDiscarded: false },
      orderBy: { createdAt: "desc" },
      take: 100,
    }).catch(() => []),
    db.monitorTerm.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }).catch(() => []),
  ])

  const totalIdeas = ideas.filter((i) => !i.isUsed).length
  const favorites = ideas.filter((i) => i.isFavorite && !i.isUsed).length
  const inProduction = ideas.filter((i) => i.isUsed).length
  const activeTerms = monitorTerms.filter((t) => t.isActive).length

  return (
    <>
      <IdeiasHeader
        totalIdeas={totalIdeas}
        favorites={favorites}
        inProduction={inProduction}
        activeTerms={activeTerms}
      />
      <ConteudoClient
        initialContents={contents}
        areas={areas}
        initialTab="ideas"
        hideTabs
        hideHeader
        initialIdeas={ideas}
        initialMonitorTerms={monitorTerms}
      />
    </>
  )
}
