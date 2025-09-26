import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, ButtonInteraction, ChannelSelectMenuInteraction, TextDisplayBuilder } from 'discord.js';
import { ConfigManager } from '../../utils/config';

export function createPointsChannelSelectionPanel(guildId: string) {
    const config = ConfigManager.getGuildConfig(guildId);
    const embed = new EmbedBuilder()
        .setColor(config?.points?.logsChannel ? '#00ff00' : '#ff0000')
        .setTitle('☀️ Points Configuration')
        .setDescription('Configure the points system for your server.')
        .addFields(
            {
                name: '🔄 Current Status',
                value: config?.points?.logsChannel
                    ? `✅ ENABLED - Points system is active`
                    : '❌ DISABLED - No points logs channel configured',
                inline: false
            },
            {
                name: '📋 Points Logs Channel',
                value: config?.points?.logsChannel
                    ? `✅ Channel: <#${config?.points?.logsChannel}>`
                    : '❌ No channel selected',
                inline: false
            }
        )
        .setFooter({ text: 'Powered by BULLSTER' });

    const logsRow = new ActionRowBuilder()
        .addComponents(
            !config?.points?.logsChannel ? new ChannelSelectMenuBuilder()
                .setCustomId(`points_logs_channel`)
                .setPlaceholder('Select channel for points logs')
                .setChannelTypes(ChannelType.GuildText)
                .setMinValues(1)
                .setMaxValues(1)
                .setDefaultChannels(config?.points?.logsChannel ? [config.points.logsChannel] : [])
                .setDisabled(config?.points?.logsChannel ? true : false)
                : new ButtonBuilder()
                    .setCustomId(`points_feature_disable`)
                    .setLabel('Disable Points Feature')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
        );

    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('main_back')
                .setLabel('Back to Configuration Panel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
        );

    return {
        embed,
        components: [logsRow, buttonRow]
    };
}

export async function showPointsConfigPanel(interaction: ButtonInteraction | ChannelSelectMenuInteraction, additionalMessage?: string) {
    if (!interaction.guildId) return;
    const panel = createPointsChannelSelectionPanel(interaction.guildId);
    if (!panel) return;
    await interaction.update({
        content: additionalMessage || '',
        embeds: [panel.embed],
        components: [panel.components[0] as any, panel.components[1] as any]
    });
}