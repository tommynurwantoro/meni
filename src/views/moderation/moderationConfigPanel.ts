import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction, ChannelSelectMenuInteraction } from 'discord.js';
import { ConfigManager } from '../../utils/config';

export function createModerationConfigPanel(guildId: string) {
    const config = ConfigManager.getGuildConfig(guildId);
    const hasModerationChannel = !!config?.moderation?.logsChannel;
    const isLinkProtectionEnabled = config?.moderation?.linkProtection || false;

    const embed = new EmbedBuilder()
        .setColor(hasModerationChannel ? '#00ff00' : '#ff0000')
        .setTitle('🛡️ Moderation Configuration')
        .setDescription('Configure bot moderation settings:')
        .addFields(
            {
                name: '📊 Moderation Status',
                value: hasModerationChannel
                    ? `✅ **ENABLED**\nLogs Channel: <#${config?.moderation?.logsChannel}>`
                    : '❌ **DISABLED** - No moderation logs channel configured',
                inline: false
            },
            {
                name: '🔗 Link Protection Status',
                value: isLinkProtectionEnabled
                    ? '✅ **ENABLED** - Links are automatically removed'
                    : hasModerationChannel
                        ? '❌ **DISABLED** - Ready to enable'
                        : '❌ **UNAVAILABLE** - Enable moderation first',
                inline: false
            }
        )
        .setFooter({ text: 'Powered by BULLSTER' });

    const moderationRow = new ActionRowBuilder()
        .addComponents(
            hasModerationChannel ? new ButtonBuilder()
                .setCustomId('moderation_disable')
                .setLabel('Disable Moderation')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
                .setDisabled(!hasModerationChannel) : new ButtonBuilder()
                    .setCustomId('moderation_enable')
                    .setLabel('Enable Moderation')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId('moderation_link_protection')
                .setLabel('Configure Link Protection')
                .setStyle(hasModerationChannel ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('🔗')
                .setDisabled(!hasModerationChannel)
        );

    const backRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('main_back')
                .setLabel('Back to Configuration Panel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
        );

    return {
        embed,
        components: [moderationRow, backRow]
    };
}

export async function showModerationConfigPanel(interaction: ButtonInteraction | ChannelSelectMenuInteraction, additionalMessage?: string) {
    if (!interaction.guildId) return;
    const panel = createModerationConfigPanel(interaction.guildId);
    if (!panel) return;

    await interaction.update({
        content: additionalMessage || '',
        embeds: [panel.embed],
        components: [panel.components[0] as any, panel.components[1] as any]
    });
}