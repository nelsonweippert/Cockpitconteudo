import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const AUTHORITY_LABEL: Record<string, { label: string; color: string }> = {
  TIER_1: { label: "Tier 1", color: "#10B981" },
  TIER_2: { label: "Tier 2", color: "#3B82F6" },
  BLOG: { label: "Blog", color: "#F59E0B" },
  AGGREGATOR: { label: "Agregador", color: "#DC2626" },
  UNKNOWN: { label: "Desconhecido", color: "#6B7280" },
}

function freshnessBadge(h: number | null): { text: string; color: string } {
  if (h === null) return { text: "—", color: "#6B7280" }
  if (h < 24) return { text: `${h}h · fresco`, color: "#10B981" }
  if (h < 48) return { text: `${h}h`, color: "#3B82F6" }
  if (h < 72) return { text: `${h}h`, color: "#F59E0B" }
  return { text: `${h}h · saturado`, color: "#DC2626" }
}

function hostFrom(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "") } catch { return "—" }
}

export default async function RadarPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const userId = session.user.id

  const [evidences, totalCount, processedCount, byTerm] = await Promise.all([
    db.newsEvidence.findMany({
      where: { userId },
      include: { ideas: { select: { id: true, title: true } } },
      orderBy: [{ capturedAt: "desc" }],
      take: 60,
    }),
    db.newsEvidence.count({ where: { userId } }),
    db.newsEvidence.count({ where: { userId, processed: true } }),
    db.newsEvidence.groupBy({ by: ["term"], where: { userId }, _count: { _all: true } }),
  ])

  const conversionRate = totalCount > 0 ? ((processedCount / totalCount) * 100).toFixed(0) : "0"

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Radar de notícias</h1>
          <p className="text-sm text-cockpit-muted mt-1">
            Evidências capturadas pelo pipeline de pesquisa — fase A (antes de virar ideia).
          </p>
        </div>
        <Link href="/conteudo" className="text-xs text-cockpit-muted hover:text-cockpit-text">← Ideias</Link>
      </header>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="cockpit-card">
          <div className="text-[10px] uppercase tracking-wider text-cockpit-muted">Evidências capturadas</div>
          <div className="text-2xl font-bold mt-1">{totalCount}</div>
        </div>
        <div className="cockpit-card">
          <div className="text-[10px] uppercase tracking-wider text-cockpit-muted">Viraram ideia</div>
          <div className="text-2xl font-bold mt-1">{processedCount}</div>
          <div className="text-xs text-cockpit-muted mt-1">{conversionRate}% de conversão</div>
        </div>
        <div className="cockpit-card">
          <div className="text-[10px] uppercase tracking-wider text-cockpit-muted">Termos com sinal</div>
          <div className="text-2xl font-bold mt-1">{byTerm.length}</div>
        </div>
      </div>

      {/* Tag cloud por termo */}
      {byTerm.length > 0 && (
        <div className="cockpit-card mb-6">
          <div className="text-[10px] uppercase tracking-wider text-cockpit-muted mb-2">Capturas por termo</div>
          <div className="flex flex-wrap gap-2">
            {byTerm.map((b) => (
              <span key={b.term} className="text-xs px-2.5 py-1 rounded-full bg-[color:var(--color-app-border-light,#F3F4F6)] text-cockpit-text">
                <strong>{b.term}</strong> <span className="text-cockpit-muted">· {b._count._all}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="text-[10px] uppercase tracking-wider text-cockpit-muted mb-3">
        Últimas evidências ({evidences.length})
      </div>

      {evidences.length === 0 ? (
        <div className="cockpit-card text-center py-8">
          <p className="text-sm text-cockpit-muted">
            Nenhuma evidência capturada ainda. Rode a pesquisa em <Link href="/conteudo" className="underline">/conteudo</Link> — o radar é preenchido automaticamente.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {evidences.map((e) => {
            const auth = AUTHORITY_LABEL[e.sourceAuthority] ?? AUTHORITY_LABEL.UNKNOWN
            const fresh = freshnessBadge(e.freshnessHours)
            return (
              <li key={e.id} className="cockpit-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
                      {e.title}
                    </a>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-cockpit-muted mt-1">
                      <span><strong className="text-cockpit-text">{e.term}</strong></span>
                      <span>· {hostFrom(e.url)}</span>
                      <span>· {e.language}</span>
                      {e.publishedAt && <span>· publicado {new Date(e.publishedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: auth.color + "20", color: auth.color }}>
                      {auth.label}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: fresh.color + "20", color: fresh.color }}>
                      {fresh.text}
                    </span>
                    <span className="text-[10px] text-cockpit-muted">rel {e.relevanceScore}</span>
                  </div>
                </div>

                <p className="text-sm mt-2">{e.summary}</p>

                {e.keyQuote && (
                  <blockquote className="text-xs italic mt-2 pl-3 border-l-2 text-cockpit-muted" style={{ borderColor: "var(--color-accent)" }}>
                    "{e.keyQuote}"
                  </blockquote>
                )}

                {e.ideas.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-[10px] text-cockpit-muted mr-1">✓ virou ideia:</span>
                    {e.ideas.map((i) => (
                      <span key={i.id} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--color-accent)15", color: "var(--color-accent)" }}>
                        {i.title.slice(0, 40)}{i.title.length > 40 ? "…" : ""}
                      </span>
                    ))}
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
