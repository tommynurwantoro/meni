import { ButtonInteraction, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder, UserSelectMenuInteraction } from "discord.js";
import { handleConfigButton } from "./configButtonHandler";
import { handleWelcomeButton } from "./welcomeButtonHandler";
import { handleModerationButton } from "./moderationButtonHandler";
import { handleMarketplaceButton } from "./marketplaceButtonHandler";
import { handleLinkProtectionButton } from "./linkProtectionButtonHandler";
import { handlePresensiButton } from "./presensiButtonHandler";
import { handleSholatButton } from "./sholatButtonHandler";
import { handlePointsButton } from "./pointsButtonHandler";
import {
  showMainConfigPanel,
  createResetSuccessPanel,
  createResetErrorPanel,
  showWelcomeConfigPanel,
  showMarketplaceConfigPanel,
} from "../views";
import { showModerationConfigPanel } from "../views/moderation/moderationConfigPanel";
import { handleReviewButton } from "./reviewButtonHandler";
import { showPresensiConfigPanel } from "../views/presensi/presensiConfigPanel";
import { showSholatConfigPanel } from "../views/sholat/sholatConfigPanel";
import { showPointsConfigPanel } from "../views/points/pointsConfigPanel";

export async function handleButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;

  if (customId.startsWith("config_")) {
    await handleConfigButton(interaction);
  } else if (customId.includes("_back")) {
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
  } else if (customId.startsWith("presensi_")) {
    await handlePresensiButton(interaction);
  } else if (customId.startsWith("sholat_")) {
    await handleSholatButton(interaction);
  } else if (customId.startsWith("points_")) {
    await handlePointsButton(interaction);
  } else if (customId === "reset_confirm") {
    await handleResetConfirm(interaction);
  } else if (customId === "reset_back_to_panel") {
    await showMainConfigPanel(interaction);
  }
}

async function handleBackButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;

  if (customId === "moderation_back") {
    await showModerationConfigPanel(interaction);
  }

  if (customId === "welcome_back") {
    await showWelcomeConfigPanel(interaction);
  }

  if (customId === "points_back") {
    await showPointsConfigPanel(interaction);
  }

  if (customId === "marketplace_back") {
    await showMarketplaceConfigPanel(interaction);
  }

  if (customId === "presensi_back") {
    await showPresensiConfigPanel(interaction);
  }

  if (customId === "sholat_back") {
    await showSholatConfigPanel(interaction);
  }

  if (customId === "main_back") {
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
        thanksChannel: "",
        enabled: false,
        marketplaceChannel: "",
      },
      moderation: {
        linkProtection: false,
        whitelistDomains: [],
        logsChannel: "",
      },
      presensi: {
        channel: "",
        role: "",
        enabled: false,
      },
      sholat: {
        channel: "",
        role: "",
        enabled: false,
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
