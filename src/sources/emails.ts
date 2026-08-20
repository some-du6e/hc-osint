// todo:
// get old emails from old slackscan messages
// perhaps the same with names and stuff
// old slackscan messages are REALLY powerful
// i think its how i got exposed for slackbot :dumbass:
import { App } from "@slack/bolt"
import type { AnyBlock } from "@slack/types"

type EmailEntry = {
    email: string
    source: string
    ts: number
}

function renderEmailHistory(emails: EmailEntry[]): AnyBlock[] {
    const blocks: AnyBlock[] = []

    blocks.push({
        type: "markdown",
        text: "## :email: **" + emails.length + "** emails found",
    })

    for (const email of emails) {
        if (email.source === "direct") {
            blocks.push({
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `:redarrows: \`${email.email}\` (current)`,
                },
            })
        }
        if (email.source === "history") {
            blocks.push({
                type: "rich_text",
                elements: [ // actual shit only for a single special block
                    {
                        type: "rich_text_section",
                        elements: [
                            {
                                type: "emoji",
                                name: "redarrows"
                            },
                            {
                                type: "text",
                                text: `${email.email}`,
                                style: {
                                    code: true,
                                },
                            },
                            {
                                type: "text",
                                text: ` (seen at `,
                            },
                            {
                                type: "date",
                                timestamp: 1787187904,
                                format: "{date_slash} at {time} ({ago})",
                                fallback: "<Failed to display time>",
                            },
                            {
                                type: "text",
                                text: `)`,
                            },
                        ],
                    },
                ],
            })
        }
    }

    return blocks
}

async function findLatestEmail(app: App, target: string): Promise<EmailEntry | null> {
    // target is raw slash-command text. It might be a Slack mention like
    // <@U12345> or <@U12345|name>, or plain text that isn't a user id at all.
    const mention = /<@([UW][A-Z0-9]+)(?:\|[^>]*)?>/.exec(target)
    const userId = mention?.[1] ?? (/^[UW][A-Z0-9]+$/.test(target) ? target : null)

    console.log("[emails] target =", JSON.stringify(target), "→ userId =", userId)

    if (!userId) {
        return null
    }

    try {
        const info = await app.client.users.info({ user: userId })
        const email = info.user?.profile?.email
        if (email) {
            return { email, source: "direct", ts: Date.now() / 1000 }
        }
    } catch {
        // user_not_found / deactivated / restricted — no direct email to pull
    }

    return null
}

export async function getEmailHistory(app: App, target: string): Promise<AnyBlock[]> {
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

    const latest = await findLatestEmail(app, target)
    if (latest) {
        emails.push(latest)
    }

    return renderEmailHistory(emails)
}
