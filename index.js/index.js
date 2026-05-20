const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

// سيرفر بسيط ليبقى البوت شغالاً 24 ساعة
http.createServer((req, res) => {
    res.write("Bot is alive!");
    res.end();
}).listen(process.env.PORT || 3000);

client.once('ready', () => {
    console.log('Bot is online!');
});

client.login(process.env.TOKEN);