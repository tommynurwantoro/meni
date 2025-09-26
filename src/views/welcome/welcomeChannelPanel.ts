import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, ButtonInteraction } from 'discord.js';

export function createWelcomeChannelPanel() {
    const embed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle('🎯 Select Welcome Channel')
        .setDescription('Choose a channel where the welcome message will be sent:')
        .addFields(
            {
                name: '⚠️ Important',
                value: 'This channel will receive the welcome message. Choose a channel that members can access.',
                inline: false
            }
        )
        .setFooter({ text: 'Powered by BULLSTER' });

    const channelRow = new ActionRowBuilder()
        .addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId(`welcome_channel_select`)
                .setPlaceholder('Select channel for welcome messages')
                .setChannelTypes(ChannelType.GuildText)
                .setMinValues(1)
                .setMaxValues(1)
        );

    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('welcome_channel_back')
                .setLabel('Back to Welcome Config')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
        );

    return {
        embed,
        components: [channelRow, buttonRow]
    };
}

export async function showWelcomeChannelPanel(interaction: ButtonInteraction, additionalMessage?: string) {
    if (!interaction.guildId) return;
    const panel = createWelcomeChannelPanel();
    await interaction.update({
        content: additionalMessage || '',
        embeds: [panel.embed],
        components: [panel.components[0] as any, panel.components[1] as any]
    });
}