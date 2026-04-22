// Cria um usuário inicial no Content-HUB pra login.
// Uso: npm run seed:user
// Variáveis: SEED_EMAIL, SEED_PASSWORD, SEED_NAME (opcionais, têm defaults)

import { config as loadEnv } from "dotenv"
loadEnv({ path: ".env.local" })
loadEnv()

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  const email = process.env.SEED_EMAIL || "nelsonweippert@gmail.com"
  const password = process.env.SEED_PASSWORD || "content-hub-2026"
  const name = process.env.SEED_NAME || "Nelson"

  const hashed = await bcrypt.hash(password, 10)
  const user = await db.user.upsert({
    where: { email },
    create: { email, name, password: hashed },
    update: { password: hashed, name },
  })

  console.log(`✓ Usuário seed pronto:`)
  console.log(`  email:    ${user.email}`)
  console.log(`  senha:    ${password}`)
  console.log(`  id:       ${user.id}`)
  console.log(`\nAcesse http://localhost:3020/login`)

  await db.$disconnect()
}

main().catch(async (err) => {
  console.error("ERRO:", err)
  await db.$disconnect()
  process.exit(1)
})
