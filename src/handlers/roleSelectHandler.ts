import { MessageFlags, RoleSelectMenuInteraction } from "discord.js";
import { ConfigManager } from "../utils/config";
import { createPresensiConfigPanel } from "../views/presensi/presensiConfigPanel";
import { createSholatConfigPanel } from "../views/sholat/sholatConfigPanel";

export async function handleRoleSelect(interaction: RoleSelectMenuInteraction) {
  const customId = interaction.customId;

  switch (customId) {
    case "presensi_role_select":
      await handlePresensiRoleSelect(interaction);
      break;
    case "sholat_role_select":
      await handleSholatRoleSelect(interaction);
      break;
    default:
      await interaction.reply({
        content: "❌ Unknown role selection",
        flags: MessageFlags.Ephemeral,
      });
  }
}

async function handlePresensiRoleSelect(
  interaction: RoleSelectMenuInteraction
) {
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
    const presensiConfig = currentConfig.presensi || {};

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      presensi: {
        ...presensiConfig,
        role: selectedRole.id,
      },
    });

    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(interaction.message.id);
      if (message) {
        const panel = await createPresensiConfigPanel(interaction.guildId!);
        if (!panel) return;

        await message.edit({
          embeds: [panel.embed],
          components: [panel.components[0] as any, panel.components[1] as any],
        });
      }

      await interaction.reply({
        content: `✅ Presensi role set to <@&${selectedRole.id}>!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  } catch (error) {
    console.error("Error setting presensi role:", error);
    await interaction.reply({
      content: "❌ Failed to set presensi role. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleSholatRoleSelect(
    interaction: RoleSelectMenuInteraction
  ) {
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