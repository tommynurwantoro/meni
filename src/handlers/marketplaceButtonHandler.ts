import { ButtonInteraction, MessageFlags } from 'discord.js';
import { createMarketplaceConfigPanel, showMarketplaceConfigPanel } from '../views/marketplace/marketplaceConfigPanel';
import { showMarketplaceStockPanel } from '../views/marketplace/marketplaceStockPanel';
import { createStockAddModal, createStockRemoveModal, createStockUpdateModal } from '../views/marketplace/marketplaceStockModal';
import { ConfigManager } from '../utils/config';

export async function handleMarketplaceButton(interaction: ButtonInteraction) {
    const customId = interaction.customId;

    switch (customId) {
        case 'marketplace_disable':
            await handleMarketplaceDisable(interaction);
            break;
        case 'marketplace_stock':
            await handleMarketplaceStock(interaction);
            break;
        case 'marketplace_back':
            await handleMarketplaceBack(interaction);
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
        case 'stock_back':
            await handleStockBack(interaction);
            break;
        default:
            await interaction.reply({
                content: '❌ Unknown marketplace option',
                flags: MessageFlags.Ephemeral
            });
    }
}

async function handleMarketplaceDisable(interaction: ButtonInteraction) {
    if (!interaction.guildId) return;

    try {
        const currentConfig = ConfigManager.getGuildConfig(interaction.guildId) || {};
        const pointsConfig = currentConfig.points || {};

        ConfigManager.updateGuildConfig(interaction.guildId, {
            ...currentConfig,
            points: {
                ...pointsConfig,
                marketplaceChannel: undefined
            }
        });

        const channel = interaction.channel;

        if (channel && channel.isTextBased()) {
            const message = await channel.messages.fetch(interaction.message.id);
            if (message) {
                const panel = createMarketplaceConfigPanel(interaction.guildId!);
                await message.edit({
                    embeds: [panel.embed],
                    components: [panel.components[0] as any, panel.components[1] as any]
                });
            }
        }

        await interaction.reply({
            content: '✅ Marketplace disabled!',
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error disabling marketplace:', error);
        await interaction.reply({
            content: '❌ Failed to disable marketplace. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

async function handleMarketplaceStock(interaction: ButtonInteraction) {
    if (!interaction.guildId) return;
    await showMarketplaceStockPanel(interaction);
}

async function handleMarketplaceBack(interaction: ButtonInteraction) {
    // This will be handled by the main button handler's back button logic
    await interaction.reply({
        content: 'Use the back button to return to the main configuration panel.',
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
