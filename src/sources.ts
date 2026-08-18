import { getEmailHistory } from "./sources/emails"
import { bot } from "./bot"
import { App } from "@slack/bolt"


class Progress {
    bot: App
    brah: Awaited<ReturnType<App["client"]["chat"]["postMessage"]>> | undefined

    constructor(bot: App) {
        this.bot = bot
    }

    async start(targ: string, channel: string) {
        this.brah = await this.bot.client.chat.postMessage({
            channel,
            markdown_text: "see thread for progress"
        })

        await this.bot.client.chat.startStream({
            channel,
            thread_ts: this.brah.ts as string,
            markdown_text: `Looking up ${targ}...`
        })
    }
}


export function getSources(target: string) {
    const sources = [
        {
            name: "Emails",
            blocks: getEmailHistory(bot, target),
            frontendMessage: "Getting old emails...",
        },
    ]

    return sources
}