// todo:
// get old emails from old slackscan messages
// perhaps the same with names and stuff
// old slackscan messages are REALLY powerful
// i think its how i got exposed for slackbot :dumbass:
import { App } from "@slack/bolt"
import type { AnyBlock } from "@slack/types"

function renderEmailHistory(emails: { email: string; source: string; source_url?: string }[]): AnyBlock[] {
    const blocks: AnyBlock[] = []

    blocks.push({
        type: "markdown",
        text: "## :email: **" + emails.length + "** emails found",
    })

    return blocks
}


export function getEmailHistory(app: App, target: string): AnyBlock[] {
    const emails = [
        {
            email: "new@example.com",
            source: "direct",
            ts: 6767676767,
        },
        {
            email: "old@example.com",
            source: "history",
            ts: 6767676767,
        },
    ]

    return renderEmailHistory(emails)
}
