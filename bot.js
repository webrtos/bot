// https://github.com/discord/discord-example-app

import express from 'express'
import fetch from 'node-fetch'
import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions'
import { Configuration, OpenAIApi } from 'openai'

const appId = process.env.APP_ID
const guildId = process.env.GUILD_ID

const commands = [
    {
        name: 'gpt',
        description: 'text-davinci-003',
        type: 1,
        options: [
            {
                name: 'message',
                description: 'ask politely OpenAI for a reply',
                type: 3,
                required: true
            }
        ]
    }
]

function VerifyDiscordRequest(clientKey) {
    return function (req, res, buf, encoding) {
        const signature = req.get('X-Signature-Ed25519');
        const timestamp = req.get('X-Signature-Timestamp');
        const isValidRequest = verifyKey(buf, signature, timestamp, clientKey);
        if (!isValidRequest) {
            res.status(401).send('Bad request signature');
            throw new Error('Bad request signature');
        }
    };
}
  
async function DiscordRequest(endpoint, options) {
    const url = 'https://discord.com/api/v10/' + endpoint;
    if (options.body) options.body = JSON.stringify(options.body);
    const res = await fetch(url, {
        headers: {
            Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'User-Agent': 'DiscordBot (https://github.com/discord/discord-example-app, 1.0.0)',
        },
        ...options
    });
    if (!res.ok) {
        const data = await res.json();
        console.log(res.status);
        throw new Error(JSON.stringify(data));
    }
    return res;
}

const app = express();
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

app.post('/interactions', async function (req, res) {
    const { type, data } = req.body
    if (type === InteractionType.PING) {
        return res.send({ type: InteractionResponseType.PONG })
    }
    if (type === InteractionType.APPLICATION_COMMAND) {
        if (data.name === 'gpt') {
            //data.options.forEach(function (element, index) { console.log(index, ":", element) })
            let text = ""
            try {
                const response = await queryAI(data.options[0].value);
                if (response && 'data' in response && 'choices' in response.data && Array.isArray(response.data.choices) && response.data.choices.length > 0) {
                    /*for (let i = 0, l = response.data.choices.length; i < l; i++) {
                        if (response.data.choices[i] && 'text' in response.data.choices[i]) { text += "\nA" + (i + 1) + ": " + response.data.choices[i].text }
                    }*/
                    text = "\nA: " + response.data.choices[0].text
                } else {
                    text = "\nA: error"
                }
            } catch (e) {
                text = "\nA: error " + e.message
            }
            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: "Q: " + data.options[0].value + text }
            });
        }
    }
});

async function HasGuildCommand(command) {
    const endpoint = `applications/${appId}/guilds/${guildId}/commands`;
    try {
        const res = await DiscordRequest(endpoint, { method: 'GET' });
        const data = await res.json();
        if (data) {
            const installedNames = data.map((c) => c['name']);
            if (!installedNames.includes(command['name'])) {
                console.log(`Installing "${command['name']}"`);
                InstallGuildCommand(command);
            } else {
                console.log(`"${command['name']}" command already installed`);
            }
        }
    } catch (err) {
        console.error(err);
    }
}

async function InstallGuildCommand(command) {
    const endpoint = `applications/${appId}/guilds/${guildId}/commands`;
    try {
        await DiscordRequest(endpoint, { method: 'POST', body: command });
    } catch (err) {
        console.error(err);
    }
}

async function queryAI(message) {
    return new OpenAIApi(new Configuration({
        apiKey: process.env.OPENAI_API_KEY
    })).createCompletion({
        model: "text-davinci-003",
        prompt: `The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly.\n\nHuman: Hello, who are you?\nAI: I am an AI created by OpenAI. How can I help you today?\nHuman: ${message}\nAI:`,
        temperature: 0.9,
        max_tokens: 200, //150,
        top_p: 1,
        frequency_penalty: 0.0,
        presence_penalty: 0.6,
        stop: [" Human:", " AI:"],
    })
}

//export default function () {
    app.listen(process.env.PORT || 3000, function () {
        console.log('Listening on', this.address());
        commands.forEach(HasGuildCommand);
    });
//}