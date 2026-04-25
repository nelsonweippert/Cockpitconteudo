import { Loader2, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

export type RefCard = {
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

export type ReferencesData = {
  primary: RefCard | null
  supporting: RefCard[]
  ideaTitle?: string
  ideaTerm?: string
  viralScore?: number
  hasInternationalCoverage?: boolean
}

const langLabel = (l: string) => l === "pt-BR" ? "🇧🇷 PT" : l === "en" ? "🇺🇸 EN" : l === "es" ? "🇪🇸 ES" : l
const tierBadge = (t: string) => {
  if (t === "TIER_1") return { text: "Tier 1", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" }
  if (t === "TIER_2") return { text: "Tier 2", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" }
  if (t === "BLOG") return { text: "Blog", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" }
  if (t === "AGGREGATOR") return { text: "Agreg.", cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" }
  return { text: "—", cls: "bg-zinc-500/15 text-zinc-500 border-zinc-500/30" }
}

function ReferenceCard({ card, isPrimary, compact }: { card: RefCard; isPrimary?: boolean; compact?: boolean }) {
  const tier = tierBadge(card.sourceAuthority)
  return (
    <a href={card.url} target="_blank" rel="noopener noreferrer"
      className={cn(
        "block p-3 rounded-xl border transition-all group",
        isPrimary
          ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50"
          : "border-cockpit-border bg-cockpit-bg hover:border-accent/40 hover:bg-cockpit-surface-hover"
      )}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className={cn("px-1.5 py-0.5 rounded border font-semibold", tier.cls)}>{tier.text}</span>
          <span className="text-cockpit-muted">{langLabel(card.language)}</span>
          <span className="text-cockpit-muted">· {card.host}</span>
        </div>
        <ExternalLink size={11} className="text-cockpit-muted group-hover:text-accent flex-shrink-0" />
      </div>
      <p className="text-xs font-semibold text-cockpit-text leading-snug mb-1 group-hover:text-accent transition-colors">
        {card.title}
      </p>
      {!compact && card.summary && (
        <p className="text-[11px] text-cockpit-muted line-clamp-2 leading-relaxed">{card.summary}</p>
      )}
      {!compact && card.keyQuote && (
        <p className="text-[10px] italic text-cockpit-muted mt-1.5 pl-2 border-l-2 border-cockpit-border line-clamp-2">
          &ldquo;{card.keyQuote}&rdquo;
        </p>
      )}
    </a>
  )
}

export function ReferencesBlock({ data, loading, compact = false }: { data: ReferencesData | null; loading: boolean; compact?: boolean }) {
  if (loading) {
    return (
      <div className="p-4 border border-cockpit-border rounded-xl bg-cockpit-bg">
        <div className="flex items-center gap-2 text-xs text-cockpit-muted"><Loader2 size={12} className="animate-spin" /> Carregando fontes…</div>
      </div>
    )
  }
  if (!data || (!data.primary && data.supporting.length === 0)) return null

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
            <ReferenceCard card={data.primary} isPrimary compact={compact} />
          </div>
        )}
        {data.supporting.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-wider text-cockpit-muted font-semibold mb-1.5 mt-2">Apoio ({data.supporting.length})</p>
            <div className="space-y-1.5">
              {data.supporting.map((r) => <ReferenceCard key={r.id} card={r} compact={compact} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
