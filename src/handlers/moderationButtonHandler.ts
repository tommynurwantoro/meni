import { ButtonInteraction, MessageFlags } from 'discord.js';
import { createModerationConfigPanel } from '../views/moderation/moderationConfigPanel';
import { showModerationChannelPanel } from '../views/moderation/moderationChannelPanel';
import { ConfigManager } from '../utils/config';
import { showLinkProtectionPanel } from '../views/moderation/linkProtectionPanel';

export async function handleModerationButton(interaction: ButtonInteraction) {
    const customId = interaction.customId;

    switch (customId) {
        case 'moderation_enable':
            await handleModerationEnable(interaction);
            break;
        case 'moderation_disable':
            await handleModerationDisable(interaction);
            break;
        case 'moderation_link_protection':
            await handleModerationLinkProtection(interaction);
            break;
        case 'moderation_back':
            await handleModerationBack(interaction);
            break;
        default:
            await interaction.reply({
                content: '❌ Unknown moderation option',
                flags: MessageFlags.Ephemeral
            });
    }
}

async function handleModerationEnable(interaction: ButtonInteraction) {
    await showModerationChannelPanel(interaction);
}

async function handleModerationDisable(interaction: ButtonInteraction) {
    if (!interaction.guildId) return;
    try {
        // Update the configuration with the selected moderation logs channel
        const currentConfig = ConfigManager.getGuildConfig(interaction.guildId) || {};
        const moderationConfig = currentConfig.moderation || {};

        ConfigManager.updateGuildConfig(interaction.guildId, {
            ...currentConfig,
            moderation: {
                ...moderationConfig,
                linkProtection: false,
                logsChannel: undefined,
            }
        });

        const channel = interaction.channel;
        if (channel && channel.isTextBased()) {
            const message = await channel.messages.fetch(interaction.message.id);
            if (message) {
                const panel = createModerationConfigPanel(interaction.guildId);
                await message.edit({
                    embeds: [panel.embed],
                    components: [panel.components[0] as any, panel.components[1] as any]
                });
            }
        }

        await interaction.reply({
            content: '✅ Moderation disabled!',
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error disabling moderation:', error);
        await interaction.reply({
            content: '❌ Failed to disable moderation. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

async function handleModerationLinkProtection(interaction: ButtonInteraction) {
    if (!interaction.guildId) return;
    try {
        const currentConfig = ConfigManager.getGuildConfig(interaction.guildId) || {};
        const moderationConfig = currentConfig.moderation || {};

        if (!moderationConfig.logsChannel) {
            await interaction.reply({
                content: '⚠️ Moderation must be enabled first. Please enable moderation first.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await showLinkProtectionPanel(interaction);
    } catch (error) {
        console.error('Error disabling link protection:', error);
        await interaction.reply({
            content: '❌ Failed to disable link protection. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

async function handleModerationBack(interaction: ButtonInteraction) {
    // This will be handled by the main button handler's back button logic
    await interaction.reply({
        content: 'Use the back button to return to the main configuration panel.',
        flags: MessageFlags.Ephemeral
    });
}
