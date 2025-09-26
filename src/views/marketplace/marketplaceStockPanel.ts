import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction, ModalSubmitInteraction, MessageFlags } from 'discord.js';
import { ConfigManager } from '../../utils/config';

export function createMarketplaceStockPanel(guildId: string) {
    const config = ConfigManager.getGuildConfig(guildId);
    const stockItems = config?.points?.stock || [];

    // list items in a list
    const itemList = stockItems.map((item) => `
    📦 ${item.name} (${item.description})
    💰 ${item.price} points | ${item.quantity} available`).join('\n');

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('📦 Marketplace Stock Management')
        .setDescription('Manage available items in your marketplace:')
        .addFields(
            {
                name: '📊 Current Stock',
                value: stockItems.length > 0
                    ? itemList
                    : 'No items in stock',
                inline: false
            }
        )
        .setFooter({ text: 'Powered by BULLSTER' });

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stock_add')
                .setLabel('Add New Item')
                .setStyle(ButtonStyle.Success)
                .setEmoji('➕'),
            new ButtonBuilder()
                .setCustomId('stock_update')
                .setLabel('Update Item')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔄')
                .setDisabled(stockItems.length === 0),
            new ButtonBuilder()
                .setCustomId('stock_remove')
                .setLabel('Remove Item')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️')
                .setDisabled(stockItems.length === 0)
        );

    const backRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('marketplace_back')
                .setLabel('Back to Marketplace Config')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
        );

    return {
        embed,
        components: [actionRow, backRow]
    };
}

export async function showMarketplaceStockPanel(interaction: ButtonInteraction | ModalSubmitInteraction, additionalMessage?: string) {
    if (!interaction.guildId) return;
    const panel = createMarketplaceStockPanel(interaction.guildId);
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
        // For button interactions, we can update
        await interaction.update({
            content: additionalMessage || '',
            embeds: [panel.embed],
            components: [panel.components[0] as any, panel.components[1] as any]
        });
    }
}

