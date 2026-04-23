import { BotClient } from "./BotClient"
import { getTelegramStatusAction } from "@/app/actions/telegram.actions"

export const metadata = { title: "Bot do Telegram · Content Hub" }

export default async function BotPage() {
  const status = await getTelegramStatusAction()
  const data = (status.success ? status.data : { chatId: null, tokenConfigured: false, botUsername: null }) as {
    chatId: string | null
    tokenConfigured: boolean
    botUsername: string | null
  }
  return <BotClient initialStatus={data} />
}
