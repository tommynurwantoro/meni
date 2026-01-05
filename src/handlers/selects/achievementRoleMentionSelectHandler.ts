import { MessageFlags, RoleSelectMenuInteraction } from "discord.js";
import { ConfigManager } from "../../utils/config";
import { createPointsConfigPanel } from "../../views/points/pointsConfigPanel";

/**
 * Handle achievement role mention selection
 */
export async function handleAchievementRoleMentionSelect(
  interaction: RoleSelectMenuInteraction
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const selectedRole = interaction.roles.first();
  if (!selectedRole) {
    await interaction.reply({
      content: "❌ No role selected. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    // Update the configuration with the selected role
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    const pointsConfig = currentConfig.points || {};

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      points: {
        ...pointsConfig,
        achievementRoleMention: selectedRole.id,
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
          components: [
            panel.components[0] as any,
            panel.components[1] as any,
            panel.components[2] as any,
            panel.components[3] as any,
          ],
        });
      }

      await interaction.reply({
        content: `✅ Achievement role mention set to <@&${selectedRole.id}>!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  } catch (error) {
    console.error("Error setting achievement role mention:", error);
    await interaction.reply({
      content: "❌ Failed to set achievement role mention. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

