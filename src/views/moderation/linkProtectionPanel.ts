import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction, ModalSubmitInteraction, ChannelSelectMenuInteraction } from 'discord.js';
import { ConfigManager } from '../../utils/config';

export function createLinkProtectionPanel(guildId: string) {
    const config = ConfigManager.getGuildConfig(guildId);
    const isEnabled = config?.moderation?.linkProtection || false;
    const hasModerationChannel = !!config?.moderation?.logsChannel;

    if (!hasModerationChannel) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🔗 Link Protection Configuration')
            .setDescription('❌ **Moderation must be enabled first!**\n\nYou need to configure a moderation logs channel before you can enable link protection.')
            .addFields(
                {
                    name: '📋 Next Steps',
                    value: '1. Go back to Moderation Configuration\n2. Click "Enable Moderation"\n3. Select a logs channel\n4. Return here to configure link protection',
                    inline: false
                }
            )
            .setFooter({ text: 'Powered by BULLSTER' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('link_protection_back')
                    .setLabel('Back to Moderation Config')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
            );

        return {
            embed,
            components: [row]
        };
    }

    const embed = new EmbedBuilder()
        .setColor(isEnabled ? '#00ff00' : '#ff0000')
        .setTitle('🔗 Link Protection Configuration')
        .setDescription('Configure automatic link detection and removal:')
        .addFields(
            {
                name: '🔄 Current Status',
                value: isEnabled ? '✅ **ENABLED** - Links are automatically removed' : '❌ **DISABLED** - Links are allowed',
                inline: false
            },
            {
                name: '🔍 What it does',
                value: '• Detects messages containing links\n• Automatically removes link messages\n• Sends warning embeds to users\n• Logs moderation actions',
                inline: false
            },
            {
                name: '📊 Logging',
                value: `All actions are logged to <#${config?.moderation?.logsChannel}>`,
                inline: false
            },
            {
                name: '🔒 Whitelist Domains',
                value: config?.moderation?.whitelistDomains && config.moderation.whitelistDomains.length > 0
                    ? config.moderation.whitelistDomains.join(', ')
                    : 'No domains whitelisted',
                inline: false
            }
        )
        .setFooter({ text: 'Powered by BULLSTER' });

    const toggleRow = new ActionRowBuilder()
        .addComponents(
            isEnabled ? new ButtonBuilder()
                .setCustomId('link_protection_disable')
                .setLabel('Disable Link Protection')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌') : new ButtonBuilder()
                    .setCustomId('link_protection_enable')
                    .setLabel('Enable Link Protection')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId('link_protection_whitelist')
                .setLabel('Configure Whitelist')
                .setStyle(isEnabled ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('⚙️')
                .setDisabled(!isEnabled)
        );

    const backRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('link_protection_back')
                .setLabel('Back to Moderation Config')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
        );

    return {
        embed,
        components: [toggleRow, backRow]
    };
}

export async function showLinkProtectionPanel(interaction: ButtonInteraction, additionalMessage?: string) {
    if (!interaction.guildId) return;
    const panel = createLinkProtectionPanel(interaction.guildId);
    if (!panel) return;

    await interaction.update({
        content: additionalMessage || '',
        embeds: [panel.embed],
        components: [panel.components[0] as any, panel.components[1] as any]
    });
}