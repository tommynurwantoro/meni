import { ButtonInteraction } from "discord.js";
import { handleConfigButton } from "./configButtonHandler";
import { handlePointsButton } from "./pointsButtonHandler";
import { handleWelcomeButton } from "./welcomeButtonHandler";
import { handleModerationButton } from "./moderationButtonHandler";
import { handleMarketplaceButton } from "./marketplaceButtonHandler";
import { handleLinkProtectionButton } from "./linkProtectionButtonHandler";
import {
  showMainConfigPanel,
  createResetSuccessPanel,
  createResetErrorPanel,
  showWelcomeConfigPanel,
  showMarketplaceConfigPanel,
} from "../views";
import { showModerationConfigPanel } from "../views/moderation/moderationConfigPanel";
import { handleReviewButton } from "./reviewButtonHandler";

export async function handleButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;

  if (customId.startsWith("config_")) {
    await handleConfigButton(interaction);
  } else if (customId.includes("_back") || customId.includes("_cancel")) {
    await handleBackButton(interaction);
  } else if (customId.startsWith("welcome_")) {
    await handleWelcomeButton(interaction);
  } else if (customId.startsWith("points_")) {
    await handlePointsButton(interaction);
  } else if (customId.startsWith("moderation_")) {
    await handleModerationButton(interaction);
  } else if (
    customId.startsWith("marketplace_") ||
    customId.startsWith("stock_")
  ) {
    await handleMarketplaceButton(interaction);
  } else if (customId.startsWith("link_protection_")) {
    await handleLinkProtectionButton(interaction);
  } else if (customId.startsWith("review_")) {
    await handleReviewButton(interaction);
  } else if (customId === "reset_confirm") {
    await handleResetConfirm(interaction);
  } else if (customId === "reset_back_to_panel") {
    await showMainConfigPanel(interaction);
  }
}

async function handleBackButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;

  if (
    customId === "moderation_channel_back" ||
    customId === "link_protection_back"
  ) {
    await showModerationConfigPanel(interaction);
  }

  if (customId === "welcome_channel_back") {
    await showWelcomeConfigPanel(interaction);
  }

  if (customId === "marketplace_back") {
    await showMarketplaceConfigPanel(interaction);
  }

  if (
    customId === "welcome_back" ||
    customId === "points_back" ||
    customId === "moderation_back" ||
    customId === "reset_cancel" ||
    customId === "reset_back_to_panel" ||
    customId === "main_back"
  ) {
    // Return to main configuration panel
    await showMainConfigPanel(interaction);
  }
}

async function handleResetConfirm(interaction: ButtonInteraction) {
  const { ConfigManager } = await import("../utils/config");

  const guildId = interaction.guildId;
  if (!guildId) return;

  try {
    // Reset the configuration for this guild
    ConfigManager.updateGuildConfig(guildId, {
      welcome: {
        channel: "",
        message: "",
      },
      points: {
        logsChannel: "",
        marketplaceChannel: "",
      },
      moderation: {
        linkProtection: false,
        whitelistDomains: [],
        logsChannel: "",
      },
    });

    const panel = createResetSuccessPanel(interaction.user.id);
    await interaction.update({
      embeds: [panel.embed],
      components: [panel.components[0] as any],
    });
  } catch (error) {
    console.error("Error resetting configuration:", error);

    const panel = createResetErrorPanel();
    await interaction.update({
      embeds: [panel.embed],
      components: [panel.components[0] as any],
    });
  }
}
