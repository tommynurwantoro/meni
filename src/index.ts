import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { config } from 'dotenv';
import { readdirSync } from 'fs';
import { join } from 'path';
import sequelize from './utils/database';
import { syncDatabase } from './models';
import { initializeScheduler } from './utils/scheduler';
import { redisManager } from './utils/redis';

// Extend Discord client with custom properties
declare module 'discord.js' {
    interface Client {
        commands: Collection<string, any>;
        cooldowns: Collection<string, Collection<string, number>>;
    }
}

// Load environment variables
config();

// Create Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

// Collections to store commands and events
client.commands = new Collection();
client.cooldowns = new Collection();

// Load commands
const loadCommands = async () => {
    const commandsPath = join(__dirname, 'commands');
    try {
        const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

        for (const file of commandFiles) {
            const filePath = join(commandsPath, file);
            try {
                const command = await import(filePath);

                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    console.log(`✅ Loaded command: ${command.data.name}`);
                } else {
                    console.log(`⚠️ Command at ${filePath} is missing required properties`);
                }
            } catch (importError) {
                console.error(`❌ Failed to import command ${file}:`, importError);
            }
        }
    } catch (error) {
        console.log('📁 Commands directory not found, creating it...');
    }
};

// Load events
const loadEvents = async () => {
    const eventsPath = join(__dirname, 'events');
    try {
        const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

        for (const file of eventFiles) {
            const filePath = join(eventsPath, file);
            try {
                const event = await import(filePath);

                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args));
                } else {
                    client.on(event.name, (...args) => event.execute(...args));
                }
                console.log(`✅ Loaded event: ${event.name}`);
            } catch (importError) {
                console.error(`❌ Failed to import event ${file}:`, importError);
            }
        }
    } catch (error) {
        console.log('📁 Events directory not found, creating it...');
    }
};

// Basic error handling
client.on(Events.Error, (error) => {
    console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    await redisManager.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down gracefully...');
    await redisManager.disconnect();
    process.exit(0);
});

// Initialize bot
const initializeBot = async () => {
    console.log('🚀 Bot is starting up...');

    // Sync database
    try {
        await sequelize.authenticate();
        await syncDatabase();
        console.log('✅ Database connected and synced');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }

    // Connect to Redis
    try {
        await redisManager.connect();
        console.log('✅ Redis connected');
    } catch (error) {
        console.error('❌ Redis connection failed:', error);
        console.log('⚠️ Continuing without Redis - some features may not work');
    }

    // // Load commands and events
    await loadCommands();
    await loadEvents();

    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);

    // Initialize scheduler after login
    client.once(Events.ClientReady, () => {
        console.log('✅ Bot is ready!');
        initializeScheduler(client);
    });
};

// Start the bot
initializeBot().catch((error) => {
    console.error('❌ Failed to initialize bot:', error);
    process.exit(1);
});
