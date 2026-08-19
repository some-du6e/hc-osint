import { getEmailHistory } from "./sources/emails"
import { bot } from "./bot"
import { App } from "@slack/bolt"
import type { AnyBlock, AnyChunk } from "@slack/types"


// A single OSINT source. Each becomes one task in the live plan block.
export interface Source {
    // stable id used as the task_id in task_update chunks
    id: string
    // task title once the source has finished
    name: string
    // task title shown while the source is running
    frontendMessage: string
    // produces the result blocks that get streamed in beneath the plan
    run: () => Promise<AnyBlock[]>
}


export function getSources(target: string): Source[] {
    return [
        {
            id: "emails",
            name: "Emails",
            frontendMessage: "Getting old emails...",
            run: async () => getEmailHistory(bot, target),
        },
    ]
}


// Drives a streaming Slack message whose body is a plan block. Each source is a
// task that animates pending -> in_progress -> complete/error as it runs.
// See https://docs.slack.dev/reference/block-kit/blocks/plan-block/
class Progress {
    bot: App
    channel: string | undefined
    streamTs: string | undefined

    constructor(bot: App) {
        this.bot = bot
    }

    async start(target: string, userId: string) {
        // chat.startStream needs a real channel id — unlike chat.postMessage,
        // it won't auto-resolve a user id into a DM. Open the DM explicitly.
        const dm = await this.bot.client.conversations.open({ users: userId })
        const channel = dm.channel?.id as string
        this.channel = channel

        // parent message so the streaming plan block lives in a thread
        const parent = await this.bot.client.chat.postMessage({
            channel,
            markdown_text: "see thread for progress",
        })

        const stream = await this.bot.client.chat.startStream({
            channel,
            thread_ts: parent.ts as string,
            task_display_mode: "plan",
            chunks: [
                {
                    type: "plan_update",
                    title: `Looking up ${target}`,
                },
            ],
        })

        this.streamTs = stream.ts as string
    }

    private async append(chunks: AnyChunk[]) {
        if (!this.channel || !this.streamTs) {
            throw new Error("stream not started")
        }
        await this.bot.client.chat.appendStream({
            channel: this.channel,
            ts: this.streamTs,
            chunks,
        })
    }

    // queue a task so it shows up in the plan before we run it
    async addTask(source: Source) {
        await this.append([
            {
                type: "task_update",
                id: source.id,
                title: source.name,
                status: "pending",
            },
        ])
    }

    async startTask(source: Source) {
        await this.append([
            {
                type: "task_update",
                id: source.id,
                title: source.frontendMessage,
                status: "in_progress",
            },
        ])
    }

    async completeTask(source: Source, result: AnyBlock[]) {
        const chunks: AnyChunk[] = [
            {
                type: "task_update",
                id: source.id,
                title: source.name,
                status: "complete",
            },
        ]
        if (result.length > 0) {
            chunks.push({ type: "blocks", blocks: result })
        }
        await this.append(chunks)
    }

    async failTask(source: Source, message: string) {
        await this.append([
            {
                type: "task_update",
                id: source.id,
                title: source.name,
                status: "error",
                details: message,
            },
        ])
    }

    async finish(title = "Lookup complete") {
        if (!this.channel || !this.streamTs) {
            throw new Error("stream not started")
        }
        await this.bot.client.chat.stopStream({
            channel: this.channel,
            ts: this.streamTs,
            chunks: [{ type: "plan_update", title }],
        })
    }
}


export async function runSources(target: string, userId: string) {
    const progress = new Progress(bot)
    const sources = getSources(target)

    await progress.start(target, userId)
    for (const source of sources) {
        await progress.addTask(source)
    }

    for (const source of sources) {
        await progress.startTask(source)
        try {
            const result = await source.run()
            await progress.completeTask(source, result)
        } catch (err) {
            await progress.failTask(source, err instanceof Error ? err.message : String(err))
        }
    }

    await progress.finish()
}
