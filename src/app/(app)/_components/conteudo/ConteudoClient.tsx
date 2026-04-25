"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Plus, Lightbulb, BarChart3, Workflow, BookOpen, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import { archiveContentAction } from "@/app/actions/content.actions"
import type { Area } from "@/types"
import { ContentDetailPanel } from "./ContentDetailPanel"
import { OverviewTab } from "./components/OverviewTab"
import { UsageTab } from "./components/UsageTab"
import { CreationModal } from "./components/CreationModal"
import { PipelineTab } from "./components/PipelineTab"
import { SkillsTab } from "./components/SkillsTab"
import { IdeasTab } from "./components/IdeasTab"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Content = any

export type ConteudoTab = "overview" | "pipeline" | "ideas" | "skills" | "usage"
type Tab = ConteudoTab

interface Props {
  initialContents: Content[]
  areas: Area[]
  /** Tab inicial quando renderizado por rota específica. Default "overview". */
  initialTab?: Tab
  /** Esconde o seletor de tabs quando a rota já é dedicada a uma tab. */
  hideTabs?: boolean
  /** SSR: ideias pré-carregadas (elimina flash de loading). */
  initialIdeas?: any[]
  /** SSR: termos monitorados pré-carregados. */
  initialMonitorTerms?: any[]
  /** Esconde todo o header do ConteudoClient — útil quando a page fornece seu próprio. */
  hideHeader?: boolean
}

export function ConteudoClient({
  initialContents,
  areas,
  initialTab = "overview",
  hideTabs = false,
  initialIdeas,
  initialMonitorTerms,
  hideHeader = false,
}: Props) {
  const [contents, setContents] = useState<Content[]>(initialContents)
  const [selectedContent, setSelectedContent] = useState<Content | null>(null)
  const [, startTransition] = useTransition()
  const [tab, setTab] = useState<Tab>(initialTab)

  // Modal de criação (state interna está em CreationModal)
  const [showCreate, setShowCreate] = useState(false)

  // Usage dashboard
  const [usageData, setUsageData] = useState<any>(null)
  const [usageLoaded, setUsageLoaded] = useState(false)

  useEffect(() => {
    if (tab === "usage" && !usageLoaded) {
      fetch("/api/usage").then((r) => r.ok ? r.json() : null).then((data) => { if (data) setUsageData(data); setUsageLoaded(true) })
    }
  }, [tab, usageLoaded])


  // ── Counts ──────────────────────────────────────────────────────────────

  const counts = useMemo(() => {
    const phase: Record<string, number> = {}
    const skill: Record<string, number> = {}
    const series: Record<string, number> = {}
    for (const c of contents) {
      phase[c.phase] = (phase[c.phase] || 0) + 1
      if (c.skill) skill[c.skill] = (skill[c.skill] || 0) + 1
      if (c.series) series[c.series] = (series[c.series] || 0) + 1
    }
    return {
      total: contents.length,
      ideas: phase["IDEATION"] || 0,
      elaboration: phase["ELABORATION"] || 0,
      briefing: phase["BRIEFING"] || 0,
      editingSent: phase["EDITING_SENT"] || 0,
      published: phase["PUBLISHED"] || 0,
      phase, skill, series,
    }
  }, [contents])

  const recentPublished = useMemo(() => contents.filter((c: Content) => c.phase === "PUBLISHED").slice(0, 5), [contents])


  function handleArchive(id: string) {
    startTransition(async () => { const r = await archiveContentAction(id); if (r.success) setContents((prev) => prev.filter((c) => c.id !== id)) })
  }

  function handleUpdate(updated: Content) {
    setContents((prev) => prev.map((c) => c.id === updated.id ? updated : c))
    setSelectedContent(updated)
  }

  // ── RENDER ──────────────────────────────────────────────────────────────

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header (escondido quando a page tem header próprio) */}
        {!hideHeader && (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-cockpit-text">Conteúdo</h1>
              <p className="text-sm text-cockpit-muted mt-1">Pipeline de produção · {counts.total} itens</p>
            </div>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-accent text-black text-sm font-semibold rounded-xl hover:bg-accent-hover transition-colors">
              <Plus size={16} /> Novo Conteúdo
            </button>
          </div>
        )}

        {/* Tabs (escondido quando rota dedicada) */}
        {!hideTabs && (
          <div className="flex items-center gap-1 bg-cockpit-border-light rounded-xl p-1 w-fit">
            {([
              { key: "overview" as Tab, label: "Visão Geral", icon: BarChart3 },
              { key: "ideas" as Tab, label: "Repositório de Ideias", icon: Lightbulb },
              { key: "pipeline" as Tab, label: "Pipeline", icon: Workflow },
              { key: "skills" as Tab, label: "Skills & Boas Práticas", icon: BookOpen },
              { key: "usage" as Tab, label: "Uso da API", icon: Activity },
            ]).map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)} className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                tab === key ? "bg-cockpit-surface text-cockpit-text shadow-sm" : "text-cockpit-muted hover:text-cockpit-text"
              )}><Icon size={13} /> {label}</button>
            ))}
          </div>
        )}

        {/* Creation flow (appears in any tab) */}
        {showCreate && (
          <CreationModal
            areas={areas}
            onClose={() => setShowCreate(false)}
            onCreated={(c) => setContents((prev) => [c, ...prev])}
          />
        )}

        {/* ═══ TAB: VISÃO GERAL ═══ */}
        {tab === "overview" && (
          <OverviewTab
            counts={counts}
            recentPublished={recentPublished}
            onSelectContent={setSelectedContent}
            onCreateClick={() => setShowCreate(true)}
          />
        )}

        {/* ═══ TAB: PIPELINE ═══ */}
        {tab === "pipeline" && (
          <PipelineTab
            contents={contents}
            areas={areas}
            countsSkill={counts.skill}
            countsPhase={counts.phase}
            onSelectContent={setSelectedContent}
            onArchive={handleArchive}
          />
        )}

        {/* ═══ TAB: REPOSITÓRIO DE IDEIAS ═══ */}
        {tab === "ideas" && (
          <IdeasTab
            contents={contents}
            initialMonitorTerms={initialMonitorTerms}
            initialIdeas={initialIdeas}
            onContentCreated={(c) => { setContents((prev) => [c, ...prev]); setSelectedContent(c) }}
            onSelectContent={setSelectedContent}
          />
        )}

        {/* ═══ TAB: SKILLS & BOAS PRÁTICAS ═══ */}
        {tab === "skills" && <SkillsTab countsSkill={counts.skill} />}

        {/* ═══ TAB: USO DA API ═══ */}
        {tab === "usage" && <UsageTab usageData={usageData} />}

      </div>

      {/* Detail Panel */}
      {selectedContent && (
        <ContentDetailPanel
          content={selectedContent}
          areas={areas}
          onClose={() => setSelectedContent(null)}
          onUpdate={handleUpdate}
          onArchive={handleArchive}
        />
      )}
    </>
  )
}
