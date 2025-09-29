import { ButtonInteraction, MessageFlags } from "discord.js";
import { ConfigManager } from "../utils/config";
import { showSholatConfigPanel } from "../views/sholat/sholatConfigPanel";
import { sendSholatReminder } from "../utils/sholatUtils";
import { showSholatChannelPanel } from "../views/sholat/sholatChannelPanel";
import { showSholatRolePanel } from "../views/sholat/sholatRolePanel";

export async function handleSholatButton(interaction: ButtonInteraction) {
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
      case "sholat_channel":
        await handleSholatChannel(interaction);
        break;

      case "sholat_role":
        await handleSholatRole(interaction);
        break;

      case "sholat_toggle":
        await handleSholatToggle(interaction);
        break;

      case "sholat_test":
        await handleSholatTest(interaction);
        break;

      default:
        await interaction.reply({
          content: "❌ Unknown sholat button interaction",
          flags: MessageFlags.Ephemeral,
        });
    }
  } catch (error) {
    console.error("Error handling sholat button:", error);
    await interaction.reply({
      content: "❌ An error occurred while processing the request.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleSholatChannel(interaction: ButtonInteraction) {
  await showSholatChannelPanel(interaction); 
}

async function handleSholatRole(interaction: ButtonInteraction) {
  await showSholatRolePanel(interaction);
}

async function handleSholatToggle(interaction: ButtonInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const config = ConfigManager.getGuildConfig(guildId);
  const sholatConfig = config?.sholat;

  if (!sholatConfig?.channel || !sholatConfig?.role) {
    await interaction.reply({
      content: "❌ Please set both channel and role before enabling sholat reminders.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const newEnabled = !sholatConfig.enabled;
  
  ConfigManager.updateGuildConfig(guildId, {
    sholat: {
      ...sholatConfig,
      enabled: newEnabled,
    },
  });

  await showSholatConfigPanel(interaction, 
    `✅ Sholat reminders ${newEnabled ? 'enabled' : 'disabled'} successfully!`
  );
}

async function handleSholatTest(interaction: ButtonInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const config = ConfigManager.getGuildConfig(guildId);
  const sholatConfig = config?.sholat;

  if (!sholatConfig?.enabled || !sholatConfig?.channel || !sholatConfig?.role) {
    await interaction.reply({
      content: "❌ Sholat reminders must be configured and enabled to test.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Send a test reminder
  await sendSholatReminder(interaction.client, guildId, "Subuh", "05:30");

  await interaction.reply({
    content: "🧪 Test reminder sent! Check the configured channel.",
    flags: MessageFlags.Ephemeral,
  });
}
