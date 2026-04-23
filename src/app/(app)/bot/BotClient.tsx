"use client"

import { useState, useTransition } from "react"
import { Bell, Send, CheckCircle2, AlertCircle, ExternalLink, Copy, Loader2, Zap, Target } from "lucide-react"
import { saveTelegramChatIdAction, sendTelegramTestAction, toggleDigestTermAction } from "@/app/actions/telegram.actions"
import { cn } from "@/lib/utils"

type Status = {
  chatId: string | null
  tokenConfigured: boolean
  botUsername: string | null
}

type DigestTerm = {
  id: string
  term: string
  includeInDigest: boolean
  activeSources: number
}

export function BotClient({ initialStatus, initialTerms }: { initialStatus: Status; initialTerms: DigestTerm[] }) {
  const [status, setStatus] = useState<Status>(initialStatus)
  const [terms, setTerms] = useState<DigestTerm[]>(initialTerms)
  const [togglingTermId, setTogglingTermId] = useState<string | null>(null)
  const [inputChatId, setInputChatId] = useState(initialStatus.chatId ?? "")
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [saving, startSave] = useTransition()
  const [testing, startTest] = useTransition()
  const [digestRunning, setDigestRunning] = useState(false)
  const [digestResult, setDigestResult] = useState<{
    themesProcessed: number
    themesWithNews: number
    themesCached: number
    messagesSent: number
    errors: string[]
    durationMs: number
  } | null>(null)

  const isBound = !!status.chatId
  const tokenOK = status.tokenConfigured
  const botKnown = !!status.botUsername

  function handleSave() {
    setMessage(null)
    startSave(async () => {
      const res = await saveTelegramChatIdAction(inputChatId)
      if (res.success) {
        const data = res.data as { chatId: string | null }
        setStatus((s) => ({ ...s, chatId: data.chatId }))
        setMessage({ type: "ok", text: data.chatId ? "ChatId salvo" : "ChatId removido" })
      } else {
        setMessage({ type: "err", text: res.error ?? "Erro ao salvar" })
      }
    })
  }

  function handleTest() {
    setMessage(null)
    startTest(async () => {
      const res = await sendTelegramTestAction()
      if (res.success) {
        setMessage({ type: "ok", text: "Mensagem de teste enviada — confere no Telegram" })
      } else {
        setMessage({ type: "err", text: res.error ?? "Erro no teste" })
      }
    })
  }

  async function handleToggleTerm(termId: string, next: boolean) {
    setTogglingTermId(termId)
    // Optimistic update
    setTerms((prev) => prev.map((t) => (t.id === termId ? { ...t, includeInDigest: next } : t)))
    try {
      const res = await toggleDigestTermAction(termId, next)
      if (!res.success) {
        // Rollback
        setTerms((prev) => prev.map((t) => (t.id === termId ? { ...t, includeInDigest: !next } : t)))
        setMessage({ type: "err", text: res.error ?? "Erro ao atualizar tema" })
      }
    } finally {
      setTogglingTermId(null)
    }
  }

  async function handleRunDigest() {
    setDigestRunning(true)
    setDigestResult(null)
    setMessage(null)
    try {
      const res = await fetch("/api/digest/run-now", { method: "POST" })
      const body = await res.json()
      if (body.success) {
        setDigestResult(body.data)
        setMessage({ type: "ok", text: `Digest enviado — ${body.data.messagesSent} mensagem(ns) no Telegram` })
      } else {
        setMessage({ type: "err", text: body.error ?? "Falha ao rodar digest" })
      }
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Erro de rede" })
    } finally {
      setDigestRunning(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-cockpit-text flex items-center gap-2">
          <Bell size={22} className="text-accent" />
          Bot do Telegram
        </h1>
        <p className="text-sm text-cockpit-muted mt-1 max-w-2xl">
          Digest diário das novidades de cada tema monitorado direto no seu Telegram.
          A mesma fonte que alimenta a geração de ideias.
        </p>
      </div>

      {/* Status */}
      <div className="cockpit-card space-y-3">
        <h2 className="text-sm font-semibold text-cockpit-text">Status</h2>
        <div className="space-y-2">
          <StatusRow
            ok={tokenOK}
            label="Token do bot configurado"
            hint={tokenOK ? "TELEGRAM_BOT_TOKEN presente no env" : "Falta TELEGRAM_BOT_TOKEN no .env.local / Vercel"}
          />
          <StatusRow
            ok={botKnown}
            label="Bot acessível"
            hint={botKnown ? `@${status.botUsername} responde à API` : "Bot não responde — confira se o token é válido"}
          />
          <StatusRow
            ok={isBound}
            label="ChatId vinculado"
            hint={isBound ? `${status.chatId}` : "Cole seu chatId abaixo pra vincular"}
          />
        </div>
      </div>

      {/* Setup steps */}
      {(!tokenOK || !isBound) && (
        <div className="cockpit-card bg-accent/5 border-accent/30 space-y-3">
          <h2 className="text-sm font-semibold text-cockpit-text flex items-center gap-2">
            🛠️ Setup inicial (uma vez só)
          </h2>
          <ol className="space-y-3 text-sm text-cockpit-text">
            <Step n={1} done={tokenOK}>
              No Telegram, fale com{" "}
              <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-0.5">
                @BotFather <ExternalLink size={11} />
              </a>{" "}
              e mande <Code>/newbot</Code>. Escolha um nome (ex: &quot;Cockpit Conteúdo&quot;) e um username (ex: &quot;cockpit_conteudo_bot&quot;). Ele vai te devolver um <strong>token</strong>.
            </Step>
            <Step n={2} done={tokenOK}>
              Cola o token em <Code>TELEGRAM_BOT_TOKEN</Code> no <Code>.env.local</Code> (local) e nas Environment Variables do Vercel. Depois reinicia o servidor.
            </Step>
            <Step n={3} done={isBound}>
              Abre seu bot (o link está no retorno do BotFather, tipo <Code>t.me/seu_bot</Code>) e envia <Code>/start</Code> — ele precisa saber que você existe pra conseguir te mandar mensagem.
            </Step>
            <Step n={4} done={isBound}>
              No Telegram, fale com{" "}
              <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-0.5">
                @userinfobot <ExternalLink size={11} />
              </a>{" "}
              e mande <Code>/start</Code>. Ele te retorna seu <strong>chatId</strong> (um número).
              Cola abaixo.
            </Step>
          </ol>
        </div>
      )}

      {/* Binding */}
      <div className="cockpit-card space-y-3">
        <h2 className="text-sm font-semibold text-cockpit-text">Vínculo do chatId</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputChatId}
            onChange={(e) => setInputChatId(e.target.value)}
            placeholder="Ex: 123456789"
            className="flex-1 px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-xl text-sm text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-accent text-black text-xs font-semibold rounded-xl hover:bg-accent-hover disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : null}
            Salvar
          </button>
        </div>
        <p className="text-[11px] text-cockpit-muted">
          ChatId é um número inteiro. Pra grupos, vem negativo (ex: <Code>-100123</Code>). Deixe vazio e salve pra desvincular.
        </p>

        {/* Test */}
        {isBound && tokenOK && (
          <div className="pt-2 border-t border-cockpit-border-light">
            <button
              onClick={handleTest}
              disabled={testing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cockpit-bg border border-cockpit-border rounded-xl text-sm font-medium text-cockpit-text hover:border-accent/40 hover:text-accent disabled:opacity-50 transition-colors"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {testing ? "Enviando..." : "Enviar mensagem de teste"}
            </button>
          </div>
        )}

        {message && (
          <div className={cn(
            "p-2.5 rounded-lg border text-xs flex items-start gap-2",
            message.type === "ok"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
              : "bg-red-500/10 border-red-500/30 text-red-500"
          )}>
            {message.type === "ok" ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* Seleção de temas pro digest */}
      {isBound && tokenOK && (
        <div className="cockpit-card space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-cockpit-text flex items-center gap-2">
              <Target size={14} className="text-accent" />
              Temas no digest
            </h2>
            <p className="text-[11px] text-cockpit-muted mt-0.5">
              Quais temas aparecem no relatório do Telegram. Desligar aqui <strong>não</strong> para o monitoramento —
              o tema continua ativo pra geração de ideias. <a href="/temas" className="text-accent hover:underline">Gerenciar temas →</a>
            </p>
          </div>

          {terms.length === 0 ? (
            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs text-amber-500">
              Nenhum tema ativo. Adicione em <a href="/temas" className="underline">/temas</a>.
            </div>
          ) : (
            <div className="space-y-1.5">
              {terms.map((t) => {
                const included = t.includeInDigest
                const isToggling = togglingTermId === t.id
                return (
                  <label key={t.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors cursor-pointer",
                      included
                        ? "border-accent/30 bg-accent/5"
                        : "border-cockpit-border bg-cockpit-bg hover:border-cockpit-text/20"
                    )}>
                    <input
                      type="checkbox"
                      checked={included}
                      disabled={isToggling}
                      onChange={(e) => handleToggleTerm(t.id, e.target.checked)}
                      className="accent-accent shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium truncate", included ? "text-cockpit-text" : "text-cockpit-muted")}>
                        {t.term}
                      </p>
                      <p className="text-[10px] text-cockpit-muted">
                        {t.activeSources > 0 ? `${t.activeSources} fonte${t.activeSources === 1 ? "" : "s"} curada${t.activeSources === 1 ? "" : "s"}` : "sem fontes curadas (busca livre)"}
                      </p>
                    </div>
                    {isToggling && <Loader2 size={13} className="animate-spin text-cockpit-muted shrink-0" />}
                  </label>
                )
              })}
            </div>
          )}

          {terms.length > 0 && (
            <div className="flex items-center justify-between text-[10px] text-cockpit-muted pt-1">
              <span>
                <strong className="text-cockpit-text">{terms.filter((t) => t.includeInDigest).length}</strong>
                {" / "}
                {terms.length} temas no digest
              </span>
              {terms.some((t) => t.includeInDigest) && terms.some((t) => !t.includeInDigest) && (
                <button
                  onClick={() => {
                    const allOn = terms.every((t) => t.includeInDigest)
                    terms.forEach((t) => {
                      if (t.includeInDigest !== !allOn) handleToggleTerm(t.id, !allOn)
                    })
                  }}
                  className="hover:text-accent underline decoration-dotted"
                >
                  ligar todos
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Digest manual */}
      {isBound && tokenOK && (
        <div className="cockpit-card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-cockpit-text flex items-center gap-2">
                <Zap size={14} className="text-accent" />
                Digest diário
              </h2>
              <p className="text-[11px] text-cockpit-muted mt-0.5">
                Descoberta + resumo Haiku por tema ativo com fontes. Enviado automaticamente todo dia às 07h BRT.
              </p>
            </div>
          </div>

          <button
            onClick={handleRunDigest}
            disabled={digestRunning}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent text-black text-sm font-semibold rounded-xl hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {digestRunning ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
            {digestRunning ? "Rodando digest (pode levar 1-3 min)..." : "Rodar digest agora"}
          </button>

          {digestResult && (
            <div className="p-3 bg-cockpit-bg border border-cockpit-border rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-cockpit-muted">Temas processados</span>
                <span className="font-semibold text-cockpit-text">{digestResult.themesProcessed}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cockpit-muted">Com novidades</span>
                <span className="font-semibold text-emerald-500">{digestResult.themesWithNews}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cockpit-muted">Reaproveitados do cache</span>
                <span className="font-semibold text-cockpit-text">{digestResult.themesCached}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cockpit-muted">Mensagens enviadas</span>
                <span className="font-semibold text-cockpit-text">{digestResult.messagesSent}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cockpit-muted">Duração</span>
                <span className="font-semibold text-cockpit-text">{(digestResult.durationMs / 1000).toFixed(1)}s</span>
              </div>
              {digestResult.errors.length > 0 && (
                <div className="pt-2 mt-2 border-t border-cockpit-border-light">
                  <p className="text-red-500 font-medium mb-1">Erros:</p>
                  <ul className="text-red-400 space-y-0.5 pl-3">
                    {digestResult.errors.slice(0, 5).map((e, i) => <li key={i} className="list-disc">{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-cockpit-muted italic">
            Os mesmos candidatos alimentam a geração de ideias — se você clicar &quot;Gerar ideias&quot; hoje,
            o pipeline reaproveita o que o digest já descobriu.
          </p>
        </div>
      )}
    </div>
  )
}

function StatusRow({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
      ) : (
        <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-cockpit-text">{label}</p>
        <p className="text-[11px] text-cockpit-muted break-all">{hint}</p>
      </div>
    </div>
  )
}

function Step({ n, done, children }: { n: number; done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className={cn(
        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5",
        done ? "bg-emerald-500 text-white" : "bg-accent/20 text-accent-dark"
      )}>
        {done ? "✓" : n}
      </span>
      <div className={cn("text-sm leading-relaxed", done ? "text-cockpit-muted" : "text-cockpit-text")}>
        {children}
      </div>
    </li>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        const text = typeof children === "string" ? children : ""
        if (text) {
          navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          })
        }
      }}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-cockpit-bg border border-cockpit-border rounded font-mono text-[11px] text-cockpit-text hover:border-accent/30 transition-colors"
      title="clicar pra copiar"
    >
      {children}
      {copied ? <CheckCircle2 size={10} className="text-emerald-500" /> : <Copy size={10} className="text-cockpit-muted" />}
    </button>
  )
}
