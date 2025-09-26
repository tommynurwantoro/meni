import { ButtonInteraction, MessageFlags } from 'discord.js';
import { createLinkProtectionPanel } from '../views/moderation/linkProtectionPanel';
import { ConfigManager } from '../utils/config';
import { createLinkProtectionModal } from '../views/moderation/linkProtectionModal';

export async function handleLinkProtectionButton(interaction: ButtonInteraction) {
    const customId = interaction.customId;

    switch (customId) {
        case 'link_protection_enable':
            await handleLinkProtectionEnable(interaction);
            break;
        case 'link_protection_disable':
            await handleLinkProtectionDisable(interaction);
            break;
        case 'link_protection_whitelist':
            await handleLinkProtectionWhitelist(interaction);
            break;
    }
}

async function handleLinkProtectionEnable(interaction: ButtonInteraction) {
    if (!interaction.guildId) return;
    const currentConfig = ConfigManager.getGuildConfig(interaction.guildId) || {};
    const moderationConfig = currentConfig.moderation || {};

    ConfigManager.updateGuildConfig(interaction.guildId, {
        ...currentConfig,
        moderation: {
            ...moderationConfig,
            linkProtection: true
        }
    });

    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
        const message = await channel.messages.fetch(interaction.message.id);
        if (message) {
            const panel = createLinkProtectionPanel(interaction.guildId!);
            await message.edit({
                embeds: [panel.embed],
                components: [panel.components[0] as any, panel.components[1] as any]
            });
            await interaction.reply({
                content: '✅ Link protection enabled!',
                flags: MessageFlags.Ephemeral
            });
        }
    }
}

async function handleLinkProtectionDisable(interaction: ButtonInteraction) {
    if (!interaction.guildId) return;
    const currentConfig = ConfigManager.getGuildConfig(interaction.guildId) || {};
    const moderationConfig = currentConfig.moderation || {};

    ConfigManager.updateGuildConfig(interaction.guildId, {
        ...currentConfig,
        moderation: {
            ...moderationConfig,
            linkProtection: false,
            whitelistDomains: []
        }
    });

    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
        const message = await channel.messages.fetch(interaction.message.id);
        if (message) {
            const panel = createLinkProtectionPanel(interaction.guildId);
            await message.edit({
                embeds: [panel.embed],
                components: [panel.components[0] as any, panel.components[1] as any]
            });
            await interaction.reply({
                content: '✅ Link protection disabled!',
                flags: MessageFlags.Ephemeral
            });
        }
    }
}

async function handleLinkProtectionWhitelist(interaction: ButtonInteraction) {
    const modal = createLinkProtectionModal(interaction.message.id);
    await interaction.showModal(modal);
}