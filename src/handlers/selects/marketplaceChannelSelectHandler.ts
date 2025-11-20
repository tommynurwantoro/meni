import { ChannelSelectMenuInteraction, MessageFlags } from "discord.js";
import { ConfigManager } from "../../utils/config";
import { createMarketplaceConfigPanel } from "../../views/marketplace/marketplaceConfigPanel";

/**
 * Handle marketplace channel selection
 */
export async function handleMarketplaceChannel(
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
    // Update the configuration with the selected marketplace channel
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    const pointsConfig = currentConfig.points || {};

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      points: {
        ...pointsConfig,
        marketplace: {
          ...pointsConfig.marketplace,
          channel: selectedChannel.id,
        },
      },
    });

    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(interaction.message.id);
      if (message) {
        const panel = await createMarketplaceConfigPanel(interaction.guildId!);
        if (!panel) return;

        await message.edit({
          embeds: [panel.embed],
          components: [panel.components[0] as any, panel.components[1] as any],
        });
      }
    }

    await interaction.reply({
      content: `✅ Marketplace channel set to <#${selectedChannel.id}>!`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("Error setting marketplace channel:", error);
    await interaction.reply({
      content: "❌ Failed to set marketplace channel. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

