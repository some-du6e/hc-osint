import { App } from "@slack/bolt"

export const bot = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_app_TOKEN,
    socketMode: true,
})