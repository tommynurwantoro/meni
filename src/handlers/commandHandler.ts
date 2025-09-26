import { ChatInputCommandInteraction, Collection, MessageFlags } from 'discord.js';

export async function handleCommand(interaction: ChatInputCommandInteraction) {
    const command = (interaction.client as any).commands.get(interaction.commandName);

    if (!command) {
        console.error(`❌ Command ${interaction.commandName} not found`);
        return;
    }

    // Cooldown handling
    const { cooldowns } = interaction.client as any;
    if (!cooldowns.has(command.data.name)) {
        cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(interaction.user.id)) {
        const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

        if (now < expirationTime) {
            const expiredTimestamp = Math.round(expirationTime / 1000);
            return interaction.reply({
                content: `⏰ Please wait <t:${expiredTimestamp}:R> before using the \`${command.data.name}\` command again.`,
                flags: MessageFlags.Ephemeral
            });
        }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`❌ Error executing command ${interaction.commandName}:`, error);

        const errorMessage = {
            content: '❌ There was an error while executing this command!',
            ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
}
