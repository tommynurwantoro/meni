import { MessageFlags, RoleSelectMenuInteraction } from "discord.js";
import { ConfigManager } from "../../utils/config";
import { createSholatConfigPanel } from "../../views/sholat/sholatConfigPanel";

/**
 * Handle sholat role selection
 */
export async function handleSholatRoleSelect(
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
    const sholatConfig = currentConfig.sholat || {};

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      sholat: {
        ...sholatConfig,
        role: selectedRole.id,
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
      }

      await interaction.reply({
        content: `✅ Sholat role set to <@&${selectedRole.id}>!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  } catch (error) {
    console.error("Error setting sholat role:", error);
    await interaction.reply({
      content: "❌ Failed to set sholat role. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

