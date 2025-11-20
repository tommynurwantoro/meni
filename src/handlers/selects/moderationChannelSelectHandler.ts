import { ChannelSelectMenuInteraction, MessageFlags } from "discord.js";
import { ConfigManager } from "../../utils/config";
import { createModerationConfigPanel } from "../../views/moderation/moderationConfigPanel";

/**
 * Handle moderation logs channel selection
 */
export async function handleModerationLogsChannel(
  interaction: ChannelSelectMenuInteraction
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const selectedChannel = interaction.channels.first();
  if (!selectedChannel) {
    await interaction.reply({
      content: "❌ No channel selected. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    // Update the configuration with the selected moderation logs channel
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    const moderationConfig = currentConfig.moderation || {};

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      moderation: {
        ...moderationConfig,
        linkProtection: false,
        logsChannel: selectedChannel.id,
      },
    });

    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(interaction.message.id);
      if (message) {
        const panel = createModerationConfigPanel(interaction.guildId!);
        await message.edit({
          embeds: [panel.embed],
          components: [panel.components[0] as any, panel.components[1] as any],
        });
        await interaction.reply({
          content: `✅ Moderation logs channel set to <#${selectedChannel.id}>!`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } catch (error) {
    console.error("Error setting moderation logs channel:", error);
    await interaction.reply({
      content: "❌ Failed to set moderation logs channel. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

