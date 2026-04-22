import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { defineConfig } from "prisma/config";

// Prisma 7 exige datasource.url no config quando rodando migrate deploy.
// Em dev: carregado de .env.local via dotenv acima.
// Em produção (Vercel): precisa ter DATABASE_URL nas env vars do projeto.
if (!process.env.DATABASE_URL) {
  console.error("\n[prisma.config] ATENÇÃO: DATABASE_URL não está definida.")
  console.error("  - Dev local: verifique .env.local")
  console.error("  - Vercel: configure em Project Settings → Environment Variables (All Environments)\n")
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
