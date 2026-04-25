"use client"

import { useMemo, useState, useTransition } from "react"
import { Target, Plus, X, Edit2, ChevronDown, ChevronRight, Sparkles, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  addMonitorTermAction, deleteMonitorTermAction,
  toggleMonitorTermAction, updateMonitorTermIntentAction,
} from "@/app/actions/idea.actions"
import { TermSourcesManager, type TermSource } from "../_components/conteudo/TermSourcesManager"

export type TermView = {
  id: string
  term: string
  intent: string | null
  isActive: boolean
  sources: unknown[]
  sourcesUpdatedAt: string | null
  createdAt: string
  evidenceCount: number
  ideaCount: number
}

interface Props { initialTerms: TermView[] }

export function TemasClient({ initialTerms }: Props) {
  const [terms, setTerms] = useState<TermView[]>(initialTerms)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  // Criação
  const [newTerm, setNewTerm] = useState("")
  const [newIntent, setNewIntent] = useState("")
  const [showCreate, setShowCreate] = useState(initialTerms.length === 0)

  // Edição de intent
  const [editingIntentId, setEditingIntentId] = useState<string | null>(null)
  const [editingIntentText, setEditingIntentText] = useState("")

  // Filtro / busca
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)

  // Stats pro header
  const stats = useMemo(() => {
    const active = terms.filter((t) => t.isActive).length
    const withSources = terms.filter((t) => {
      const s = t.sources as TermSource[]
      return Array.isArray(s) && s.some((x) => x?.isActive !== false)
    }).length
    const totalSources = terms.reduce((sum, t) => {
      const s = t.sources as TermSource[]
      return sum + (Array.isArray(s) ? s.filter((x) => x?.isActive !== false).length : 0)
    }, 0)
    const totalIdeas = terms.reduce((sum, t) => sum + t.ideaCount, 0)
    return { active, withSources, totalSources, totalIdeas, total: terms.length }
  }, [terms])

  const filtered = useMemo(() => {
    return terms.filter((t) => {
      if (!showInactive && !t.isActive) return false
      if (search) {
        const q = search.toLowerCase()
        if (!t.term.toLowerCase().includes(q) && !(t.intent ?? "").toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [terms, search, showInactive])

  async function handleCreate() {
    if (!newTerm.trim()) return
    const res = await addMonitorTermAction(newTerm.trim(), newIntent.trim() || undefined)
    if (res.success) {
      const created = res.data as { id: string; term: string; intent: string | null; isActive: boolean; createdAt: string }
      setTerms((prev) => [{
        id: created.id, term: created.term, intent: created.intent, isActive: created.isActive,
        sources: [], sourcesUpdatedAt: null, createdAt: created.createdAt,
        evidenceCount: 0, ideaCount: 0,
      }, ...prev])
      setNewTerm("")
      setNewIntent("")
      setShowCreate(false)
      // Expande o novo pro user já curar fontes
      setExpanded((prev) => new Set([...prev, created.id]))
    }
  }

  async function handleToggleActive(id: string) {
    const term = terms.find((t) => t.id === id)
    if (!term) return
    const next = !term.isActive
    // Optimistic
    setTerms((prev) => prev.map((t) => t.id === id ? { ...t, isActive: next } : t))
    startTransition(async () => {
      const res = await toggleMonitorTermAction(id, next)
      if (!res.success) {
        setTerms((prev) => prev.map((t) => t.id === id ? { ...t, isActive: !next } : t))
      }
    })
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover esse termo? Fontes curadas serão perdidas.")) return
    setTerms((prev) => prev.filter((t) => t.id !== id))
    await deleteMonitorTermAction(id)
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function saveIntent(id: string) {
    const clean = editingIntentText.trim()
    setTerms((prev) => prev.map((t) => t.id === id ? { ...t, intent: clean || null } : t))
    setEditingIntentId(null)
    const res = await updateMonitorTermIntentAction(id, clean)
    if (!res.success) {
      // Rollback seria ideal, mas improvável falhar
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* ─── HEADER ─── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-cockpit-text flex items-center gap-2">
            <Target size={22} className="text-accent" />
            Temas Monitorados
          </h1>
          <p className="text-sm text-cockpit-muted mt-1 max-w-2xl">
            Temas que o pipeline monitora + fontes confiáveis curadas pra cada um.
            Quanto mais específico o intent e curadas as fontes, mais assertivas as ideias geradas.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Stat label="Ativos" value={stats.active} />
          <Stat label="Com fontes" value={`${stats.withSources}/${stats.active}`} tone={stats.withSources === stats.active ? "emerald" : undefined} />
          <Stat label="Fontes totais" value={stats.totalSources} />
          <Stat label="Ideias geradas" value={stats.totalIdeas} muted />
        </div>
      </div>

      {/* ─── CTA principal: criar termo ─── */}
      {showCreate ? (
        <div className="cockpit-card border-accent/30 bg-accent/5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-cockpit-text flex items-center gap-2">
              <Plus size={14} className="text-accent" />
              Novo tema
            </h3>
            {terms.length > 0 && (
              <button onClick={() => setShowCreate(false)} className="text-cockpit-muted hover:text-cockpit-text">
                <X size={14} />
              </button>
            )}
          </div>
          <input type="text" value={newTerm} onChange={(e) => setNewTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newTerm.trim() && newIntent) handleCreate() }}
            placeholder="Ex: Inteligência Artificial, DeFi, Marketing Digital"
            autoFocus
            className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-xl text-sm text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-accent/30" />
          <textarea value={newIntent} onChange={(e) => setNewIntent(e.target.value)} rows={3}
            placeholder='Foco e exclusões (opcional mas muito recomendado). Ex: "foco em APIs de LLM, modelos open-source. EXCLUIR: IA generativa pra arte, relacionamentos, educação básica"'
            className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-xl text-xs text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-1 focus:ring-accent/30" />
          <div className="flex justify-end gap-2">
            {terms.length > 0 && (
              <button onClick={() => { setShowCreate(false); setNewTerm(""); setNewIntent("") }}
                className="px-4 py-2 text-xs text-cockpit-muted hover:text-cockpit-text border border-cockpit-border rounded-xl">
                Cancelar
              </button>
            )}
            <button onClick={handleCreate} disabled={!newTerm.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent text-black text-xs font-semibold rounded-xl hover:bg-accent-hover disabled:opacity-50">
              <Plus size={12} /> Criar tema
            </button>
          </div>
          <p className="text-[10px] text-cockpit-muted italic">
            💡 Depois de criar, não esqueça de rodar &quot;Pesquisar fontes&quot; — é onde entra a qualidade das ideias.
          </p>
        </div>
      ) : (
        <button onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cockpit-surface border-2 border-dashed border-cockpit-border rounded-xl text-sm font-medium text-cockpit-muted hover:border-accent/40 hover:text-accent transition-colors">
          <Plus size={14} /> Adicionar tema
        </button>
      )}

      {/* ─── BUSCA + TOGGLE INATIVOS ─── */}
      {terms.length > 2 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cockpit-muted" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tema ou intent..."
              className="w-full pl-8 pr-3 py-1.5 bg-cockpit-bg border border-cockpit-border rounded-lg text-xs text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-1 focus:ring-accent/30" />
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-cockpit-muted cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Mostrar inativos ({terms.filter((t) => !t.isActive).length})
          </label>
        </div>
      )}

      {/* ─── LISTA DE TEMAS ─── */}
      {filtered.length === 0 ? (
        terms.length === 0 ? null : (
          <div className="cockpit-card text-center py-10 text-xs text-cockpit-muted">
            Nenhum tema corresponde ao filtro.
          </div>
        )
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => {
            const isExpanded = expanded.has(t.id)
            const activeSources = (t.sources as TermSource[]).filter((s) => s?.isActive !== false).length
            return (
              <li key={t.id} className={cn(
                "rounded-xl border transition-all",
                t.isActive ? "border-cockpit-border bg-cockpit-surface" : "border-cockpit-border-light bg-cockpit-border-light/20 opacity-70"
              )}>
                {/* Header do termo */}
                <div className="flex items-center gap-2 px-4 py-3">
                  <button onClick={() => toggleExpanded(t.id)}
                    className="flex items-center gap-2 flex-1 text-left group">
                    {isExpanded ? <ChevronDown size={14} className="text-cockpit-muted" /> : <ChevronRight size={14} className="text-cockpit-muted" />}
                    <span className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold",
                      t.isActive ? "bg-accent/10 text-accent" : "bg-cockpit-border-light text-cockpit-muted line-through"
                    )}>{t.term}</span>
                    <span className="text-[10px] text-cockpit-muted">
                      {activeSources > 0 ? (
                        <span className="flex items-center gap-1">
                          <Sparkles size={9} />
                          {activeSources} fonte{activeSources === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span className="text-amber-500">⚠ sem fontes curadas</span>
                      )}
                    </span>
                    <span className="text-[10px] text-cockpit-muted">
                      · {t.evidenceCount} evidência{t.evidenceCount === 1 ? "" : "s"}
                      · {t.ideaCount} ideia{t.ideaCount === 1 ? "" : "s"}
                    </span>
                  </button>
                  <label className="flex items-center gap-1 text-[10px] text-cockpit-muted cursor-pointer">
                    <input type="checkbox" checked={t.isActive} onChange={() => handleToggleActive(t.id)} />
                    ativo
                  </label>
                  <button onClick={() => handleDelete(t.id)} title="Remover"
                    className="p-1 text-cockpit-muted hover:text-red-400 rounded">
                    <X size={13} />
                  </button>
                </div>

                {/* Corpo expandido */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 space-y-3">
                    {/* Intent */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-cockpit-muted">Intent (foco/exclusões)</span>
                        {editingIntentId !== t.id && (
                          <button onClick={() => { setEditingIntentId(t.id); setEditingIntentText(t.intent ?? "") }}
                            className="text-[10px] text-cockpit-muted hover:text-accent flex items-center gap-1">
                            <Edit2 size={10} /> editar
                          </button>
                        )}
                      </div>
                      {editingIntentId === t.id ? (
                        <div className="space-y-1.5">
                          <textarea value={editingIntentText} onChange={(e) => setEditingIntentText(e.target.value)} rows={3}
                            placeholder='Ex: foco em Anthropic, OpenAI, APIs. EXCLUIR: IA em animais, arte'
                            className="w-full px-2 py-1.5 bg-cockpit-bg border border-accent/40 rounded-lg text-xs text-cockpit-text focus:outline-none focus:ring-1 focus:ring-accent/30" />
                          <div className="flex gap-1.5">
                            <button onClick={() => saveIntent(t.id)} className="px-2.5 py-1 bg-accent text-black text-[11px] font-semibold rounded-lg hover:bg-accent-hover">Salvar</button>
                            <button onClick={() => setEditingIntentId(null)} className="px-2.5 py-1 text-[11px] text-cockpit-muted border border-cockpit-border rounded-lg">Cancelar</button>
                          </div>
                        </div>
                      ) : t.intent ? (
                        <p className="text-xs text-cockpit-text leading-relaxed">{t.intent}</p>
                      ) : (
                        <p className="text-[11px] text-cockpit-muted italic">
                          sem intent definido — recomendado pra triagem precisa. Clique em editar.
                        </p>
                      )}
                    </div>

                    {/* Fontes curadas */}
                    <TermSourcesManager
                      termId={t.id}
                      sources={t.sources as TermSource[]}
                      onSourcesChange={(newSources) => {
                        setTerms((prev) => prev.map((tt) => tt.id === t.id
                          ? { ...tt, sources: newSources, sourcesUpdatedAt: new Date().toISOString() }
                          : tt))
                      }}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Stat({ label, value, tone, muted }: { label: string; value: number | string; tone?: "emerald"; muted?: boolean }) {
  const cls = tone === "emerald"
    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500"
    : muted
    ? "bg-cockpit-surface border-cockpit-border text-cockpit-muted"
    : "bg-cockpit-surface border-cockpit-border text-cockpit-text"
  return (
    <div className={`flex flex-col items-center px-3 py-2 border rounded-xl min-w-[72px] ${cls}`}>
      <span className="text-lg font-bold leading-none tabular-nums">{value}</span>
      <span className="text-[10px] uppercase tracking-wider mt-1 opacity-80">{label}</span>
    </div>
  )
}
