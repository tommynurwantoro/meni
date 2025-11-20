import { ButtonInteraction } from "discord.js";
import { showMainConfigPanel } from "../../views";
import { showModerationConfigPanel } from "../../views/moderation/moderationConfigPanel";
import { showWelcomeConfigPanel } from "../../views";
import { showPointsConfigPanel } from "../../views/points/pointsConfigPanel";
import { showMarketplaceConfigPanel } from "../../views";
import { showPresensiConfigPanel } from "../../views/presensi/presensiConfigPanel";
import { showSholatConfigPanel } from "../../views/sholat/sholatConfigPanel";

/**
 * Handle back button navigation
 */
export async function handleBackButton(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;

  switch (customId) {
    case "moderation_back":
      await showModerationConfigPanel(interaction);
      break;
    case "welcome_back":
      await showWelcomeConfigPanel(interaction);
      break;
    case "points_back":
      await showPointsConfigPanel(interaction);
      break;
    case "marketplace_back":
      await showMarketplaceConfigPanel(interaction);
      break;
    case "presensi_back":
      await showPresensiConfigPanel(interaction);
      break;
    case "sholat_back":
      await showSholatConfigPanel(interaction);
      break;
    case "main_back":
      await showMainConfigPanel(interaction);
      break;
    default:
      // Unknown back button, try to go to main panel as fallback
      await showMainConfigPanel(interaction);
  }
}

