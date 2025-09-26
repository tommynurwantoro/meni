import { ButtonInteraction, MessageFlags } from 'discord.js';
import { createPointsChannelSelectionPanel } from '../views/points/pointConfigPanel';
import { ConfigManager } from '../utils/config';

export async function handlePointsButton(interaction: ButtonInteraction) {
    const customId = interaction.customId;

    switch (customId) {
        case 'points_feature_disable':
            await handlePointsFeatureDisable(interaction);
            break;
        case 'points_configure':
            await handlePointsConfigure(interaction);
            break;
        case 'points_back':
            await handlePointsBack(interaction);
            break;
        default:
            await interaction.reply({
                content: '❌ Unknown points option',
                flags: MessageFlags.Ephemeral
            });
    }
}

async function handlePointsConfigure(interaction: ButtonInteraction) {
    if (!interaction.guildId) return;
    const panel = createPointsChannelSelectionPanel(interaction.guildId);
    await interaction.update({
        embeds: [panel.embed],
        components: [panel.components[0] as any, panel.components[1] as any, panel.components[2] as any]
    });
}

async function handlePointsBack(interaction: ButtonInteraction) {
    // This will be handled by the main button handler's back button logic
    // which will return to the main configuration panel
    await interaction.reply({
        content: 'Use the back button to return to the main configuration panel.',
        flags: MessageFlags.Ephemeral
    });
}

async function handlePointsFeatureDisable(interaction: ButtonInteraction) {
    if (!interaction.guildId) return;
    const config = ConfigManager.getGuildConfig(interaction.guildId);
    if (!config?.points?.logsChannel) return;
    ConfigManager.updateGuildConfig(interaction.guildId, {
        points: {
            logsChannel: undefined,
            marketplaceChannel: undefined
        }
    });

    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
        const message = await channel.messages.fetch(interaction.message.id);
        if (message) {
            const panel = createPointsChannelSelectionPanel(interaction.guildId);
            await message.edit({
                embeds: [panel.embed],
                components: [panel.components[0] as any, panel.components[1] as any]
            });
            await interaction.reply({
                content: '✅ Points feature disabled!',
                flags: MessageFlags.Ephemeral
            });
        }
    } else {
        await interaction.reply({
            content: '❌ Failed to disable points feature. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}