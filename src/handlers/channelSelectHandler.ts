import { ChannelSelectMenuInteraction, MessageFlags } from "discord.js";
import { handleWelcomeChannel } from "./selects/welcomeChannelSelectHandler";
import { handlePointsLogsChannel, handlePointsThanksChannel } from "./selects/pointsChannelSelectHandler";
import { handleModerationLogsChannel } from "./selects/moderationChannelSelectHandler";
import { handleMarketplaceChannel } from "./selects/marketplaceChannelSelectHandler";
import { handlePresensiChannel } from "./selects/presensiChannelSelectHandler";
import { handleSholatChannel } from "./selects/sholatChannelSelectHandler";

/**
 * Main channel select handler router
 * Routes channel selection interactions to domain-specific handlers
 */
export async function handleChannelSelect(
  interaction: ChannelSelectMenuInteraction
): Promise<void> {
  const customId = interaction.customId;

  switch (customId) {
    case "welcome_channel":
      await handleWelcomeChannel(interaction);
      break;
    case "points_logs_channel":
      await handlePointsLogsChannel(interaction);
      break;
    case "points_thanks_channel":
      await handlePointsThanksChannel(interaction);
      break;
    case "moderation_channel":
      await handleModerationLogsChannel(interaction);
      break;
    case "marketplace_channel":
      await handleMarketplaceChannel(interaction);
      break;
    case "presensi_channel":
      await handlePresensiChannel(interaction);
      break;
    case "sholat_channel":
      await handleSholatChannel(interaction);
      break;
    default:
      await interaction.reply({
        content: "❌ Unknown channel selection",
        flags: MessageFlags.Ephemeral,
      });
  }
}
