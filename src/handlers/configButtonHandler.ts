import { ButtonInteraction, MessageFlags } from "discord.js";
import { showWelcomeConfigPanel, createResetConfirmPanel } from "../views";
import { showPointsConfigPanel } from "../views/points/pointConfigPanel";
import { showModerationConfigPanel } from "../views/moderation/moderationConfigPanel";
import { showMarketplaceConfigPanel } from "../views/marketplace/marketplaceConfigPanel";
import { showPresensiConfigPanel } from "../views/presensi/presensiConfigPanel";
import { showSholatConfigPanel } from "../views/sholat/sholatConfigPanel";

export async function handleConfigButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;

  switch (customId) {
    case "config_welcome":
      await handleWelcomeConfig(interaction);
      break;
    case "config_points":
      await handlePointsConfig(interaction);
      break;
    case "config_moderation":
      await handleModerationConfig(interaction);
      break;
    case "config_marketplace":
      await handleMarketplaceConfig(interaction);
      break;
    case "config_presensi":
      await handlePresensiConfig(interaction);
      break;
    case "config_sholat":
      await handleSholatConfig(interaction);
      break;
    case "config_reset":
      await handleResetConfig(interaction);
      break;
    default:
      await interaction.reply({
        content: "❌ Unknown configuration option",
        flags: MessageFlags.Ephemeral,
      });
  }
}

async function handleWelcomeConfig(interaction: ButtonInteraction) {
  await showWelcomeConfigPanel(interaction);
}

async function handlePointsConfig(interaction: ButtonInteraction) {
  await showPointsConfigPanel(interaction);
}

async function handleModerationConfig(interaction: ButtonInteraction) {
  if (!interaction.guildId) return;
  await showModerationConfigPanel(interaction);
}

async function handleMarketplaceConfig(interaction: ButtonInteraction) {
  if (!interaction.guildId) return;
  await showMarketplaceConfigPanel(interaction);
}

async function handlePresensiConfig(interaction: ButtonInteraction) {
  if (!interaction.guildId) return;
  await showPresensiConfigPanel(interaction);
}

async function handleSholatConfig(interaction: ButtonInteraction) {
  if (!interaction.guildId) return;
  await showSholatConfigPanel(interaction);
}

async function handleResetConfig(interaction: ButtonInteraction) {
  const panel = createResetConfirmPanel();
  await interaction.update({
    embeds: [panel.embed],
    components: [panel.components[0] as any],
  });
}
