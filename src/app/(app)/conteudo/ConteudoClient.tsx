"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import {
  Plus, Loader2, Sparkles, Search, Lightbulb,
  BarChart3, Workflow, BookOpen, Send, Activity,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createContentAction, archiveContentAction } from "@/app/actions/content.actions"
import { getMonitorTermsAction, addMonitorTermAction, deleteMonitorTermAction, updateMonitorTermIntentAction, getIdeasAction, discardIdeaAction, markIdeaUsedAction, generateIdeasNowAction, generateIdeaForThemeAction, toggleIdeaFavoriteAction } from "@/app/actions/idea.actions"
import type { Area } from "@/types"
import { ContentDetailPanel } from "./ContentDetailPanel"
import { IdeaCard } from "./IdeaCard"
import { OverviewTab } from "./components/OverviewTab"
import { UsageTab } from "./components/UsageTab"
import { CreationModal } from "./components/CreationModal"
import { PipelineTab } from "./components/PipelineTab"
import { SkillsTab } from "./components/SkillsTab"

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
  const [isPending, startTransition] = useTransition()
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


  // Idea repository
  const [monitorTerms, setMonitorTerms] = useState<any[]>(initialMonitorTerms ?? [])
  const [ideaFeed, setIdeaFeed] = useState<any[]>(initialIdeas ?? [])
  const [ideasLoaded, setIdeasLoaded] = useState(Boolean(initialIdeas))
  const [newTerm, setNewTerm] = useState("")
  const [newTermIntent, setNewTermIntent] = useState("")
  const [editingIntentId, setEditingIntentId] = useState<string | null>(null)
  const [editingIntentText, setEditingIntentText] = useState("")
  const [generatingIdeas, setGeneratingIdeas] = useState(false)
  const [ideaTermFilter, setIdeaTermFilter] = useState<string>("")
  const [showUsedIdeas, setShowUsedIdeas] = useState(false)
  const [customIdeaInput, setCustomIdeaInput] = useState("")
  const [customIdeaLoading, setCustomIdeaLoading] = useState(false)
  const [customIdeaTerm, setCustomIdeaTerm] = useState<string>("")
  const [ideaError, setIdeaError] = useState<string | null>(null)
  const [manualTitle, setManualTitle] = useState("")
  const [manualStory, setManualStory] = useState("")
  const [manualLoading, setManualLoading] = useState(false)
  // Tracker do estágio do pipeline (client-side, baseado em tempo elapsed)
  const [pipelineStartedAt, setPipelineStartedAt] = useState<number | null>(null)
  const [pipelineElapsed, setPipelineElapsed] = useState(0)
  // Seletor de temas pra gerar ideias (só os selecionados são usados)
  const [selectedTermIds, setSelectedTermIds] = useState<string[]>([])
  // Ordenação
  const [ideaSort, setIdeaSort] = useState<"recent" | "pioneer" | "viral">("recent")

  useEffect(() => {
    if (tab === "ideas" && !ideasLoaded) {
      Promise.all([getMonitorTermsAction(), getIdeasAction()]).then(async ([termsRes, ideasRes]) => {
        if (termsRes.success) {
          const terms = termsRes.data as any[]
          setMonitorTerms(terms)
          // Defaults pós-load: filtro de termo + IDs selecionados pra geração
          // (consolidado aqui pra evitar setState em effect body)
          const firstActive = terms.find((t: any) => t.isActive)?.term
          if (firstActive) setIdeaTermFilter((cur) => cur || firstActive)
          const withSources = terms.filter((t: any) => {
            if (!t.isActive) return false
            const s = Array.isArray(t.sources) ? t.sources : []
            return s.some((x: any) => x?.isActive !== false)
          })
          if (withSources.length > 0) {
            setSelectedTermIds((cur) => cur.length > 0 ? cur : withSources.map((t: any) => t.id))
          }
        }
        if (ideasRes.success) {
          setIdeaFeed(ideasRes.data as any[])
          // Auto-reclassify ideas to monitored terms
          try {
            const res = await fetch("/api/content/ideas/reclassify", { method: "POST" })
            if (res.ok) { const data = await res.json(); if (data.fixed > 0) setIdeaFeed(data.ideas) }
          } catch {}
        }
        setIdeasLoaded(true)
      })
    }
  }, [tab, ideasLoaded])

  // Timer do pipeline — atualiza elapsed a cada segundo enquanto rodando
  useEffect(() => {
    if (!pipelineStartedAt) return
    const interval = setInterval(() => {
      setPipelineElapsed(Math.floor((Date.now() - pipelineStartedAt) / 1000))
    }, 500)
    return () => clearInterval(interval)
  }, [pipelineStartedAt])

  async function handleAddTerm() {
    if (!newTerm.trim()) return
    const res = await addMonitorTermAction(newTerm.trim(), newTermIntent.trim() || undefined)
    if (res.success) {
      setMonitorTerms((p) => [res.data as any, ...p])
      setNewTerm("")
      setNewTermIntent("")
    }
  }

  function startEditIntent(id: string, current?: string | null) {
    setEditingIntentId(id)
    setEditingIntentText(current ?? "")
  }

  async function saveIntent() {
    if (!editingIntentId) return
    const res = await updateMonitorTermIntentAction(editingIntentId, editingIntentText)
    if (res.success) {
      setMonitorTerms((p) => p.map((t) => t.id === editingIntentId ? { ...t, intent: editingIntentText.trim() || null } : t))
      setEditingIntentId(null)
      setEditingIntentText("")
    }
  }

  async function handleDeleteTerm(id: string) {
    await deleteMonitorTermAction(id)
    setMonitorTerms((p) => p.filter((t) => t.id !== id))
  }

  async function handleGenerateIdeas() {
    if (selectedTermIds.length === 0) {
      setIdeaError("Selecione pelo menos 1 tema pra gerar ideias")
      return
    }
    setGeneratingIdeas(true)
    setIdeaError(null)
    setPipelineStartedAt(Date.now())
    setPipelineElapsed(0)
    try {
      const result = await generateIdeasNowAction(selectedTermIds)
      if (result.success) {
        const ideasRes = await getIdeasAction()
        if (ideasRes.success) setIdeaFeed(ideasRes.data as any[])
        const data = result.data as { count: number } | null
        if (data && data.count === 0) setIdeaError("Nenhuma ideia nova (nada relevante nas últimas 72h).")
      } else {
        setIdeaError(result.error || "Erro ao gerar ideias")
      }
    } catch (err: any) {
      setIdeaError(`Erro: ${err?.message || "falha inesperada"}`)
    }
    setGeneratingIdeas(false)
    setPipelineStartedAt(null)
  }

  async function handleDiscardIdea(id: string) {
    await discardIdeaAction(id)
    setIdeaFeed((p) => p.filter((i) => i.id !== id))
  }

  async function handleToggleFavorite(id: string) {
    // Optimistic update
    setIdeaFeed((p) => p.map((i) => i.id === id ? { ...i, isFavorite: !i.isFavorite } : i))
    const res = await toggleIdeaFavoriteAction(id)
    if (!res.success) {
      // Rollback em caso de erro
      setIdeaFeed((p) => p.map((i) => i.id === id ? { ...i, isFavorite: !i.isFavorite } : i))
    }
  }

  // Pesquisa 1 tema focado via pipeline completo (RSS + Claude + triangulação)
  async function handleThemeIdea() {
    if (!customIdeaInput.trim()) return
    setCustomIdeaLoading(true)
    setIdeaError(null)
    setPipelineStartedAt(Date.now())
    setPipelineElapsed(0)
    try {
      const res = await generateIdeaForThemeAction(customIdeaInput.trim())
      if (res.success) {
        const ideasRes = await getIdeasAction()
        if (ideasRes.success) setIdeaFeed(ideasRes.data as any[])
        setCustomIdeaInput("")
      } else {
        setIdeaError(res.error || "Erro ao pesquisar tema")
      }
    } catch (err: any) {
      setIdeaError(`Erro: ${err?.message || "conexão falhou"}`)
    }
    setCustomIdeaLoading(false)
    setPipelineStartedAt(null)
  }

  async function handleCustomIdea() {
    if (!customIdeaInput.trim()) return
    setCustomIdeaLoading(true)
    setIdeaError(null)
    try {
      const res = await fetch("/api/content/ideas/custom", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: customIdeaInput, term: customIdeaTerm || undefined }),
      })
      let data
      try { data = await res.json() } catch { data = { error: `Status ${res.status}` } }
      if (res.ok && data.ideas) {
        setIdeaFeed(data.ideas)
        setCustomIdeaInput("")
      } else {
        setIdeaError(data.error || `Erro ${res.status}`)
      }
    } catch (err: any) {
      setIdeaError(`Erro: ${err?.message || "conexão falhou"}`)
    }
    setCustomIdeaLoading(false)
  }

  async function handleManualIdea() {
    if (!manualTitle.trim() || !manualStory.trim()) return
    setManualLoading(true)
    setIdeaError(null)
    startTransition(async () => {
      const result = await createContentAction({
        title: manualTitle.trim(),
        research: manualStory.trim(),
      })
      if (result.success) {
        setContents((prev) => [result.data as Content, ...prev])
        setSelectedContent(result.data as Content)
        setManualTitle("")
        setManualStory("")
      } else {
        setIdeaError("Erro ao criar conteúdo manual")
      }
      setManualLoading(false)
    })
  }

  async function handleUseIdea(idea: any) {
    const researchText = [
      idea.summary && `📋 ${idea.summary}`,
      idea.relevance && `\n📈 Relevância: ${idea.relevance}`,
      idea.angle && `\n💡 Ângulo: ${idea.angle}`,
      idea.source && `\n📰 Fontes: ${idea.source}`,
      `\n\n🔗 Use as fontes acima para buscar imagens, screenshots e dados para o vídeo.`,
    ].filter(Boolean).join("\n")
    startTransition(async () => {
      const result = await createContentAction({
        title: idea.title, hook: idea.hook || undefined,
        ideaFeedId: idea.id, research: researchText || undefined,
      })
      if (result.success) {
        setContents((prev) => [result.data as Content, ...prev])
        await markIdeaUsedAction(idea.id)
        setIdeaFeed((p) => p.map((i) => i.id === idea.id ? { ...i, isUsed: true } : i))
        // Open content in idealização for skill/duration selection
        setSelectedContent(result.data as Content)
      }
    })
  }

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

  const ideas = useMemo(() => contents.filter((c: Content) => c.phase === "IDEATION"), [contents])
  const recentPublished = useMemo(() => contents.filter((c: Content) => c.phase === "PUBLISHED").slice(0, 5), [contents])

  // Filtra ideias legadas do endpoint antigo (source "Multi-source"/"Google News + YouTube"
  // ou relevance contendo news.google.com). Elas ficam no DB mas não aparecem mais.
  const visibleIdeaFeed = useMemo(() => ideaFeed.filter((i: any) => {
    if (i.source === "Multi-source" || i.source === "Google News + YouTube") return false
    if (typeof i.relevance === "string" && /news\.google\.com/i.test(i.relevance)) return false
    return true
  }), [ideaFeed])


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
          <div className="space-y-5">
            {/* ═══ 3 MODOS DE IDEAÇÃO LADO A LADO ═══ */}
            {ideaError && (
              <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">{ideaError}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 🤖 Monitor automático — com seletor de temas */}
              <div className="cockpit-card flex flex-col justify-between min-h-[200px]">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-cockpit-text flex items-center gap-1.5">🤖 Monitor automático</h3>
                      <p className="text-[10px] text-cockpit-muted mt-0.5">Selecione os temas e gere ideias ancoradas nas fontes curadas.</p>
                    </div>
                    <a href="/temas" className="text-[10px] text-cockpit-muted hover:text-accent whitespace-nowrap shrink-0">gerenciar →</a>
                  </div>

                  {/* Seletor de temas */}
                  {(() => {
                    const activeTerms = monitorTerms.filter((t: any) => t.isActive)
                    const hasAnyWithSources = activeTerms.some((t: any) => Array.isArray(t.sources) && t.sources.some((s: any) => s?.isActive !== false))

                    if (activeTerms.length === 0) {
                      return (
                        <div className="mt-2 p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg text-[10px] text-amber-500">
                          Nenhum tema ativo. Adicione em <a href="/temas" className="underline">/temas</a>.
                        </div>
                      )
                    }

                    if (!hasAnyWithSources) {
                      return (
                        <div className="mt-2 p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg text-[10px] text-amber-500">
                          Nenhum tema tem fontes curadas. Monte o catálogo em <a href="/temas" className="underline">/temas</a> primeiro.
                        </div>
                      )
                    }

                    return (
                      <div className="mt-2 space-y-1 max-h-[150px] overflow-y-auto">
                        {activeTerms.map((t: any) => {
                          const s = Array.isArray(t.sources) ? t.sources : []
                          const sourcesActive = s.filter((x: any) => x?.isActive !== false).length
                          const hasSources = sourcesActive > 0
                          const isChecked = selectedTermIds.includes(t.id)
                          return (
                            <label key={t.id}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[11px] transition-colors cursor-pointer",
                                !hasSources ? "border-cockpit-border-light bg-cockpit-border-light/10 opacity-50 cursor-not-allowed" :
                                isChecked ? "border-accent/40 bg-accent/5" : "border-cockpit-border hover:border-cockpit-text/20"
                              )}>
                              <input type="checkbox"
                                checked={isChecked}
                                disabled={!hasSources}
                                onChange={() => {
                                  setSelectedTermIds((prev) => prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id])
                                }}
                                className="accent-accent shrink-0" />
                              <span className="font-semibold text-cockpit-text truncate flex-1">{t.term}</span>
                              {hasSources ? (
                                <span className="text-[9px] text-cockpit-muted whitespace-nowrap">
                                  {sourcesActive} fonte{sourcesActive === 1 ? "" : "s"}
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-500 whitespace-nowrap">⚠ sem fontes</span>
                              )}
                            </label>
                          )
                        })}
                      </div>
                    )
                  })()}

                  {/* Seletor rápido */}
                  {(() => {
                    const selectable = monitorTerms.filter((t: any) => {
                      if (!t.isActive) return false
                      const s = Array.isArray(t.sources) ? t.sources : []
                      return s.some((x: any) => x?.isActive !== false)
                    })
                    if (selectable.length < 2) return null
                    const allSelected = selectable.every((t: any) => selectedTermIds.includes(t.id))
                    return (
                      <div className="flex items-center justify-between mt-2 text-[10px]">
                        <button onClick={() => {
                          if (allSelected) setSelectedTermIds([])
                          else setSelectedTermIds(selectable.map((t: any) => t.id))
                        }}
                          className="text-cockpit-muted hover:text-accent underline decoration-dotted">
                          {allSelected ? "desmarcar todos" : "selecionar todos"}
                        </button>
                        <span className="text-cockpit-muted">
                          {selectedTermIds.length} de {selectable.length} selecionado{selectedTermIds.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    )
                  })()}
                </div>

                <button onClick={handleGenerateIdeas}
                  disabled={generatingIdeas || selectedTermIds.length === 0}
                  className="mt-3 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-accent text-black text-xs font-semibold rounded-xl hover:bg-accent-hover disabled:opacity-50 transition-colors">
                  {generatingIdeas ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {generatingIdeas
                    ? "Pesquisando (~90s)..."
                    : selectedTermIds.length === 0
                    ? "Selecione temas"
                    : `Gerar ideias (${selectedTermIds.length} tema${selectedTermIds.length === 1 ? "" : "s"})`}
                </button>
              </div>

              {/* 🔍 Tema específico */}
              <div className="cockpit-card flex flex-col justify-between min-h-[200px]">
                <div>
                  <h3 className="text-sm font-semibold text-cockpit-text flex items-center gap-1.5">🔍 Tema específico</h3>
                  <p className="text-[10px] text-cockpit-muted mt-0.5 mb-3">Pesquisa focada em 1 palavra-chave. Não adiciona aos monitorados.</p>
                  <input type="text" value={customIdeaInput} onChange={(e) => setCustomIdeaInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && customIdeaInput.trim() && !customIdeaLoading) handleThemeIdea() }}
                    placeholder="Ex: NVIDIA GB200, Anthropic Opus 4.7"
                    className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-xl text-sm text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-1 focus:ring-accent/30" />
                </div>
                <button onClick={handleThemeIdea} disabled={!customIdeaInput.trim() || customIdeaLoading}
                  className="mt-3 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-accent text-black text-xs font-semibold rounded-xl hover:bg-accent-hover disabled:opacity-50 transition-colors">
                  {customIdeaLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                  {customIdeaLoading ? "Pesquisando..." : "Pesquisar e gerar"}
                </button>
              </div>

              {/* ✍️ Ideia própria (sem IA) */}
              <div className="cockpit-card flex flex-col justify-between min-h-[200px]">
                <div>
                  <h3 className="text-sm font-semibold text-cockpit-text flex items-center gap-1.5">✍️ Ideia própria</h3>
                  <p className="text-[10px] text-cockpit-muted mt-0.5 mb-3">Já tem a ideia. Entra direto no funil sem pesquisa automática.</p>
                  <input type="text" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="Título do conteúdo"
                    className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-xl text-sm text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-1 focus:ring-accent/30 mb-2" />
                  <textarea value={manualStory} onChange={(e) => setManualStory(e.target.value)} rows={3}
                    placeholder="Pensamento, ângulo, pontos que quer cobrir..."
                    className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-xl text-sm text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-1 focus:ring-accent/30 resize-none" />
                </div>
                <button onClick={handleManualIdea} disabled={!manualTitle.trim() || !manualStory.trim() || manualLoading}
                  className="mt-3 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-accent text-black text-xs font-semibold rounded-xl hover:bg-accent-hover disabled:opacity-50 transition-colors">
                  {manualLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Criar sem pesquisa
                </button>
              </div>
            </div>

            {/* Filters — only monitored terms + "Outros" */}
            {visibleIdeaFeed.length > 0 && (() => {
              const monitoredTermNames = monitorTerms.filter((t: any) => t.isActive).map((t: any) => t.term)
              const othersCount = visibleIdeaFeed.filter((i: any) => !i.isUsed && !monitoredTermNames.includes(i.term)).length
              const usedWithContent = visibleIdeaFeed.filter((i: any) => i.isUsed && contents.some((c: Content) => c.ideaFeedId === i.id || c.title === i.title)).length

              return (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-cockpit-border-light rounded-xl p-1 flex-wrap">
                    {monitoredTermNames.map((term) => {
                      const count = visibleIdeaFeed.filter((i: any) => !i.isUsed && i.term === term).length
                      return (
                        <button key={term} onClick={() => setIdeaTermFilter(term)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", ideaTermFilter === term ? "bg-cockpit-surface text-cockpit-text shadow-sm" : "text-cockpit-muted hover:text-cockpit-text")}>
                          {term} <span className="text-[10px] opacity-70 ml-1">{count}</span>
                        </button>
                      )
                    })}
                    {othersCount > 0 && (
                      <button onClick={() => setIdeaTermFilter("__others__")} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", ideaTermFilter === "__others__" ? "bg-cockpit-surface text-cockpit-text shadow-sm" : "text-cockpit-muted hover:text-cockpit-text")}>
                        Outros <span className="text-[10px] opacity-70 ml-1">{othersCount}</span>
                      </button>
                    )}
                  </div>
                  {usedWithContent > 0 && (
                    <button onClick={() => setShowUsedIdeas(!showUsedIdeas)} className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors", showUsedIdeas ? "border-accent/30 bg-accent/10 text-accent" : "border-cockpit-border text-cockpit-muted hover:text-cockpit-text")}>
                      {showUsedIdeas ? "Esconder" : "Em produção"} <span className="text-[10px] opacity-70 ml-1">{usedWithContent}</span>
                    </button>
                  )}
                  {/* Ordenação */}
                  <div className="flex items-center gap-1 bg-cockpit-border-light rounded-xl p-1 ml-auto">
                    <span className="text-[10px] text-cockpit-muted px-1.5">Ordem:</span>
                    {([
                      { k: "recent" as const, l: "Recente" },
                      { k: "pioneer" as const, l: "Pioneer" },
                      { k: "viral" as const, l: "Viral" },
                    ]).map(({ k, l }) => (
                      <button key={k} onClick={() => setIdeaSort(k)}
                        className={cn("px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
                          ideaSort === k ? "bg-cockpit-surface text-cockpit-text shadow-sm" : "text-cockpit-muted hover:text-cockpit-text")}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Progresso do pipeline em tempo real */}
            {(generatingIdeas || customIdeaLoading) && (() => {
              // Estágios do pipeline com janelas de tempo estimadas (client-side tracker)
              const stages = [
                { id: "rss", label: "Descobrindo fontes", detail: "RSS Google News em PT-BR e EN", maxSec: 10 },
                { id: "triage", label: "Lendo matérias", detail: "Haiku web_fetch + classificação por intenção", maxSec: 45 },
                { id: "deep", label: "Triangulando", detail: "Cross-publisher + cross-language", maxSec: 75 },
                { id: "narrative", label: "Gerando ideias", detail: "Sonnet narrativa + platformFit", maxSec: 95 },
              ]
              const currentIdx = stages.findIndex((s) => pipelineElapsed < s.maxSec)
              const effectiveIdx = currentIdx === -1 ? stages.length - 1 : currentIdx
              return (
                <div className="cockpit-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-accent" />
                      <div>
                        <p className="text-sm font-semibold text-cockpit-text">Pipeline rodando</p>
                        <p className="text-[11px] text-cockpit-muted">{stages[effectiveIdx].detail}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-cockpit-text tabular-nums">{pipelineElapsed}s</p>
                      <p className="text-[10px] text-cockpit-muted uppercase tracking-wider">elapsed</p>
                    </div>
                  </div>

                  {/* 4 estágios com progress bars */}
                  <div className="space-y-2">
                    {stages.map((s, i) => {
                      const done = i < effectiveIdx
                      const current = i === effectiveIdx
                      const prevMax = i === 0 ? 0 : stages[i - 1].maxSec
                      const stagePct = current
                        ? Math.min(100, ((pipelineElapsed - prevMax) / (s.maxSec - prevMax)) * 100)
                        : done ? 100 : 0
                      return (
                        <div key={s.id} className="flex items-center gap-3">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shrink-0",
                            done ? "bg-emerald-500 border-emerald-500 text-white" :
                            current ? "bg-accent/20 border-accent text-accent animate-pulse" :
                            "bg-cockpit-bg border-cockpit-border text-cockpit-muted"
                          )}>
                            {done ? "✓" : i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={cn(
                                "text-xs font-medium",
                                done ? "text-cockpit-muted" : current ? "text-cockpit-text" : "text-cockpit-muted/60"
                              )}>{s.label}</span>
                              {current && <span className="text-[10px] text-accent tabular-nums">~{Math.max(0, s.maxSec - pipelineElapsed)}s restantes</span>}
                            </div>
                            <div className="h-1 bg-cockpit-border-light rounded-full overflow-hidden">
                              <div className={cn(
                                "h-full rounded-full transition-all duration-500",
                                done ? "bg-emerald-500" : current ? "bg-accent" : "bg-cockpit-border"
                              )} style={{ width: `${stagePct}%` }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <p className="text-[10px] text-cockpit-muted text-center italic pt-1 border-t border-cockpit-border">
                    Tempos estimados com base em runs anteriores. Pode variar conforme os termos.
                  </p>
                </div>
              )
            })()}

            {visibleIdeaFeed.length === 0 && !generatingIdeas && !customIdeaLoading ? (
              <div className="cockpit-card flex flex-col items-center justify-center py-16 text-cockpit-muted">
                <Lightbulb size={32} strokeWidth={1} />
                <p className="text-sm mt-3 text-cockpit-text font-medium">Nenhuma ideia ainda</p>
                <p className="text-xs mt-1 max-w-sm text-center">
                  {monitorTerms.filter((t: any) => t.isActive).length === 0
                    ? "Adicione termos monitorados ou pesquise um tema específico acima."
                    : "Clique em 'Gerar ideias agora' pra rodar o pipeline completo."}
                </p>
              </div>
            ) : visibleIdeaFeed.length === 0 ? null : (
              <div className="space-y-2">
                {visibleIdeaFeed
                  .filter((i: any) => {
                    if (showUsedIdeas) return true
                    if (i.isUsed) return false
                    return true
                  })
                  .filter((i: any) => {
                    // When showing used, only show those with content in pipeline
                    if (i.isUsed) {
                      return contents.some((c: Content) => c.ideaFeedId === i.id || c.title === i.title)
                    }
                    return true
                  })
                  .filter((i: any) => {
                    if (!ideaTermFilter) return true
                    if (ideaTermFilter === "__others__") {
                      const monitored = monitorTerms.filter((t: any) => t.isActive).map((t: any) => t.term)
                      return !monitored.includes(i.term)
                    }
                    return i.term === ideaTermFilter
                  })
                  .sort((a: any, b: any) => {
                    // Favoritas SEMPRE primeiro, não importa a ordenação
                    if (!!a.isFavorite !== !!b.isFavorite) return a.isFavorite ? -1 : 1
                    if (ideaSort === "pioneer") {
                      return (b.pioneerScore ?? 0) - (a.pioneerScore ?? 0)
                    }
                    if (ideaSort === "viral") {
                      return (b.viralScore ?? 0) - (a.viralScore ?? 0)
                    }
                    // recent — default
                    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
                    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
                    return tb - ta
                  })
                  .map((idea: any) => {
                    const linkedContent = idea.isUsed
                      ? contents.find((c: Content) => c.ideaFeedId === idea.id || c.title === idea.title) ?? null
                      : null
                    return (
                      <IdeaCard
                        key={idea.id}
                        idea={idea}
                        linkedContent={linkedContent}
                        onUse={() => handleUseIdea(idea)}
                        onDiscard={() => handleDiscardIdea(idea.id)}
                        onOpen={() => linkedContent && setSelectedContent(linkedContent)}
                        onToggleFavorite={() => handleToggleFavorite(idea.id)}
                        isPending={isPending}
                      />
                    )
                  })}
              </div>
            )}
          </div>
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
