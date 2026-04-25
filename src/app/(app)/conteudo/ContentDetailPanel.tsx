"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import {
  X, Loader2, Archive, ChevronRight, ChevronLeft,
  Lightbulb, FileText, ExternalLink, Sparkles, RefreshCw,
  Scissors, Send, PenTool, ClipboardList, Mic,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { updateContentAction, advanceContentPhaseAction, archiveContentAction, getContentReferencesAction } from "@/app/actions/content.actions"
import { CONTENT_SKILLS, SKILL_LIST, type SkillId } from "@/config/content-skills"
import type { Area, ContentPhase } from "@/types"
import { SeoScorePanel } from "./SeoScorePanel"
import { PrePublishGate } from "./PrePublishGate"

type RefCard = {
  id: string
  title: string
  url: string
  host: string
  publisher: string
  language: string
  summary: string
  keyQuote: string | null
  publishedAt: Date | null
  sourceAuthority: string
  relevanceScore: number
}
type ReferencesData = {
  primary: RefCard | null
  supporting: RefCard[]
  ideaTitle?: string
  ideaTerm?: string
  viralScore?: number
  hasInternationalCoverage?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Content = any

const PHASES: { id: ContentPhase; label: string; icon: React.ElementType }[] = [
  { id: "IDEATION", label: "Idealização", icon: Lightbulb },
  { id: "ELABORATION", label: "Elaboração", icon: PenTool },
  { id: "BRIEFING", label: "Briefing", icon: ClipboardList },
  { id: "EDITING_SENT", label: "Em Edição", icon: Scissors },
  { id: "PUBLISHED", label: "Publicado", icon: Send },
]

const ELAB_SECTIONS = ["pesquisa", "hook", "roteiro", "titulo", "thumbnail", "descricao", "score"] as const
type ElabSection = typeof ELAB_SECTIONS[number]
const ELAB_LABEL: Record<ElabSection, string> = { pesquisa: "Pesquisa", hook: "Hook", roteiro: "Roteiro", titulo: "Título", thumbnail: "Thumbnail", descricao: "Descrição", score: "SEO Score" }

interface Props {
  content: Content; areas: Area[]
  onClose: () => void; onUpdate: (c: Content) => void; onArchive: (id: string) => void
}

export function ContentDetailPanel({ content, areas, onClose, onUpdate, onArchive }: Props) {
  const [isPending, startTransition] = useTransition()
  const skill = content.skill ? CONTENT_SKILLS[content.skill as SkillId] : null

  // All fields
  const [title, setTitle] = useState(content.title)
  const [targetDuration, setTargetDuration] = useState<number>(content.targetDuration ?? 0)
  const [hook, setHook] = useState(content.hook ?? "")
  const [script, setScript] = useState(content.script ?? "")
  const [research, setResearch] = useState(content.research ?? "")
  const [thumbnailNotes, setThumbnailNotes] = useState(content.thumbnailNotes ?? "")
  const [description, setDescription] = useState(content.description ?? "")
  const [notes, setNotes] = useState(content.notes ?? "")
  const [rawVideoUrl, setRawVideoUrl] = useState(content.rawVideoUrl ?? "")
  const [localAreaIds, setLocalAreaIds] = useState<string[]>(() => {
    try {
      if (Array.isArray(content.areas) && content.areas.length > 0) return content.areas.map((a: any) => a.area?.id ?? a.areaId).filter(Boolean)
      return content.areaId ? [content.areaId] : []
    } catch { return [] }
  })

  const [activeSection, setActiveSection] = useState<ElabSection>("pesquisa")

  // Referências (IdeaFeed → NewsEvidence) — carrega uma vez por content
  const [references, setReferences] = useState<ReferencesData | null>(null)
  const [referencesLoading, setReferencesLoading] = useState(false)
  useEffect(() => {
    if (!content?.id) return
    if (!content.ideaFeedId) { setReferences({ primary: null, supporting: [] }); return }
    setReferencesLoading(true)
    getContentReferencesAction(content.id).then((res) => {
      if (res.success) setReferences(res.data as ReferencesData)
      setReferencesLoading(false)
    })
  }, [content?.id, content?.ideaFeedId])

  // AI state — persists across sub-tab changes
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiOptions, setAiOptions] = useState<any[] | null>(null)
  const [aiField, setAiField] = useState<string | null>(null)
  const [aiAction, setAiAction] = useState<string | null>(null)
  const [aiConsideration, setAiConsideration] = useState("")

  const curIdx = PHASES.findIndex((p) => p.id === content.phase)
  const prevPhase = curIdx > 0 ? PHASES[curIdx - 1] : null
  const nextPhase = curIdx < PHASES.length - 1 ? PHASES[curIdx + 1] : null

  // Render text with clickable links
  function renderTextWithLinks(text: string) {
    const urlRegex = /(https?:\/\/[^\s\)]+)/g
    const parts = text.split(urlRegex)
    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        let display = part
        try { display = new URL(part).hostname.replace("www.", "") } catch {}
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent text-xs font-medium rounded-lg hover:bg-accent/20 hover:underline transition-colors break-all">
            🔗 {display}
          </a>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  // Extract and classify links from text
  function extractLinks(text: string): { ptBr: { url: string; host: string }[]; en: { url: string; host: string }[] } {
    const urlRegex = /https?:\/\/[^\s\)]+/g
    const urls = text.match(urlRegex) ?? []
    const ptBrDomains = [".com.br", ".br/", "tecmundo", "olhardigital", "canaltech", "infomoney", "g1.globo", "uol.com", "exame.com", "livecoins", "moneytimes", "seudinheiro", "tecnoblog", "meiobit", "tabnews"]
    const ptBr: { url: string; host: string }[] = []
    const en: { url: string; host: string }[] = []
    for (const url of urls) {
      let host = url
      try { host = new URL(url).hostname.replace("www.", "") } catch {}
      const isPtBr = ptBrDomains.some((d) => url.toLowerCase().includes(d))
      if (isPtBr) ptBr.push({ url, host })
      else en.push({ url, host })
    }
    return { ptBr, en }
  }

  // Render text WITHOUT links (for the description part)
  function renderTextOnly(text: string) {
    return text.replace(/https?:\/\/[^\s\)]+/g, "").replace(/\n🔗 Fontes:[\s\S]*$/, "").trim()
  }

  // Fallback quando skill não tem durationOptions definidas
  const FALLBACK_SHORT = [
    { seconds: 30, label: "30s", strategyName: "Quick", strategyBrief: "Punch curto", hookGuide: "", scriptGuide: "", titleGuide: "", descriptionGuide: "" },
    { seconds: 60, label: "60s", strategyName: "Standard", strategyBrief: "Balanço", hookGuide: "", scriptGuide: "", titleGuide: "", descriptionGuide: "" },
    { seconds: 90, label: "1:30", strategyName: "Story", strategyBrief: "Narrativa", hookGuide: "", scriptGuide: "", titleGuide: "", descriptionGuide: "" },
  ]
  const durationOptions = skill?.durationOptions ?? FALLBACK_SHORT
  const currentDurationOption = durationOptions.find((d) => d.seconds === targetDuration) ?? null

  // ── Save ──────────────────────────────────────────────────────────────

  function save(data: Record<string, unknown>) {
    startTransition(async () => {
      const result = await updateContentAction(content.id, data)
      if (result.success) onUpdate(result.data as Content)
    })
  }

  // Save sem transition — para auto-saves da IA que precisam ser imediatos
  async function saveNow(data: Record<string, unknown>) {
    const result = await updateContentAction(content.id, data)
    if (result.success) onUpdate(result.data as Content)
  }

  const [prePublishOpen, setPrePublishOpen] = useState(false)

  function handlePhaseChange(phase: ContentPhase) {
    // Gate: pra publicar, abre review primeiro (se vindo de fase prévia)
    if (phase === "PUBLISHED" && content.phase !== "PUBLISHED") {
      setPrePublishOpen(true)
      return
    }
    startTransition(async () => { const r = await advanceContentPhaseAction(content.id, phase); if (r.success) onUpdate(r.data as Content) })
  }

  function confirmPublish() {
    setPrePublishOpen(false)
    startTransition(async () => {
      const r = await advanceContentPhaseAction(content.id, "PUBLISHED")
      if (r.success) onUpdate(r.data as Content)
    })
  }

  function handleArchive() {
    startTransition(async () => { const r = await archiveContentAction(content.id); if (r.success) { onArchive(content.id); onClose() } })
  }

  function handleToggleArea(areaId: string) {
    const next = localAreaIds.includes(areaId) ? localAreaIds.filter((id) => id !== areaId) : [...localAreaIds, areaId]
    setLocalAreaIds(next); save({ areaIds: next })
  }

  // ── AI ────────────────────────────────────────────────────────────────

  const callAI = useCallback(async (action: string, extraContext?: string) => {
    setAiLoading(action); setAiResult(null); setAiOptions(null); setAiAction(action); setAiField(null)
    try {
      const res = await fetch("/api/content/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action, skill: content.skill, phase: content.phase, title, hook, script,
          notes: notes + (extraContext ? `\nConsiderações: ${extraContext}` : ""),
          research, series: null, targetDuration,
          durationStrategy: currentDurationOption ? {
            strategyName: currentDurationOption.strategyName,
            strategyBrief: currentDurationOption.strategyBrief,
            hookGuide: currentDurationOption.hookGuide,
            scriptGuide: currentDurationOption.scriptGuide,
            titleGuide: currentDurationOption.titleGuide,
            descriptionGuide: currentDurationOption.descriptionGuide,
          } : null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.type === "options" && data.options) {
          setAiOptions(data.options); setAiField(data.field)
        } else {
          const result = data.result
          setAiResult(result)
          // Auto-save text results to the corresponding field
          const autoSaveMap: Record<string, [string, (v: string) => void]> = {
            generate_script: ["script", setScript],
            generate_description: ["description", setDescription],
            generate_thumbnail: ["thumbnailNotes", setThumbnailNotes],
            generate_editing_notes: ["notes", setNotes],
          }
          const mapping = autoSaveMap[action]
          if (mapping) {
            const [dbField, setter] = mapping
            setter(result)
            await saveNow({ [dbField]: result })
          } else if (action === "deep_research" || action === "generate_research") {
            if (research.trim()) {
              const combined = `${research}\n\n---\n\n${result}`
              setResearch(combined)
              await saveNow({ research: combined })
            } else {
              setResearch(result)
              await saveNow({ research: result })
            }
          }
        }
      } else setAiResult("Erro. Verifique a ANTHROPIC_API_KEY.")
    } catch { setAiResult("Erro de conexão.") }
    setAiLoading(null); setAiConsideration("")
  }, [content.skill, content.phase, title, hook, script, notes, research, targetDuration, currentDurationOption])

  async function selectOption(opt: any) {
    if (aiField === "hook") { setHook(opt.text); await saveNow({ hook: opt.text }) }
    else if (aiField === "title") { setTitle(opt.text); await saveNow({ title: opt.text }) }
    setAiOptions(null); setAiField(null)
  }

  function useResult(field: string) {
    if (!aiResult) return
    if (field === "research" && research.trim()) {
      const combined = `${research}\n\n---\n\n${aiResult}`
      setResearch(combined); save({ research: combined })
    } else {
      const map: Record<string, [string, (v: string) => void]> = {
        script: ["script", setScript], research: ["research", setResearch],
        thumbnailNotes: ["thumbnailNotes", setThumbnailNotes], description: ["description", setDescription],
      }
      const [key, setter] = map[field] ?? []
      if (key && setter) { setter(aiResult); save({ [key]: aiResult }) }
    }
    setAiResult(null); setAiAction(null)
  }

  function regenerate() { if (aiAction && aiConsideration.trim()) callAI(aiAction, aiConsideration) }

  // ── Components ────────────────────────────────────────────────────────

  function AiBtn({ action, label }: { action: string; label: string }) {
    return (
      <button onClick={() => callAI(action)} disabled={!!aiLoading}
        className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl border bg-accent/5 border-accent/20 text-accent hover:bg-accent/15 transition-all disabled:opacity-50">
        {aiLoading === action ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {label}
      </button>
    )
  }

  function Field({ label, value, onChange, field, placeholder, rows, mono }: {
    label: string; value: string; onChange: (v: string) => void; field: string; placeholder: string; rows: number; mono?: boolean
  }) {
    return (
      <div>
        <p className="text-xs font-medium text-cockpit-muted mb-2">{label}</p>
        <textarea value={value} onChange={(e) => onChange(e.target.value)}
          onBlur={() => save({ [field]: value || null })} placeholder={placeholder} rows={rows}
          className={cn("w-full px-4 py-3 bg-cockpit-bg border border-cockpit-border rounded-xl text-sm text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none leading-relaxed", mono && "font-mono text-[13px]")} />
      </div>
    )
  }

  function AiPanel({ acceptField }: { acceptField?: string }) {
    if (aiOptions && aiOptions.length > 0) return (
      <div className="rounded-xl border border-accent/30 bg-accent/5 overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-accent/20">
          <p className="text-xs font-semibold text-accent flex items-center gap-1"><Sparkles size={12} /> {aiField === "hook" ? "Escolha um hook" : aiField === "title" ? "Escolha um título" : "Opções"}</p>
          <button onClick={() => setAiOptions(null)} className="text-cockpit-muted hover:text-cockpit-text"><X size={14} /></button>
        </div>
        <div className="p-2 space-y-1.5 max-h-80 overflow-y-auto">{aiOptions.map((opt: any, i: number) => (
          <button key={i} onClick={() => selectOption(opt)} className="w-full text-left p-3 rounded-xl border border-cockpit-border bg-cockpit-bg hover:border-accent/40 hover:bg-accent/5 transition-all group">
            <p className="text-sm text-cockpit-text group-hover:text-accent font-medium">{opt.text}</p>
            {(opt.style || opt.why) && <div className="flex items-center gap-2 mt-1.5">{opt.style && <span className="text-[10px] px-2 py-0.5 rounded-full bg-cockpit-border-light text-cockpit-muted">{opt.style}</span>}{opt.why && <span className="text-[10px] text-cockpit-muted">{opt.why}</span>}</div>}
          </button>
        ))}</div>
        <RegenBar />
      </div>
    )
    if (aiResult) return (
      <div className="rounded-xl border border-accent/30 bg-accent/5 overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-accent/20">
          <p className="text-xs font-semibold text-accent flex items-center gap-1"><Sparkles size={12} /> Sugestão da IA</p>
          <button onClick={() => setAiResult(null)} className="text-cockpit-muted hover:text-cockpit-text"><X size={14} /></button>
        </div>
        <div className="px-4 py-3 text-sm text-cockpit-text whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">{aiResult}</div>
        <div className="px-4 py-2 border-t border-accent/20 flex items-center gap-2">
          {acceptField && <button onClick={() => useResult(acceptField)} className="text-xs text-accent font-semibold hover:underline">Usar esta sugestão</button>}
          <button onClick={() => setAiResult(null)} className="text-xs text-cockpit-muted hover:text-cockpit-text ml-auto">Descartar</button>
        </div>
        <RegenBar />
      </div>
    )
    return null
  }

  function RegenBar() {
    return (
      <div className="px-4 py-2.5 border-t border-accent/20 flex items-center gap-2">
        <input type="text" value={aiConsideration} onChange={(e) => setAiConsideration(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") regenerate() }}
          placeholder="Ajustes? (ex: mais curto, tom informal)..."
          className="flex-1 px-3 py-1.5 bg-cockpit-bg border border-cockpit-border rounded-lg text-xs text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-1 focus:ring-accent/30" />
        <button onClick={regenerate} disabled={!aiConsideration.trim() || !!aiLoading}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-accent font-medium border border-accent/20 rounded-lg hover:bg-accent/10 disabled:opacity-50">
          <RefreshCw size={11} /> Regenerar
        </button>
      </div>
    )
  }

  // Briefing summary item
  function BriefItem({ label, value, icon }: { label: string; value: string; icon?: string }) {
    if (!value) return null
    return (
      <div className="p-4 bg-cockpit-bg border border-cockpit-border rounded-xl">
        <p className="text-[10px] text-cockpit-muted font-medium uppercase tracking-wider mb-1.5">{icon} {label}</p>
        <p className="text-sm text-cockpit-text whitespace-pre-wrap leading-relaxed">{value}</p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-4 sm:inset-6 lg:inset-y-4 lg:left-[15%] lg:right-4 z-50 bg-cockpit-surface border border-cockpit-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-cockpit-border flex-shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {skill && <span className="text-xl">{skill.icon}</span>}
              <div className="flex-1 min-w-0">
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => { if (title.trim() && title !== content.title) save({ title }) }}
                  className="w-full text-lg font-bold text-cockpit-text bg-transparent border-b border-transparent hover:border-cockpit-border focus:border-accent focus:outline-none py-0.5" />
                <div className="flex items-center gap-2 mt-1">
                  {skill && <span className="text-[11px] text-cockpit-muted">{skill.label}</span>}
                  {targetDuration > 0 && <span className="text-[11px] text-cockpit-muted">· {targetDuration >= 60 ? `${Math.floor(targetDuration / 60)}min` : `${targetDuration}s`}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={handleArchive} className="p-2 text-cockpit-muted hover:text-amber-500 rounded-lg hover:bg-amber-500/10"><Archive size={16} /></button>
              <button onClick={onClose} className="p-2 text-cockpit-muted hover:text-cockpit-text rounded-lg hover:bg-cockpit-surface-hover"><X size={16} /></button>
            </div>
          </div>
          {/* Phase stepper */}
          <div className="flex items-center gap-2" style={{ scrollbarWidth: "none" }}>
            {PHASES.map((ph, i) => {
              const isActive = ph.id === content.phase; const isPast = i < curIdx; const Icon = ph.icon
              return (
                <button key={ph.id} onClick={() => handlePhaseChange(ph.id)}
                  className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all border flex-1 justify-center",
                    isActive ? "bg-accent text-black border-accent" : isPast ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "border-cockpit-border text-cockpit-muted hover:border-cockpit-text/30")}>
                  <Icon size={14} /> {ph.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* ═══ IDEALIZAÇÃO ═══ */}
            {content.phase === "IDEATION" && (<>
              {/* Skill selector */}
              <div>
                <p className="text-xs font-medium text-cockpit-muted mb-3">Selecione o tipo de conteúdo</p>
                <div className="grid grid-cols-2 gap-2">
                  {SKILL_LIST.map((s) => {
                    const platformMap: Record<string, string> = { INSTAGRAM_REELS: "INSTAGRAM", YOUTUBE_SHORTS: "YOUTUBE", YOUTUBE_VIDEO: "YOUTUBE", TIKTOK_VIDEO: "TIKTOK" }
                    const formatMap: Record<string, string> = { INSTAGRAM_REELS: "REELS", YOUTUBE_SHORTS: "SHORT", YOUTUBE_VIDEO: "LONG_VIDEO", TIKTOK_VIDEO: "SHORT" }
                    return (
                      <button key={s.id} onClick={() => save({ skill: s.id, platform: platformMap[s.id] || "YOUTUBE", format: formatMap[s.id] || "SHORT" })}
                        className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                          content.skill === s.id ? "border-accent bg-accent/10" : "border-cockpit-border hover:border-accent/30")}>
                        <span className="text-2xl">{s.icon}</span>
                        <div>
                          <p className={cn("text-xs font-semibold", content.skill === s.id ? "text-accent" : "text-cockpit-text")}>{s.label}</p>
                          <p className="text-[10px] text-cockpit-muted leading-tight">{s.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Research base — why this idea was chosen */}
              {research && (() => {
                const textOnly = renderTextOnly(research)
                const { ptBr, en } = extractLinks(research)
                const hasLinks = ptBr.length > 0 || en.length > 0
                return (
                  <div className="space-y-3">
                    {/* Description */}
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-blue-500/15">
                        <p className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">📰 Por que esta ideia foi escolhida</p>
                      </div>
                      <div className="px-4 py-3 text-sm text-cockpit-text whitespace-pre-wrap leading-relaxed">{textOnly}</div>
                    </div>

                    {/* Links separated by language */}
                    {hasLinks && (
                      <div className="grid grid-cols-2 gap-3">
                        {/* PT-BR */}
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
                          <div className="px-3 py-2 border-b border-emerald-500/15">
                            <p className="text-[11px] font-semibold text-emerald-400">🇧🇷 Fontes em Português</p>
                          </div>
                          <div className="px-3 py-2 space-y-1.5">
                            {ptBr.length > 0 ? ptBr.map((link, i) => (
                              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cockpit-bg border border-cockpit-border rounded-lg text-xs text-cockpit-text hover:border-emerald-500/40 hover:text-emerald-400 transition-colors truncate">
                                🔗 {link.host}
                              </a>
                            )) : (
                              <p className="text-[10px] text-cockpit-muted py-1">Nenhuma fonte PT-BR encontrada</p>
                            )}
                          </div>
                        </div>

                        {/* EN */}
                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 overflow-hidden">
                          <div className="px-3 py-2 border-b border-blue-500/15">
                            <p className="text-[11px] font-semibold text-blue-400">🇺🇸 Fontes em Inglês</p>
                          </div>
                          <div className="px-3 py-2 space-y-1.5">
                            {en.length > 0 ? en.map((link, i) => (
                              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cockpit-bg border border-cockpit-border rounded-lg text-xs text-cockpit-text hover:border-blue-500/40 hover:text-blue-400 transition-colors truncate">
                                🔗 {link.host}
                              </a>
                            )) : (
                              <p className="text-[10px] text-cockpit-muted py-1">Nenhuma fonte EN encontrada</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </>)}

            {/* ═══ ELABORAÇÃO ═══ */}
            {content.phase === "ELABORATION" && (<>
              {/* Duration + Strategy (skill dita estratégia por duração) */}
              <div>
                <p className="text-xs font-medium text-cockpit-muted mb-2">Duração & estratégia</p>
                <div className="grid grid-cols-3 gap-2">{durationOptions.map((p) => (
                  <button key={p.seconds} onClick={() => { setTargetDuration(p.seconds); save({ targetDuration: p.seconds }) }}
                    className={cn("p-3 rounded-xl text-left border transition-all", targetDuration === p.seconds ? "bg-accent/10 text-cockpit-text border-accent shadow-sm" : "border-cockpit-border text-cockpit-muted hover:border-accent/30")}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className={cn("text-sm font-bold", targetDuration === p.seconds ? "text-accent" : "text-cockpit-text")}>{p.label}</span>
                      <span className="text-[10px] font-medium opacity-70">{p.strategyName}</span>
                    </div>
                    <p className="text-[10px] leading-snug opacity-70">{p.strategyBrief}</p>
                  </button>
                ))}</div>
                {currentDurationOption && (
                  <div className="mt-2 p-2.5 bg-accent/5 border border-accent/20 rounded-lg text-[11px] text-cockpit-muted">
                    <span className="font-semibold text-accent">{currentDurationOption.strategyName}</span> · {currentDurationOption.strategyBrief}
                  </div>
                )}
              </div>

              {/* Sub-sections */}
              <div className="flex items-center gap-1 bg-cockpit-border-light rounded-xl p-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {ELAB_SECTIONS.map((s) => {
                  const hasContent =
                    s === "pesquisa" ? !!research :
                    s === "hook" ? !!hook :
                    s === "roteiro" ? !!script :
                    s === "titulo" ? true :
                    s === "thumbnail" ? !!thumbnailNotes :
                    s === "descricao" ? !!description :
                    s === "score" ? false : // score é dinâmico — não mostra dot
                    false
                  return (
                    <button key={s} onClick={() => { setActiveSection(s); setAiResult(null); setAiOptions(null) }}
                      className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1",
                        activeSection === s ? "bg-cockpit-surface text-cockpit-text shadow-sm" : "text-cockpit-muted hover:text-cockpit-text")}>
                      {ELAB_LABEL[s]}
                      {hasContent && s !== "titulo" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    </button>
                  )
                })}
              </div>

              {activeSection === "pesquisa" && (<>
                <ReferencesBlock data={references} loading={referencesLoading} />
                <div className="flex flex-wrap gap-2"><AiBtn action="deep_research" label="Pesquisar mais sobre o tema" /></div>
                <AiPanel acceptField="research" />
                <Field label="Notas de pesquisa adicionais" value={research} onChange={setResearch} field="research" placeholder="Links extras, dados, inspirações (fora das fontes da pesquisa)..." rows={8} />
              </>)}

              {activeSection === "hook" && (<>
                <div className="flex flex-wrap gap-2"><AiBtn action="generate_hook" label="Gerar hooks com IA" /></div>
                <AiPanel />
                <Field label="Hook" value={hook} onChange={setHook} field="hook" placeholder="O gancho dos primeiros segundos..." rows={3} />
              </>)}

              {activeSection === "roteiro" && (<>
                <div className="flex flex-wrap gap-2"><AiBtn action="generate_script" label="Gerar roteiro com IA" /></div>
                <AiPanel acceptField="script" />
                <Field label="Roteiro" value={script} onChange={setScript} field="script" placeholder="Escreva o roteiro completo..." rows={16} mono />
                {skill && skill.scriptTemplates.length > 0 && !script && (
                  <div><p className="text-[10px] text-cockpit-muted font-medium mb-2">Templates:</p><div className="grid grid-cols-2 gap-2">{skill.scriptTemplates.map((t) => (
                    <button key={t.name} onClick={() => { setScript(t.structure.join("\n\n")); save({ script: t.structure.join("\n\n") }) }}
                      className="text-left p-2.5 bg-cockpit-bg border border-cockpit-border rounded-xl hover:border-accent/30">
                      <p className="text-xs font-medium text-cockpit-text">{t.name}</p><p className="text-[10px] text-cockpit-muted mt-0.5 line-clamp-2">{t.structure.join(" → ")}</p>
                    </button>
                  ))}</div></div>
                )}
              </>)}

              {activeSection === "titulo" && (<>
                <div className="flex flex-wrap gap-2"><AiBtn action="generate_titles" label="Gerar opções de título" /></div>
                <AiPanel />
                <div><p className="text-xs font-medium text-cockpit-muted mb-2">Título</p>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => save({ title })}
                    className="w-full px-4 py-3 bg-cockpit-bg border border-cockpit-border rounded-xl text-base font-semibold text-cockpit-text focus:outline-none focus:ring-2 focus:ring-accent/30" /></div>
              </>)}

              {activeSection === "thumbnail" && (<>
                <div className="flex flex-wrap gap-2"><AiBtn action="generate_thumbnail" label="Gerar conceitos visuais" /></div>
                <AiPanel acceptField="thumbnailNotes" />
                <Field label="Notas da Thumbnail" value={thumbnailNotes} onChange={setThumbnailNotes} field="thumbnailNotes" placeholder="Composição, expressão, texto, cores..." rows={8} />
              </>)}

              {activeSection === "descricao" && (<>
                <div className="flex flex-wrap gap-2"><AiBtn action="generate_description" label="Gerar descrição e hashtags" /></div>
                <AiPanel acceptField="description" />
                <Field label="Descrição / Caption" value={description} onChange={setDescription} field="description" placeholder="Descrição para a plataforma..." rows={8} />
              </>)}

              {activeSection === "score" && (
                <SeoScorePanel
                  title={title}
                  hook={hook}
                  script={script}
                  description={description}
                  targetDuration={targetDuration}
                  platform={content.platform}
                  format={content.format}
                  skill={content.skill}
                />
              )}
            </>)}

            {/* ═══ BRIEFING (resumo para gravação) ═══ */}
            {content.phase === "BRIEFING" && (<>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ClipboardList size={18} className="text-amber-500" />
                  <div>
                    <h2 className="text-sm font-bold text-cockpit-text">Briefing para Gravação</h2>
                    <p className="text-[10px] text-cockpit-muted">Guia estruturado com frases de destaque por bloco</p>
                  </div>
                </div>
                <AiBtn action="generate_briefing" label="Gerar briefing com IA" />
              </div>

              <AiPanel acceptField="notes" />

              {/* Quick info bar */}
              <div className="flex flex-wrap gap-3 p-3 bg-cockpit-bg border border-cockpit-border rounded-xl">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-cockpit-muted">🎯</span>
                  <span className="text-xs font-semibold text-cockpit-text">{title}</span>
                </div>
                {targetDuration > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-cockpit-muted">⏱️</span>
                    <span className="text-xs font-bold text-accent">{targetDuration >= 60 ? `${Math.floor(targetDuration / 60)}min` : `${targetDuration}s`}</span>
                  </div>
                )}
                {skill && <span className="text-[10px] text-cockpit-muted">{skill.icon} {skill.label}</span>}
              </div>

              {/* Hook */}
              {hook && (
                <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                  <p className="text-[10px] text-amber-500 font-semibold uppercase tracking-wider mb-1">🎣 Hook — abra com isso</p>
                  <p className="text-sm font-medium text-cockpit-text italic">"{hook}"</p>
                </div>
              )}

              {/* Briefing content (AI-generated or manual notes) */}
              {notes ? (
                <div className="p-4 bg-cockpit-bg border border-cockpit-border rounded-xl">
                  <p className="text-[10px] text-cockpit-muted font-semibold uppercase tracking-wider mb-3">📋 Briefing estruturado</p>
                  <div className="text-sm text-cockpit-text whitespace-pre-wrap leading-relaxed prose-sm max-w-none
                    [&_strong]:text-accent [&_strong]:font-bold
                    [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-cockpit-text [&_h1]:mt-4 [&_h1]:mb-2
                    [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-cockpit-text [&_h2]:mt-3 [&_h2]:mb-1.5
                    [&_h3]:text-xs [&_h3]:font-bold [&_h3]:text-cockpit-text [&_h3]:mt-2 [&_h3]:mb-1">
                    {notes}
                  </div>
                </div>
              ) : (
                <div className="p-8 border-2 border-dashed border-cockpit-border rounded-xl text-center text-cockpit-muted">
                  <ClipboardList size={24} strokeWidth={1} className="mx-auto mb-2" />
                  <p className="text-xs">Clique "Gerar briefing com IA" para criar o guia estruturado</p>
                  <p className="text-[10px] mt-1">Cada bloco terá uma frase de destaque que não pode faltar</p>
                </div>
              )}

              {/* Roteiro completo (colapsável) */}
              {script && (
                <details className="rounded-xl border border-cockpit-border overflow-hidden">
                  <summary className="px-4 py-3 text-xs font-medium text-cockpit-muted cursor-pointer hover:bg-cockpit-surface-hover">📝 Roteiro completo (referência)</summary>
                  <div className="px-4 py-3 border-t border-cockpit-border text-sm text-cockpit-text whitespace-pre-wrap font-mono text-[13px] max-h-64 overflow-y-auto">{script}</div>
                </details>
              )}

              {/* Descrição (colapsável) */}
              {description && (
                <details className="rounded-xl border border-cockpit-border overflow-hidden">
                  <summary className="px-4 py-3 text-xs font-medium text-cockpit-muted cursor-pointer hover:bg-cockpit-surface-hover">📋 Descrição / Caption</summary>
                  <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted whitespace-pre-wrap max-h-32 overflow-y-auto">{description}</div>
                </details>
              )}

              {/* Fontes (clicáveis, do IdeaFeed → NewsEvidence) */}
              <ReferencesBlock data={references} loading={referencesLoading} />

              {/* Research livre do usuário (colapsável, só texto adicional que ele escreveu) */}
              {research && (
                <details className="rounded-xl border border-cockpit-border overflow-hidden">
                  <summary className="px-4 py-3 text-xs font-medium text-cockpit-muted cursor-pointer hover:bg-cockpit-surface-hover">📝 Notas de pesquisa adicionais</summary>
                  <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted whitespace-pre-wrap max-h-48 overflow-y-auto">{research}</div>
                </details>
              )}
            </>)}

            {/* ═══ EM EDIÇÃO ═══ */}
            {content.phase === "EDITING_SENT" && (<>
              <div>
                <p className="text-xs font-medium text-cockpit-muted mb-2">Link do vídeo bruto (Google Drive)</p>
                <input type="url" value={rawVideoUrl} onChange={(e) => setRawVideoUrl(e.target.value)}
                  onBlur={() => save({ rawVideoUrl: rawVideoUrl || null })} placeholder="https://drive.google.com/..."
                  className="w-full px-4 py-3 bg-cockpit-bg border border-cockpit-border rounded-xl text-sm text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-accent/30" />
                {rawVideoUrl && <a href={rawVideoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-accent hover:underline mt-2"><ExternalLink size={12} /> Abrir vídeo bruto</a>}
              </div>

              <div className="flex flex-wrap gap-2">
                <AiBtn action="generate_editing_notes" label="Gerar guia de edição com IA" />
              </div>
              <AiPanel acceptField="notes" />

              <Field label="Guia de edição — indicações técnicas" value={notes} onChange={setNotes} field="notes" placeholder="Onde cortar, B-roll sugerido, zoom, texto overlay, música, SFX, transições, efeitos..." rows={10} />

              {script && (
                <details className="rounded-xl border border-cockpit-border overflow-hidden">
                  <summary className="px-4 py-3 text-xs font-medium text-cockpit-muted cursor-pointer hover:bg-cockpit-surface-hover">📝 Roteiro (referência)</summary>
                  <div className="px-4 py-3 border-t border-cockpit-border text-xs text-cockpit-muted whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">{script}</div>
                </details>
              )}
            </>)}

            {/* ═══ PUBLICADO ═══ */}
            {content.phase === "PUBLISHED" && (<>
              <div>
                <p className="text-xs font-medium text-cockpit-muted mb-2">Link publicado</p>
                <input type="url" value={content.publishedUrl ?? ""} onChange={(e) => save({ publishedUrl: e.target.value || null })}
                  placeholder="https://youtube.com/watch?v=..." className="w-full px-4 py-3 bg-cockpit-bg border border-cockpit-border rounded-xl text-sm text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-accent/30" />
                {content.publishedUrl && <a href={content.publishedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-accent hover:underline mt-2"><ExternalLink size={12} /> Abrir</a>}
              </div>
              <div className="flex flex-wrap gap-2"><AiBtn action="review" label="Analisar performance com IA" /></div>
              <AiPanel />
              <Field label="Métricas & Lições" value={notes} onChange={setNotes} field="notes" placeholder="Views, CTR, retenção, o que funcionou..." rows={6} />
            </>)}

          </div>

          {/* Sidebar */}
          <div className="hidden lg:flex w-72 flex-shrink-0 border-l border-cockpit-border flex-col overflow-y-auto">
            <div className="px-4 py-5 space-y-5">
              {areas.length > 0 && (
                <div><p className="text-[10px] text-cockpit-muted font-medium uppercase tracking-wider mb-2">Áreas</p>
                  <div className="flex flex-wrap gap-1.5">{areas.map((a) => (
                    <button key={a.id} onClick={() => handleToggleArea(a.id)} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all", localAreaIds.includes(a.id) ? "border-transparent text-white" : "border-cockpit-border text-cockpit-muted")} style={localAreaIds.includes(a.id) ? { backgroundColor: a.color } : undefined}>{a.icon} {a.name}</button>
                  ))}</div></div>
              )}
              {content.phase !== "BRIEFING" && (
                <div><p className="text-[10px] text-cockpit-muted font-medium uppercase tracking-wider mb-2">Anotações</p>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => save({ notes: notes || null })} placeholder="Notas livres..." rows={4}
                    className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-xl text-xs text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-1 focus:ring-accent/30 resize-none" /></div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-cockpit-border bg-cockpit-bg/50 flex items-center justify-between flex-shrink-0">
          {prevPhase ? (
            <button onClick={() => handlePhaseChange(prevPhase.id)} className="flex items-center gap-1 px-3 py-2 text-xs text-cockpit-muted hover:text-cockpit-text border border-cockpit-border rounded-xl"><ChevronLeft size={13} /> {prevPhase.label}</button>
          ) : <div />}
          <div className="flex items-center gap-2">
            {isPending && <Loader2 size={14} className="animate-spin text-cockpit-muted" />}
            <span className="text-[10px] text-cockpit-muted">Salva automaticamente</span>
          </div>
          {nextPhase ? (
            <button onClick={() => handlePhaseChange(nextPhase.id)}
              className="flex items-center gap-1 px-4 py-2 bg-accent text-black text-xs font-semibold rounded-xl hover:bg-accent-hover">{nextPhase.label} <ChevronRight size={13} /></button>
          ) : <div />}
        </div>
      </div>

      {/* Pre-publish gate (modal) */}
      <PrePublishGate
        open={prePublishOpen}
        onClose={() => setPrePublishOpen(false)}
        onConfirm={confirmPublish}
        content={{
          title,
          hook,
          script,
          description,
          targetDuration,
          platform: content.platform,
          format: content.format,
          skill: content.skill,
          publishedUrl: content.publishedUrl,
        }}
      />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ReferencesBlock — cards clicáveis com fontes (primária + apoio)
// Usa IdeaFeed → NewsEvidence via getContentReferencesAction
// ═══════════════════════════════════════════════════════════════════════════

function ReferencesBlock({ data, loading, compact = false }: { data: ReferencesData | null; loading: boolean; compact?: boolean }) {
  if (loading) {
    return (
      <div className="p-4 border border-cockpit-border rounded-xl bg-cockpit-bg">
        <div className="flex items-center gap-2 text-xs text-cockpit-muted"><Loader2 size={12} className="animate-spin" /> Carregando fontes…</div>
      </div>
    )
  }
  if (!data || (!data.primary && data.supporting.length === 0)) return null

  const langLabel = (l: string) => l === "pt-BR" ? "🇧🇷 PT" : l === "en" ? "🇺🇸 EN" : l === "es" ? "🇪🇸 ES" : l
  const tierBadge = (t: string) => {
    if (t === "TIER_1") return { text: "Tier 1", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" }
    if (t === "TIER_2") return { text: "Tier 2", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" }
    if (t === "BLOG") return { text: "Blog", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" }
    if (t === "AGGREGATOR") return { text: "Agreg.", cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" }
    return { text: "—", cls: "bg-zinc-500/15 text-zinc-500 border-zinc-500/30" }
  }

  const Card = ({ ref: r, isPrimary }: { ref: RefCard; isPrimary?: boolean }) => {
    const tier = tierBadge(r.sourceAuthority)
    return (
      <a href={r.url} target="_blank" rel="noopener noreferrer"
        className={cn(
          "block p-3 rounded-xl border transition-all group",
          isPrimary
            ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50"
            : "border-cockpit-border bg-cockpit-bg hover:border-accent/40 hover:bg-cockpit-surface-hover"
        )}>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className={cn("px-1.5 py-0.5 rounded border font-semibold", tier.cls)}>{tier.text}</span>
            <span className="text-cockpit-muted">{langLabel(r.language)}</span>
            <span className="text-cockpit-muted">· {r.host}</span>
          </div>
          <ExternalLink size={11} className="text-cockpit-muted group-hover:text-accent flex-shrink-0" />
        </div>
        <p className="text-xs font-semibold text-cockpit-text leading-snug mb-1 group-hover:text-accent transition-colors">
          {r.title}
        </p>
        {!compact && r.summary && (
          <p className="text-[11px] text-cockpit-muted line-clamp-2 leading-relaxed">{r.summary}</p>
        )}
        {!compact && r.keyQuote && (
          <p className="text-[10px] italic text-cockpit-muted mt-1.5 pl-2 border-l-2 border-cockpit-border line-clamp-2">
            &ldquo;{r.keyQuote}&rdquo;
          </p>
        )}
      </a>
    )
  }

  return (
    <div className="rounded-xl border border-cockpit-border overflow-hidden">
      <div className="px-4 py-2.5 border-b border-cockpit-border bg-cockpit-surface/50 flex items-center justify-between">
        <p className="text-xs font-semibold text-cockpit-text flex items-center gap-1.5">
          📚 Fontes da pesquisa
          <span className="text-[10px] text-cockpit-muted font-normal">
            · {(data.primary ? 1 : 0) + data.supporting.length} link{((data.primary ? 1 : 0) + data.supporting.length) > 1 ? "s" : ""}
          </span>
        </p>
        {data.viralScore != null && (
          <span className="text-[10px] text-cockpit-muted">viral {data.viralScore}/100 {data.hasInternationalCoverage ? "· 🌎" : ""}</span>
        )}
      </div>
      <div className="p-3 space-y-2">
        {data.primary && (
          <div>
            <p className="text-[9px] uppercase tracking-wider text-amber-500 font-semibold mb-1.5">Primária</p>
            <Card ref={data.primary} isPrimary />
          </div>
        )}
        {data.supporting.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-wider text-cockpit-muted font-semibold mb-1.5 mt-2">Apoio ({data.supporting.length})</p>
            <div className="space-y-1.5">
              {data.supporting.map((r) => <Card key={r.id} ref={r} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
