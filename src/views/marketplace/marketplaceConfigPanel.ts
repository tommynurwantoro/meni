import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, ButtonInteraction, ChannelSelectMenuInteraction, ModalSubmitInteraction, MessageFlags } from 'discord.js';
import { ConfigManager } from '../../utils/config';

export function createMarketplaceConfigPanel(guildId: string) {
    const config = ConfigManager.getGuildConfig(guildId);
    const hasMarketplaceChannel = !!config?.points?.marketplaceChannel;
    const stockCount = config?.points?.stock?.length || 0;

    const embed = new EmbedBuilder()
        .setColor(hasMarketplaceChannel ? '#00ff00' : '#ff0000')
        .setTitle('💰 Marketplace Configuration')
        .setDescription('Configure the marketplace system for your server.')
        .addFields(
            {
                name: '🔄 Current Status',
                value: hasMarketplaceChannel
                    ? '✅ **ENABLED** - Marketplace is active'
                    : '❌ **DISABLED** - Marketplace is inactive',
                inline: false
            },
            {
                name: '📋 Marketplace Channel',
                value: hasMarketplaceChannel
                    ? `✅ Channel: <#${config?.points?.marketplaceChannel}>`
                    : '❌ No channel selected',
                inline: false
            },
            {
                name: '📦 Available Stock',
                value: stockCount > 0
                    ? `✅ ${stockCount} items available`
                    : '❌ No stock items configured',
                inline: false
            }
        )
        .setFooter({ text: 'Powered by BULLSTER' });

    const row1a = new ActionRowBuilder()
        .addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('marketplace_channel_select')
                .setPlaceholder('Select channel for marketplace')
                .setChannelTypes(ChannelType.GuildText)
                .setMinValues(1)
                .setMaxValues(1)
        );

    const row1b = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('marketplace_disable')
                .setLabel('Disable Marketplace Feature')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌'),
            new ButtonBuilder()
                .setCustomId('marketplace_stock')
                .setLabel('Manage Stock')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📦')
                .setDisabled(!hasMarketplaceChannel)
        );

    const row1 = !hasMarketplaceChannel ? row1a : row1b;

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('main_back')
                .setLabel('Back to Configuration Panel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
        );

    return {
        embed,
        components: [row1, row2]
    };
}

export async function showMarketplaceConfigPanel(interaction: ButtonInteraction | ChannelSelectMenuInteraction | ModalSubmitInteraction, additionalMessage?: string) {
    if (!interaction.guildId) return;
    const panel = createMarketplaceConfigPanel(interaction.guildId);
    if (!panel) return;

    if (interaction.isModalSubmit()) {
        // For modal submissions, we need to reply since we can't update
        await interaction.reply({
            content: additionalMessage || '',
            embeds: [panel.embed],
            components: [panel.components[0] as any, panel.components[1] as any],
            flags: MessageFlags.Ephemeral
        });
    } else {
        // For button and channel select interactions, we can update
        await interaction.update({
            content: additionalMessage || '',
            embeds: [panel.embed],
            components: [panel.components[0] as any, panel.components[1] as any]
        });
    }
}

