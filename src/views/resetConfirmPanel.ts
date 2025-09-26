import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function createResetConfirmPanel() {
    const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🗑️ Reset Configuration')
        .setDescription('⚠️ **Warning:** This will reset ALL bot configuration for this server!')
        .addFields(
            { name: '🔄 What will be reset:', value: '• Welcome system settings\n• All other configurations\n• Custom messages and channels', inline: false },
            { name: '💾 Backup', value: 'Make sure to note down any important settings before proceeding.', inline: false }
        )
        .setFooter({ text: 'This action cannot be undone' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('reset_confirm')
                .setLabel('Confirm Reset')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚠️'),
            new ButtonBuilder()
                .setCustomId('reset_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌')
        );

    return {
        embed,
        components: [row]
    };
}

export function createResetSuccessPanel(userId: string) {
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Configuration Reset Complete')
        .setDescription('All bot configuration for this server has been reset.')
        .addFields(
            { name: '👑 Reset by', value: `<@${userId}>`, inline: true },
            { name: '📅 Reset at', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: 'Configuration reset successfully' })
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('main_back')
                .setLabel('Back to Configuration Panel')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⚙️')
        );

    return {
        embed,
        components: [row]
    };
}

export function createResetErrorPanel() {
    const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Reset Failed')
        .setDescription('Failed to reset configuration. Please try again.')
        .setFooter({ text: 'Error occurred during reset' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('main_back')
                .setLabel('Back to Configuration Panel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
        );

    return {
        embed,
        components: [row]
    };
}
