"use client"

import { useEffect, useRef, useState } from "react"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  value: string
  onChange: (value: string) => void
  mode?: "date" | "datetime"
  placeholder?: string
  className?: string
  required?: boolean
  id?: string
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function toDate(value: string, mode: "date" | "datetime"): Date | undefined {
  if (!value) return undefined
  if (mode === "date") {
    const [y, m, d] = value.split("-").map(Number)
    if (!y || !m || !d) return undefined
    return new Date(y, m - 1, d)
  }
  const [datePart, timePart = "00:00"] = value.split("T")
  const [y, m, d] = datePart.split("-").map(Number)
  const [hh, mm] = timePart.split(":").map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d, hh || 0, mm || 0)
}

function fromDate(date: Date, mode: "date" | "datetime"): string {
  const base = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  if (mode === "date") return base
  return `${base}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatDisplay(value: string, mode: "date" | "datetime"): string {
  const d = toDate(value, mode)
  if (!d) return ""
  const datePart = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
  if (mode === "date") return datePart
  return `${datePart} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"]
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const startOffset = firstDay.getDay() // 0=dom
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const days: { date: Date; outside: boolean }[] = []

  // Previous month fill
  for (let i = startOffset - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month - 1, daysInPrevMonth - i), outside: true })
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: new Date(year, month, d), outside: false })
  }
  // Next month fill (complete 6 rows = 42 cells)
  while (days.length < 42) {
    const nextDay = days.length - startOffset - daysInMonth + 1
    days.push({ date: new Date(year, month + 1, nextDay), outside: true })
  }

  return days
}

export function DatePicker({ value, onChange, mode = "date", placeholder, className, required, id }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = toDate(value, mode)
  const today = new Date()

  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth())

  const hours = selected?.getHours() ?? 9
  const minutes = selected?.getMinutes() ?? 0

  const days = getCalendarDays(viewYear, viewMonth)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  function navigate(dir: -1 | 1) {
    let m = viewMonth + dir
    let y = viewYear
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setViewMonth(m)
    setViewYear(y)
  }

  function handleDayClick(date: Date) {
    if (mode === "datetime") {
      date.setHours(hours, minutes, 0, 0)
    }
    onChange(fromDate(date, mode))
    if (mode === "date") setOpen(false)
  }

  function handleTimeChange(part: "h" | "m", val: number) {
    const base = selected ? new Date(selected.getTime()) : new Date()
    if (part === "h") base.setHours(val); else base.setMinutes(val)
    onChange(fromDate(base, "datetime"))
  }

  function handleClear() {
    onChange("")
    setOpen(false)
  }

  function handleOpen() {
    // Sync view to selected date when opening
    if (selected) {
      setViewYear(selected.getFullYear())
      setViewMonth(selected.getMonth())
    } else {
      setViewYear(today.getFullYear())
      setViewMonth(today.getMonth())
    }
    setOpen((o) => !o)
  }

  const display = formatDisplay(value, mode)

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        onClick={handleOpen}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-cockpit-bg border border-cockpit-border rounded-xl text-sm text-cockpit-text focus:outline-none focus:ring-2 focus:ring-accent/30 hover:border-cockpit-text/30 transition"
      >
        <span className={cn(!display && "text-cockpit-text/40")}>
          {display || placeholder || (mode === "datetime" ? "dd/mm/aaaa hh:mm" : "dd/mm/aaaa")}
        </span>
        <CalendarIcon className="w-4 h-4 text-cockpit-text/60 shrink-0" />
      </button>

      {required && (
        <input
          type="text"
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => {}}
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
        />
      )}

      {open && (
        <div className="absolute z-50 mt-2 bg-cockpit-surface border border-cockpit-border rounded-2xl shadow-2xl shadow-black/40 p-4 w-[296px]">
          {/* Header: nav + month/year */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg text-cockpit-muted hover:text-cockpit-text hover:bg-cockpit-surface-hover transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-cockpit-text">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={() => navigate(1)}
              className="p-1.5 rounded-lg text-cockpit-muted hover:text-cockpit-text hover:bg-cockpit-surface-hover transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-0 mb-1">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="h-8 flex items-center justify-center text-[11px] font-medium text-cockpit-muted/50 uppercase">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0">
            {days.map(({ date, outside }, i) => {
              const isSelected = selected && isSameDay(date, selected)
              const isToday = isSameDay(date, today)

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDayClick(date)}
                  className={cn(
                    "h-9 flex items-center justify-center text-[13px] rounded-lg transition-colors",
                    outside
                      ? "text-cockpit-muted/25 hover:text-cockpit-muted/50 hover:bg-cockpit-surface-hover"
                      : "text-cockpit-text/80 hover:bg-accent/15 hover:text-cockpit-text",
                    isToday && !isSelected && "text-accent font-bold",
                    isSelected && "bg-accent text-black font-semibold hover:bg-accent-hover hover:text-black",
                  )}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className={cn(
            "flex items-center mt-3 pt-3 border-t border-cockpit-border",
            mode === "datetime" ? "gap-2" : "justify-center"
          )}>
            {mode === "datetime" && (
              <>
                <span className="text-xs text-cockpit-muted">Hora:</span>
                <select
                  value={hours}
                  onChange={(e) => handleTimeChange("h", Number(e.target.value))}
                  className="px-2 py-1 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm text-cockpit-text focus:outline-none focus:ring-1 focus:ring-accent/40"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{pad(i)}</option>
                  ))}
                </select>
                <span className="text-cockpit-muted">:</span>
                <select
                  value={minutes}
                  onChange={(e) => handleTimeChange("m", Number(e.target.value))}
                  className="px-2 py-1 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm text-cockpit-text focus:outline-none focus:ring-1 focus:ring-accent/40"
                >
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                    <option key={m} value={m}>{pad(m)}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="ml-auto px-3 py-1.5 bg-accent text-black text-xs font-semibold rounded-lg hover:bg-accent-hover transition-colors"
                >
                  OK
                </button>
              </>
            )}
            {mode === "date" && value && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-cockpit-muted hover:text-red-400 transition-colors"
              >
                Limpar data
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
