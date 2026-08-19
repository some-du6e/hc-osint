import { bot } from "./bot"
import { runSources } from "./sources"

bot.command("/dev-osint-lookup", async ({ command, ack }) => {
    await ack()

    const offender = command.user_id
    const target = command.text

    await runSources(target, offender)
})
