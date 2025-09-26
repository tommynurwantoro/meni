import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, ButtonInteraction } from 'discord.js';

export function createModerationChannelPanel() {
    const embed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle('🛡️ Select Moderation Logs Channel')
        .setDescription('Choose a channel where all moderation actions will be logged:')
        .addFields(
            {
                name: '📊 What gets logged',
                value: '• Link protection actions\n• Message deletions\n• User warnings\n• Moderation events\n• System status updates',
                inline: false
            },
            {
                name: '⚠️ Important',
                value: 'This channel will receive detailed logs of all moderation activities. Choose a channel that moderators can access.',
                inline: false
            }
        )
        .setFooter({ text: 'Powered by BULLSTER' });

    const channelRow = new ActionRowBuilder()
        .addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('moderation_channel_select')
                .setPlaceholder('Select channel for moderation logs')
                .setChannelTypes(ChannelType.GuildText)
                .setMinValues(1)
                .setMaxValues(1)
        );

    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('moderation_channel_back')
                .setLabel('Back to Moderation Config')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
        );

    return {
        embed,
        components: [channelRow, buttonRow]
    };
}

export async function showModerationChannelPanel(interaction: ButtonInteraction, additionalMessage?: string) {
    if (!interaction.guildId) return;
    const panel = createModerationChannelPanel();
    await interaction.update({
        content: additionalMessage || '',
        embeds: [panel.embed],
        components: [panel.components[0] as any, panel.components[1] as any]
    });
}