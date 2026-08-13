import { bot } from "./bot" 

bot.command("/dev-osint-lookup", async ({ command, ack, say }) => {
    await ack()
    
    let offender = command.user_id
    let target = command.text

    bot.client.chat.postMessage({
        channel: offender,
        text: `Looking up ${target} for <@${offender}>...`,
    })
})