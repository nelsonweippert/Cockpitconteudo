import { BotClient } from "./BotClient"
import { getTelegramStatusAction, getDigestTermsAction } from "@/app/actions/telegram.actions"

export const metadata = { title: "Bot do Telegram · Content Hub" }

export default async function BotPage() {
  const [status, terms] = await Promise.all([
    getTelegramStatusAction(),
    getDigestTermsAction(),
  ])
  const statusData = (status.success ? status.data : { chatId: null, tokenConfigured: false, botUsername: null }) as {
    chatId: string | null
    tokenConfigured: boolean
    botUsername: string | null
  }
  const termsData = (terms.success ? terms.data : []) as Array<{
    id: string
    term: string
    includeInDigest: boolean
    activeSources: number
  }>
  return <BotClient initialStatus={statusData} initialTerms={termsData} />
}
