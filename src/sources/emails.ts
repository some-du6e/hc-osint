// todo:
// get old emails from old slackscan messages
// perhaps the same with names and stuff
// old slackscan messages are REALLY powerful
// i think its how i got exposed for slackbot :dumbass:
import { App } from "@slack/bolt"

function renderEmailHistory(emails: { email: string; source: string; source_url?: string }[]) {
    let blocks = []

    blocks.push({
	    "type": "markdown",
		"text": "## :email: **"+ emails.length + "** emails found"
	})



    return blocks
}



export function getEmailHistory(app: App, target: String) {
    let emails = [
        {
            "email": "new@example.com",
            "source": "direct"
        },
        {
            "email": "old@example.com",
            "source": "history",
            "source_url": "https://hackclub.slack.com/archives/xxxxx"
        }
    ]


    return renderEmailHistory(emails)


}