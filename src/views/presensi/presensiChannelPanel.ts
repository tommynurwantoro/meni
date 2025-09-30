import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, ButtonInteraction } from 'discord.js';

export function createPresensiChannelPanel() {
    const embed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle('🎯 Select Presensi Channel')
        .setDescription('Choose a channel where the presensi message will be sent:')
        .addFields(
            {
                name: '⚠️ Important',
                value: 'This channel will receive the presensi message. Choose a channel that members can access.',
                inline: false
            }
        )
        .setFooter({ text: 'Powered by MENI' });

    const channelRow = new ActionRowBuilder()
        .addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId(`presensi_channel_select`)
                .setPlaceholder('Select channel for presensi messages')
                .setChannelTypes(ChannelType.GuildText)
                .setMinValues(1)
                .setMaxValues(1)
        );

    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('presensi_back')
                .setLabel('Back to Presensi Config')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
        );

    return {
        embed,
        components: [channelRow, buttonRow]
    };
}

export async function showPresensiChannelPanel(interaction: ButtonInteraction, additionalMessage?: string) {
    if (!interaction.guildId) return;
    const panel = createPresensiChannelPanel();
    await interaction.update({
        content: additionalMessage || '',
        embeds: [panel.embed],
        components: [panel.components[0] as any, panel.components[1] as any]
    });
}