import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/providers/providers"

export const metadata: Metadata = {
  title: "Content Hub",
  description: "Pesquisa, ideação e produção de conteúdo com IA.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
