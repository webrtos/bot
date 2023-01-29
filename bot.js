import express from 'express'
import fetch from 'node-fetch'
import { verifyKey } from 'discord-interactions'

const appId = process.env.APP_ID
const guildId = process.env.GUILD_ID

const commands = [
    {
        name: 'chat',
        description: 'text-davinci-003',
        type: 1
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
    // append endpoint to root API URL
    const url = 'https://discord.com/api/v10/' + endpoint;
    // Stringify payloads
    if (options.body) options.body = JSON.stringify(options.body);
    // Use node-fetch to make requests
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

app.post('/interactions', function (req, res) {
  const { type, data } = req.body;
  if (type === InteractionType.APPLICATION_COMMAND) {
    if (data.name === 'chat') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'A wild message appeared' },
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
        // This is just matching on the name, so it's not good for updates
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

/*
async function createCommand() {

  //https://discord.com/developers/docs/interactions/application-commands#create-global-application-command
  // const globalEndpoint = `applications/${appId}/commands`;
  //https://discord.com/developers/docs/interactions/application-commands#create-guild-application-command

  const guildEndpoint = `applications/${appId}/guilds/${guildId}/commands`;
  const commandBody = {
    name: 'chat',
    description: 'text-davinci-003',
    // chat command (see https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-types)
    type: 1,
  };

  try {
    // Send HTTP request with bot token
    const res = await DiscordRequest(guildEndpoint, {
      method: 'POST',
      body: commandBody,
    });
    console.log(await res.json());
  } catch (err) {
    console.error('Error installing commands: ', err);
  }
}
*/

//export default function () {
    app.listen(process.env.PORT || 3000, function () {
        console.log('Listening on', this.address());
        commands.forEach(HasGuildCommand);
    });
//}