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


// temporary fake sources to exercise the streaming plan + broadcast
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

function fakeSource(id: string, name: string, message: string, ms: number, finding: string): Source {
    return {
        id,
        name,
        frontendMessage: message,
        run: async () => {
            await sleep(ms)
            return [{ type: "markdown", text: `## ${name}\n${finding}` }]
        },
    }
}


export function getSources(target: string): Source[] {
    return [
        {
            id: "emails",
            name: "Emails",
            frontendMessage: "Getting old emails...",
            run: async () => getEmailHistory(bot, target),
        },
        fakeSource("names", "Names", "Scraping names...", 1500, `Found 3 names linked to ${target}.`),
        fakeSource("usernames", "Usernames", "Checking username leaks...", 2500, `2 breached usernames for ${target}.`),
        fakeSource("domains", "Domains", "Looking up registered domains...", 3500, `${target} owns 1 domain.`),
        fakeSource("breaches", "Breaches", "Cross-referencing breach databases...", 4500, `${target} appears in 4 breaches.`),
    ]
}


// Drives a streaming Slack message whose body is a plan block. Each source is a
// task that animates pending -> in_progress -> complete/error as it runs.
// See https://docs.slack.dev/reference/block-kit/blocks/plan-block/
class Progress {
    bot: App
    channel: string | undefined
    streamTs: string | undefined
    threadTs: string | undefined
    // accumulated result blocks from completed tasks, broadcast at the end
    resultBlocks: AnyBlock[] = []

    constructor(bot: App) {
        this.bot = bot
    }

    async start(target: string, userId: string) {
        // chat.startStream needs a real channel id — unlike chat.postMessage,
        // it won't auto-resolve a user id into a DM. Open the DM explicitly.
        const dm = await this.bot.client.conversations.open({ users: userId })
        const channel = dm.channel?.id as string
        this.channel = channel

        // chat.startStream requires thread_ts — streams must reply to a user
        // request, so we need a parent message for the thread to live under.
        const parent = await this.bot.client.chat.postMessage({
            channel,
            markdown_text: `Looking up **${target}**...`,
        })
        this.threadTs = parent.ts as string

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
            this.resultBlocks.push(...result)
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
        if (!this.channel || !this.streamTs || !this.threadTs) {
            throw new Error("stream not started")
        }
        await this.bot.client.chat.stopStream({
            channel: this.channel,
            ts: this.streamTs,
            chunks: [{ type: "plan_update", title }],
        })

        // broadcast the final results back into the main channel view, like
        // checking "also send to channel" on a thread reply
        if (this.resultBlocks.length > 0) {
            await this.bot.client.chat.postMessage({
                channel: this.channel,
                thread_ts: this.threadTs,
                reply_broadcast: true,
                blocks: this.resultBlocks,
            })
        }
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
