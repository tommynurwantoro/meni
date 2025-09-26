import { Events, Client } from 'discord.js';

export const name = Events.ClientReady;
export const once = true;

export function execute(client: Client) {
    console.log(`🎉 ${client.user?.tag} is online and ready!`);
    console.log(`📊 Serving ${client.guilds.cache.size} guilds`);
    console.log(`👥 Serving ${client.users.cache.size} users`);

    // Set bot status
    client.user?.setActivity('your server!', { type: 3 }); // Watching type
}
