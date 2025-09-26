import { ButtonInteraction, MessageFlags } from "discord.js";
import { ConfigManager } from "../utils/config";
import { showPresensiConfigPanel } from "../views/presensi/presensiConfigPanel";
import { sendPresensiReminder } from "../utils/presensiUtils";
import { showPresensiChannelPanel } from "../views/presensi/presensiChannelPanel";
import { showPresensiRolePanel } from "../views/presensi/presensiRolePanel";

export async function handlePresensiButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({
      content: "❌ This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    switch (customId) {
      case "presensi_channel":
        await handlePresensiChannel(interaction);
        break;

      case "presensi_role":
        await handlePresensiRole(interaction);
        break;

      case "presensi_toggle":
        await handlePresensiToggle(interaction);
        break;

      case "presensi_test":
        await handlePresensiTest(interaction);
        break;

      default:
        await interaction.reply({
          content: "❌ Unknown presensi button interaction",
          flags: MessageFlags.Ephemeral,
        });
    }
  } catch (error) {
    console.error("Error handling presensi button:", error);
    await interaction.reply({
      content: "❌ An error occurred while processing the request.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handlePresensiChannel(interaction: ButtonInteraction) {
  await showPresensiChannelPanel(interaction); 
}

async function handlePresensiRole(interaction: ButtonInteraction) {
  await showPresensiRolePanel(interaction);
}

async function handlePresensiToggle(interaction: ButtonInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const config = ConfigManager.getGuildConfig(guildId);
  const presensiConfig = config?.presensi;

  if (!presensiConfig?.channel || !presensiConfig?.role) {
    await interaction.reply({
      content: "❌ Please set both channel and role before enabling presensi reminders.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const newEnabled = !presensiConfig.enabled;
  
  ConfigManager.updateGuildConfig(guildId, {
    presensi: {
      ...presensiConfig,
      enabled: newEnabled,
    },
  });

  await showPresensiConfigPanel(interaction, 
    `✅ Presensi reminders ${newEnabled ? 'enabled' : 'disabled'} successfully!`
  );
}

async function handlePresensiTest(interaction: ButtonInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const config = ConfigManager.getGuildConfig(guildId);
  const presensiConfig = config?.presensi;

  if (!presensiConfig?.enabled || !presensiConfig?.channel || !presensiConfig?.role) {
    await interaction.reply({
      content: "❌ Presensi reminders must be configured and enabled to test.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Send a test reminder
  await sendPresensiReminder(interaction.client, guildId, "morning");

  await interaction.reply({
    content: "🧪 Test reminder sent! Check the configured channel.",
    flags: MessageFlags.Ephemeral,
  });
}
