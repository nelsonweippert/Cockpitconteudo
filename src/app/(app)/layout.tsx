"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  Sun, Sunset, Moon, Menu, X, ChevronRight, LogOut, Layers,
  BarChart3, Target, Lightbulb, Workflow, BookOpen, Radar, Activity, Bell,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Visão Geral", href: "/visao-geral", icon: BarChart3 },
  { label: "Temas", href: "/temas", icon: Target },
  { label: "Ideias", href: "/ideias", icon: Lightbulb },
  { label: "Funil", href: "/funil", icon: Workflow },
  { label: "Skills", href: "/skills", icon: BookOpen },
  { label: "Radar", href: "/radar", icon: Radar },
  { label: "Bot", href: "/bot", icon: Bell },
  { label: "Uso da API", href: "/uso", icon: Activity },
]

type Theme = "day" | "sunset" | "night"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>("day")

  useEffect(() => {
    const saved = localStorage.getItem("content-hub-theme") as Theme | null
    if (saved === "sunset" || saved === "night" || saved === "day") setTheme(saved)
  }, [])

  function changeTheme(t: Theme) {
    setTheme(t)
    localStorage.setItem("content-hub-theme", t)
  }

  return (
    <div className={theme !== "day" ? `cockpit-theme-${theme}` : ""}>
      <div className="cockpit-layout flex min-h-screen">

        {/* Sidebar */}
        <aside className={cn(
          "cockpit-sidebar fixed inset-y-0 left-0 z-40 w-60 transform transition-transform duration-200 ease-out lg:translate-x-0 lg:static lg:inset-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-16 border-b border-cockpit-border">
              <Link href="/visao-geral" className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
                  <Layers size={15} className="text-accent" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-[13px] font-bold tracking-wide text-cockpit-text">
                    CONTENT HUB
                  </span>
                  <span className="text-[9px] font-medium tracking-wider text-cockpit-muted">
                    Pesquisa → Ideia → Conteúdo
                  </span>
                </div>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1.5 text-cockpit-muted hover:text-cockpit-text rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all",
                      isActive
                        ? "bg-accent/10 text-accent-dark"
                        : "text-cockpit-muted hover:text-cockpit-text hover:bg-cockpit-surface-hover"
                    )}
                  >
                    <item.icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                    {item.label}
                    {isActive && <ChevronRight size={14} className="ml-auto" />}
                  </Link>
                )
              })}
            </nav>

            {/* Footer */}
            <div className="px-3 py-4 border-t border-cockpit-border">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-red-400 hover:text-red-500 hover:bg-red-50/10 transition-colors"
              >
                <LogOut size={18} strokeWidth={1.5} />
                Sair
              </button>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-20 flex items-center gap-4 px-6 h-16 bg-cockpit-bg/80 backdrop-blur-xl border-b border-cockpit-border">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-cockpit-muted hover:text-cockpit-text rounded-lg">
              <Menu size={20} />
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 p-1 rounded-full bg-cockpit-border-light border border-cockpit-border">
                <button onClick={() => changeTheme("day")} className={cn("p-1.5 rounded-full transition-all", theme === "day" ? "bg-cockpit-surface text-amber-500 shadow-sm" : "text-cockpit-muted hover:text-cockpit-text")} title="Dia">
                  <Sun size={14} />
                </button>
                <button onClick={() => changeTheme("sunset")} className={cn("p-1.5 rounded-full transition-all", theme === "sunset" ? "bg-cockpit-surface text-orange-500 shadow-sm" : "text-cockpit-muted hover:text-cockpit-text")} title="Pôr do Sol">
                  <Sunset size={14} />
                </button>
                <button onClick={() => changeTheme("night")} className={cn("p-1.5 rounded-full transition-all", theme === "night" ? "bg-cockpit-surface text-blue-400 shadow-sm" : "text-cockpit-muted hover:text-cockpit-text")} title="Noite">
                  <Moon size={14} />
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
