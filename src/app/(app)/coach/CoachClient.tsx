"use client"

import { useEffect, useRef, useState } from "react"
import { MessageSquare, Plus, Trash2, Send, Loader2, User, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

type Conversation = {
  id: string
  title: string
  lastMessageAt: string
  messageCount: number
}

type Message = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  createdAt: string
}

export function CoachClient({ initialConversations }: { initialConversations: Conversation[] }) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [activeId, setActiveId] = useState<string | null>(initialConversations[0]?.id ?? null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [input, setInput] = useState("")
  const [creating, setCreating] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  // Carrega mensagens ao mudar conversa
  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    setLoading(true)
    fetch(`/api/coach/conversations/${activeId}`)
      .then((r) => r.json())
      .then((body) => {
        if (body.success) setMessages(body.data.messages)
      })
      .finally(() => setLoading(false))
  }, [activeId])

  // Auto-scroll
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages, streaming])

  async function handleNewConversation() {
    setCreating(true)
    try {
      const res = await fetch("/api/coach/conversations", { method: "POST" })
      const body = await res.json()
      if (body.success) {
        const c = body.data as Conversation
        setConversations((prev) => [c, ...prev])
        setActiveId(c.id)
        setMessages([])
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Arquivar essa conversa?")) return
    await fetch(`/api/coach/conversations/${id}`, { method: "DELETE" })
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (activeId === id) {
      setActiveId(conversations.find((c) => c.id !== id)?.id ?? null)
      setMessages([])
    }
  }

  async function handleSend() {
    if (!input.trim() || streaming) return
    let convId = activeId

    // Cria conversa nova se nenhuma selecionada
    if (!convId) {
      const res = await fetch("/api/coach/conversations", { method: "POST" })
      const body = await res.json()
      if (!body.success) return
      const c = body.data as Conversation
      setConversations((prev) => [c, ...prev])
      setActiveId(c.id)
      convId = c.id
    }

    const userMsg: Message = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: input,
      createdAt: new Date().toISOString(),
    }
    const placeholderId = `tmp-asst-${Date.now()}`
    const placeholder: Message = {
      id: placeholderId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg, placeholder])
    const userInput = input
    setInput("")
    setStreaming(true)

    try {
      const res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, message: userInput }),
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Parse SSE — eventos separados por \n\n
        const events = buffer.split("\n\n")
        buffer = events.pop() ?? ""

        for (const ev of events) {
          if (!ev.startsWith("data: ")) continue
          const json = ev.slice(6)
          try {
            const parsed = JSON.parse(json)
            if (parsed.type === "text") {
              setMessages((prev) =>
                prev.map((m) => (m.id === placeholderId ? { ...m, content: m.content + parsed.content } : m)),
              )
            } else if (parsed.type === "done") {
              if (parsed.title) {
                // Auto-titulação
                setConversations((prev) =>
                  prev.map((c) => (c.id === convId ? { ...c, title: parsed.title } : c)),
                )
              }
            } else if (parsed.type === "error") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === placeholderId ? { ...m, content: `❌ Erro: ${parsed.error}` } : m,
                ),
              )
            }
          } catch { /* ignora linha quebrada */ }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? { ...m, content: `❌ Erro: ${err instanceof Error ? err.message : "falha"}` }
            : m,
        ),
      )
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Sidebar de conversas */}
      <aside className="w-64 shrink-0 cockpit-card p-3 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-cockpit-text">Conversas</h2>
          <button
            onClick={handleNewConversation}
            disabled={creating}
            className="p-1.5 rounded-lg hover:bg-cockpit-surface-hover text-cockpit-muted hover:text-accent transition-colors disabled:opacity-50"
            title="Nova conversa"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {conversations.length === 0 ? (
            <p className="text-[11px] text-cockpit-muted text-center py-6 px-2">
              Nenhuma conversa ainda. Clique em + ou comece a digitar abaixo.
            </p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors",
                  activeId === c.id
                    ? "bg-accent/10 text-cockpit-text"
                    : "hover:bg-cockpit-surface-hover text-cockpit-muted",
                )}
                onClick={() => setActiveId(c.id)}
              >
                <MessageSquare size={12} className="shrink-0" />
                <span className="flex-1 text-xs truncate">{c.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(c.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-cockpit-muted hover:text-red-400 transition-all"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Thread + input */}
      <main className="flex-1 flex flex-col cockpit-card overflow-hidden">
        {/* Thread */}
        <div ref={threadRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-cockpit-muted" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Sparkles size={20} className="text-accent" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-cockpit-text">Coach do Cockpit</h3>
                <p className="text-xs text-cockpit-muted mt-1 max-w-md">
                  Eu conheço seus temas, ideias e produção. Pergunte sobre gargalos no funil,
                  ideias que merecem virar conteúdo, padrões nos seus dados.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 max-w-xl">
                <Suggestion text="O que está parado no funil?" onClick={setInput} />
                <Suggestion text="Quais ideias favoritadas eu deveria gravar essa semana?" onClick={setInput} />
                <Suggestion text="Resuma o que produzi nos últimos 30 dias" onClick={setInput} />
                <Suggestion text="Onde estou gastando mais com IA e por quê?" onClick={setInput} />
              </div>
            </div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} streaming={streaming && m.id.startsWith("tmp-asst-")} />)
          )}
        </div>

        {/* Input */}
        <div className="border-t border-cockpit-border p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Pergunte algo sobre seu cockpit..."
              rows={1}
              disabled={streaming}
              className="flex-1 px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-xl text-sm text-cockpit-text placeholder:text-cockpit-muted focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none max-h-32"
              style={{ minHeight: 38 }}
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              className="p-2 bg-accent text-black rounded-xl hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {streaming ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </form>
          <p className="text-[10px] text-cockpit-muted mt-1.5 px-1">
            Shift+Enter pra nova linha · Coach lê os dados do cockpit a cada mensagem
          </p>
        </div>
      </main>
    </div>
  )
}

function Suggestion({ text, onClick }: { text: string; onClick: (s: string) => void }) {
  return (
    <button
      onClick={() => onClick(text)}
      className="text-left p-2.5 bg-cockpit-bg border border-cockpit-border rounded-xl text-xs text-cockpit-muted hover:text-cockpit-text hover:border-accent/30 transition-colors"
    >
      {text}
    </button>
  )
}

function MessageBubble({ message, streaming }: { message: Message; streaming: boolean }) {
  const isUser = message.role === "user"
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
        isUser ? "bg-cockpit-border" : "bg-accent/15",
      )}>
        {isUser ? <User size={14} className="text-cockpit-text" /> : <Sparkles size={14} className="text-accent" />}
      </div>
      <div className={cn("flex-1 max-w-[80%]", isUser && "flex justify-end")}>
        <div className={cn(
          "px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed",
          isUser
            ? "bg-accent/10 text-cockpit-text rounded-tr-sm"
            : "bg-cockpit-bg border border-cockpit-border text-cockpit-text rounded-tl-sm",
        )}>
          {message.content || (streaming ? <Loader2 size={12} className="animate-spin inline" /> : "...")}
          {streaming && message.content && <span className="inline-block w-1 h-3 ml-0.5 bg-accent animate-pulse" />}
        </div>
      </div>
    </div>
  )
}
