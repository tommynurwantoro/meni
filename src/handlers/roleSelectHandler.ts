import { MessageFlags, RoleSelectMenuInteraction } from "discord.js";
import { handlePresensiRoleSelect } from "./selects/presensiRoleSelectHandler";
import { handleSholatRoleSelect } from "./selects/sholatRoleSelectHandler";

/**
 * Main role select handler router
 * Routes role selection interactions to domain-specific handlers
 */
export async function handleRoleSelect(interaction: RoleSelectMenuInteraction): Promise<void> {
  const customId = interaction.customId;

  switch (customId) {
    case "presensi_role":
      await handlePresensiRoleSelect(interaction);
      break;
    case "sholat_role":
      await handleSholatRoleSelect(interaction);
      break;
    default:
      await interaction.reply({
        content: "❌ Unknown role selection",
        flags: MessageFlags.Ephemeral,
      });
  }
}
