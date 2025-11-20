import { ChannelSelectMenuInteraction, MessageFlags } from "discord.js";
import { ConfigManager } from "../../utils/config";
import { createPointsConfigPanel } from "../../views/points/pointsConfigPanel";

/**
 * Handle points logs channel selection
 */
export async function handlePointsLogsChannel(
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
    // Update the configuration with the selected logs channel
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      points: {
        ...currentConfig.points,
        logsChannel: selectedChannel.id,
      },
    });

    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(interaction.message.id);
      if (message) {
        const panel = await createPointsConfigPanel(interaction.guildId!);
        if (!panel) return;

        await message.edit({
          embeds: [panel.embed],
          components: [panel.components[0] as any, panel.components[1] as any],
        });

        await interaction.reply({
          content: `✅ Points logs channel set to <#${selectedChannel.id}>!`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } catch (error) {
    console.error("Error setting points logs channel:", error);
    await interaction.reply({
      content: "❌ Failed to set points logs channel. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handle points thanks channel selection
 */
export async function handlePointsThanksChannel(
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
    // Update the configuration with the selected thanks channel
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    const pointsConfig = currentConfig.points || {};

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      points: {
        ...pointsConfig,
        thanksChannel: selectedChannel?.id,
      },
    });

    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(interaction.message.id);
      if (message) {
        const panel = await createPointsConfigPanel(interaction.guildId!);
        if (!panel) return;

        await message.edit({
          embeds: [panel.embed],
          components: [panel.components[0] as any, panel.components[1] as any],
        });
      }
    }

    await interaction.reply({
      content: `✅ Thanks channel set to <#${selectedChannel?.id}>!`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  } catch (error) {
    console.error("Error setting thanks channel:", error);
    await interaction.reply({
      content: "❌ Failed to set thanks channel. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

