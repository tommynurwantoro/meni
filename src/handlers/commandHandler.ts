import { ChatInputCommandInteraction, Collection, MessageFlags, Client } from 'discord.js';
import { handleError, logError } from '../utils/errorHandler';

interface Command {
    data: { name: string };
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
    cooldown?: number;
}

interface ExtendedClient extends Client {
    commands: Collection<string, Command>;
    cooldowns: Collection<string, Collection<string, number>>;
}

export async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client as ExtendedClient;
    const command = client.commands.get(interaction.commandName);

    if (!command) {
        logError(`Command Handler - ${interaction.commandName}`, new Error('Command not found'));
        return;
    }

    // Cooldown handling
    if (!client.cooldowns.has(command.data.name)) {
        client.cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = client.cooldowns.get(command.data.name);
    if (!timestamps) {
        return;
    }

    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(interaction.user.id)) {
        const expirationTime = timestamps.get(interaction.user.id)! + cooldownAmount;

        if (now < expirationTime) {
            const expiredTimestamp = Math.round(expirationTime / 1000);
            await interaction.reply({
                content: `⏰ Please wait <t:${expiredTimestamp}:R> before using the \`${command.data.name}\` command again.`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    try {
        await command.execute(interaction);
    } catch (error) {
        logError(`Command Handler - ${interaction.commandName}`, error);
        await handleError(interaction, error, {
            title: '❌ Command Error',
            description: 'There was an error while executing this command!',
        });
    }
}
