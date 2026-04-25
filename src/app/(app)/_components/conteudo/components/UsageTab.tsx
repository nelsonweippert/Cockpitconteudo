import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UsageData = any

interface Props {
  usageData: UsageData | null
}

export function UsageTab({ usageData }: Props) {
  if (!usageData) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-cockpit-muted" /></div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="cockpit-card !py-3">
          <p className="text-[11px] text-cockpit-muted font-medium uppercase tracking-wider">Hoje</p>
          <p className="text-2xl font-bold text-cockpit-text mt-1">{usageData.today.calls}</p>
          <p className="text-[10px] text-cockpit-muted">requisições · ${usageData.today.cost.toFixed(4)}</p>
        </div>
        <div className="cockpit-card !py-3">
          <p className="text-[11px] text-cockpit-muted font-medium uppercase tracking-wider">Semana</p>
          <p className="text-2xl font-bold text-cockpit-text mt-1">{usageData.week.calls}</p>
          <p className="text-[10px] text-cockpit-muted">${usageData.week.cost.toFixed(4)}</p>
        </div>
        <div className="cockpit-card !py-3">
          <p className="text-[11px] text-cockpit-muted font-medium uppercase tracking-wider">Mês</p>
          <p className="text-2xl font-bold text-accent mt-1">{usageData.month.calls}</p>
          <p className="text-[10px] text-accent">${usageData.month.cost.toFixed(4)}</p>
        </div>
        <div className="cockpit-card !py-3">
          <p className="text-[11px] text-cockpit-muted font-medium uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-cockpit-text mt-1">{usageData.total.calls}</p>
          <p className="text-[10px] text-cockpit-muted">${usageData.total.cost.toFixed(4)} · {((usageData.total.tokens ?? 0) / 1000).toFixed(0)}K tokens</p>
        </div>
      </div>

      {/* Daily chart */}
      {usageData.daily && usageData.daily.length > 0 && (
        <div className="cockpit-card">
          <h3 className="text-xs font-semibold text-cockpit-text uppercase tracking-wider mb-4">Uso diário (14 dias)</h3>
          <div className="flex items-end gap-1 h-32">
            {usageData.daily.map((d: { date: string; calls: number; cost: number }) => {
              const maxCalls = Math.max(...usageData.daily.map((x: { calls: number }) => x.calls), 1)
              const h = (d.calls / maxCalls) * 100
              const isToday = d.date === new Date().toISOString().split("T")[0]
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.calls} calls, $${d.cost.toFixed(4)}`}>
                  <div className={cn("w-full rounded-t-md transition-all", isToday ? "bg-accent" : d.calls > 0 ? "bg-accent/40" : "bg-cockpit-border-light")} style={{ height: `${Math.max(h, 2)}%` }} />
                  <span className={cn("text-[8px]", isToday ? "text-accent font-bold" : "text-cockpit-muted")}>{d.date.slice(8)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* By action breakdown */}
      {usageData.byAction && usageData.byAction.length > 0 && (
        <div className="cockpit-card">
          <h3 className="text-xs font-semibold text-cockpit-text uppercase tracking-wider mb-4">Por ação (este mês)</h3>
          <div className="space-y-2.5">
            {usageData.byAction.map((a: { action: string; calls: number; cost: number }) => {
              const maxCalls = Math.max(...usageData.byAction.map((x: { calls: number }) => x.calls), 1)
              const pct = (a.calls / maxCalls) * 100
              const labels: Record<string, string> = {
                content_suggestion: "Sugestões de conteúdo", generate_ideas: "Geração de ideias",
                evaluate_idea: "Avaliação de ideia", generate_briefing: "Briefing",
                generate_hook: "Hooks", generate_script: "Roteiros", generate_titles: "Títulos",
                generate_thumbnail: "Thumbnails", generate_description: "Descrições",
                generate_editing_notes: "Notas de edição", deep_research: "Pesquisa profunda",
                review: "Revisão", generate_research: "Pesquisa",
              }
              return (
                <div key={a.action}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-cockpit-text">{labels[a.action] || a.action}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-cockpit-muted">{a.calls} chamadas</span>
                      <span className="text-[10px] text-accent font-medium">${a.cost.toFixed(4)}</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-cockpit-border-light rounded-full overflow-hidden">
                    <div className="h-full bg-accent/50 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent calls */}
      {usageData.recentCalls && usageData.recentCalls.length > 0 && (
        <div className="cockpit-card !p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-cockpit-border">
            <h3 className="text-xs font-semibold text-cockpit-text uppercase tracking-wider">Últimas chamadas</h3>
          </div>
          <table className="w-full">
            <thead><tr className="border-b border-cockpit-border">
              <th className="text-left text-[10px] font-semibold text-cockpit-muted uppercase px-5 py-2">Ação</th>
              <th className="text-right text-[10px] font-semibold text-cockpit-muted uppercase px-3 py-2">Tokens</th>
              <th className="text-right text-[10px] font-semibold text-cockpit-muted uppercase px-3 py-2">Custo</th>
              <th className="text-right text-[10px] font-semibold text-cockpit-muted uppercase px-3 py-2">Tempo</th>
              <th className="text-right text-[10px] font-semibold text-cockpit-muted uppercase px-5 py-2">Quando</th>
            </tr></thead>
            <tbody>{usageData.recentCalls.map((c: { id: string; action: string; tokens: number; cost: number; duration: number; createdAt: string }) => (
              <tr key={c.id} className="border-b border-cockpit-border-light hover:bg-cockpit-surface-hover">
                <td className="px-5 py-2.5 text-xs text-cockpit-text">{c.action}</td>
                <td className="px-3 py-2.5 text-xs text-cockpit-muted text-right">{c.tokens.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-xs text-accent text-right font-medium">${c.cost.toFixed(4)}</td>
                <td className="px-3 py-2.5 text-xs text-cockpit-muted text-right">{(c.duration / 1000).toFixed(1)}s</td>
                <td className="px-5 py-2.5 text-[10px] text-cockpit-muted text-right">{new Date(c.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* Pricing info */}
      <div className="cockpit-card">
        <h3 className="text-xs font-semibold text-cockpit-text uppercase tracking-wider mb-3">Referência de preços</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-cockpit-bg border border-cockpit-border rounded-xl">
            <p className="text-[10px] text-cockpit-muted">Modelo</p>
            <p className="text-xs font-bold text-cockpit-text mt-1">Claude Sonnet 4.6</p>
          </div>
          <div className="p-3 bg-cockpit-bg border border-cockpit-border rounded-xl">
            <p className="text-[10px] text-cockpit-muted">Input</p>
            <p className="text-xs font-bold text-cockpit-text mt-1">$3 / 1M tokens</p>
          </div>
          <div className="p-3 bg-cockpit-bg border border-cockpit-border rounded-xl">
            <p className="text-[10px] text-cockpit-muted">Output</p>
            <p className="text-xs font-bold text-cockpit-text mt-1">$15 / 1M tokens</p>
          </div>
        </div>
      </div>
    </div>
  )
}
