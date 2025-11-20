import { ChannelSelectMenuInteraction, MessageFlags } from "discord.js";
import { ConfigManager } from "../../utils/config";
import { createSholatConfigPanel } from "../../views/sholat/sholatConfigPanel";

/**
 * Handle sholat channel selection
 */
export async function handleSholatChannel(
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
    // Update the configuration with the selected sholat channel
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    const sholatConfig = currentConfig.sholat || {};

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      sholat: {
        ...sholatConfig,
        channel: selectedChannel?.id,
      },
    });

    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(interaction.message.id);
      if (message) {
        const panel = await createSholatConfigPanel(interaction.guildId!);
        if (!panel) return;

        await message.edit({
          embeds: [panel.embed],
          components: [panel.components[0] as any, panel.components[1] as any],
        });

        await interaction.reply({
          content: `✅ Sholat channel set to <#${selectedChannel?.id}>!`,
          flags: MessageFlags.Ephemeral,
        });

        return;
      }
    }
  } catch (error) {
    console.error("Error setting sholat channel:", error);
    await interaction.reply({
      content: "❌ Failed to set sholat channel. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

