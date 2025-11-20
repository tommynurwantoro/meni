import { ButtonInteraction, MessageFlags } from 'discord.js';
import { createMarketplaceConfigPanel, showMarketplaceConfigPanel } from '../../views/marketplace/marketplaceConfigPanel';
import { showMarketplaceStockPanel } from '../../views/marketplace/marketplaceStockPanel';
import { createStockAddModal, createStockRemoveModal, createStockUpdateModal } from '../../views/marketplace/marketplaceStockModal';
import { ConfigManager } from '../../utils/config';
import { showMarketplaceChannelPanel } from '../../views/marketplace/marketplaceChannelPanel';
import { sendMarketplaceUserPanel } from '../../utils/marketplaceUtils';
import { createMarketplaceUserPanel } from '../../views/marketplace/marketplaceUserPanel';

export async function handleMarketplaceButton(interaction: ButtonInteraction) {
    const customId = interaction.customId;

    switch (customId) {
        case 'marketplace_channel':
            await handleMarketplaceChannel(interaction);
            break;
        case 'marketplace_toggle':
            await handleMarketplaceToggle(interaction);
            break;
        case 'marketplace_stock':
            await handleMarketplaceStock(interaction);
            break;
        case 'marketplace_send_panel':
            await handleMarketplaceSendPanel(interaction);
            break;
        case 'stock_add':
            await handleStockAdd(interaction);
            break;
        case 'stock_update':
            await handleStockUpdate(interaction);
            break;
        case 'stock_remove':
            await handleStockRemove(interaction);
            break;
        case 'marketplace_refresh':
            await handleMarketplaceRefresh(interaction);
            break;
        default:
            await interaction.reply({
                content: '❌ Unknown marketplace option',
                flags: MessageFlags.Ephemeral
            });
    }
}

async function handleMarketplaceChannel(interaction: ButtonInteraction) {
    if (!interaction.guildId) return;
    await showMarketplaceChannelPanel(interaction);
}

async function handleMarketplaceToggle(interaction: ButtonInteraction) {
    if (!interaction.guildId) return;

    try {
        const currentConfig = ConfigManager.getGuildConfig(interaction.guildId) || {};
        const pointsConfig = currentConfig.points || {};

        ConfigManager.updateGuildConfig(interaction.guildId, {
            ...currentConfig,
            points: {
                ...pointsConfig,
                marketplace: {
                    ...pointsConfig.marketplace,
                    enabled: !pointsConfig.marketplace?.enabled
                }
            }
        });

        const channel = interaction.channel;

        if (channel && channel.isTextBased()) {
            const message = await channel.messages.fetch(interaction.message.id);
            if (message) {
                const panel = await createMarketplaceConfigPanel(interaction.guildId!);
                if (!panel) return;

                await message.edit({
                    embeds: [panel.embed],
                    components: [panel.components[0] as any, panel.components[1] as any, panel.components[2] as any],
                });
            }
        }

        await interaction.reply({
            content: `✅ Marketplace ${pointsConfig.marketplace?.enabled ? 'disabled' : 'enabled'}!`,
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error toggling marketplace:', error);
        await interaction.reply({
            content: '❌ Failed to toggle marketplace. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

async function handleMarketplaceStock(interaction: ButtonInteraction) {
    if (!interaction.guildId) return;
    await showMarketplaceStockPanel(interaction);
}

async function handleMarketplaceSendPanel(interaction: ButtonInteraction) {
    if (!interaction.guildId) return;
    try {
        await sendMarketplaceUserPanel(interaction.client, interaction.guildId);
    } catch (error) {
        console.error('Error sending marketplace panel:', error);
        await interaction.reply({
            content: '❌ Failed to send marketplace panel. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }

    await interaction.reply({
        content: '✅ Marketplace panel sent!',
        flags: MessageFlags.Ephemeral
    });
}

async function handleStockAdd(interaction: ButtonInteraction) {
    const modal = createStockAddModal(interaction.message.id);
    await interaction.showModal(modal);
}

async function handleStockUpdate(interaction: ButtonInteraction) {
    const modal = createStockUpdateModal(interaction.message.id);
    await interaction.showModal(modal);
}

async function handleStockRemove(interaction: ButtonInteraction) {
    const modal = createStockRemoveModal(interaction.message.id);
    await interaction.showModal(modal);
}

async function handleStockBack(interaction: ButtonInteraction) {
    if (!interaction.guildId) return;
    await showMarketplaceConfigPanel(interaction);
}

async function handleMarketplaceRefresh(interaction: ButtonInteraction) {
    if (!interaction.guildId) return;
    
    try {
        const panel = createMarketplaceUserPanel(interaction.guildId);
        if (!panel) {
            await interaction.reply({
                content: '❌ Failed to refresh marketplace panel.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await interaction.update({
            embeds: [panel.embed],
            components: panel.components as any[]
        });
    } catch (error) {
        console.error('Error refreshing marketplace panel:', error);
        await interaction.reply({
            content: '❌ Failed to refresh marketplace panel. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}
