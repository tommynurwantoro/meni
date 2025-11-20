import { ChannelSelectMenuInteraction, MessageFlags } from "discord.js";
import { ConfigManager } from "../../utils/config";
import { createWelcomeConfigPanel } from "../../views/welcome/welcomeConfigPanel";

/**
 * Handle welcome channel selection
 */
export async function handleWelcomeChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const selectedChannel = interaction.channels.first();

  try {
    // Update the configuration with the selected welcome channel
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      welcome: {
        channel: selectedChannel?.id,
        message: "Welcome to the server!",
      },
    });

    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(interaction.message.id);
      if (message) {
        const panel = createWelcomeConfigPanel(interaction.guildId!);

        await message.edit({
          embeds: [panel.embed],
          components: [panel.components[0] as any, panel.components[1] as any],
        });

        await interaction.reply({
          content: `✅ Welcome channel set to <#${selectedChannel?.id}>!`,
          flags: MessageFlags.Ephemeral,
        });

        return;
      }
    }
  } catch (error) {
    console.error("Error setting welcome channel:", error);
    await interaction.reply({
      content: "❌ Failed to set welcome channel. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

