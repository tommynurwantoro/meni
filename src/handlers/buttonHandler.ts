import { ButtonInteraction } from "discord.js";
import { handleConfigButton, handleResetConfirm } from "./buttons/configButtonHandler";
import { handleWelcomeButton } from "./buttons/welcomeButtonHandler";
import { handleModerationButton } from "./buttons/moderationButtonHandler";
import { handleMarketplaceButton } from "./buttons/marketplaceButtonHandler";
import { handleLinkProtectionButton } from "./buttons/linkProtectionButtonHandler";
import { handlePresensiButton } from "./buttons/presensiButtonHandler";
import { handleSholatButton } from "./buttons/sholatButtonHandler";
import { handlePointsButton } from "./buttons/pointsButtonHandler";
import { handleReviewButton } from "./buttons/reviewButtonHandler";
import { handleBackButton } from "./buttons/navigationButtonHandler";
import { showMainConfigPanel } from "../views";

/**
 * Main button handler router
 * Routes button interactions to domain-specific handlers
 */
export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;
  console.log("Custom ID: ", customId);

  // Configuration buttons
  if (customId.startsWith("config_")) {
    await handleConfigButton(interaction);
    return;
  }

  // Navigation buttons (back buttons)
  if (customId.includes("_back") || customId === "main_back") {
    await handleBackButton(interaction);
    return;
  }

  // Reset confirmation
  if (customId === "reset_confirm") {
    await handleResetConfirm(interaction);
    return;
  }

  // Reset back to panel (alias for main_back)
  if (customId === "reset_back_to_panel") {
    await showMainConfigPanel(interaction);
    return;
  }

  // Domain-specific button handlers
  if (customId.startsWith("welcome_")) {
    await handleWelcomeButton(interaction);
    return;
  }

  if (customId.startsWith("points_")) {
    console.log("Handling points button");
    await handlePointsButton(interaction);
    return;
  }

  if (customId.startsWith("moderation_")) {
    await handleModerationButton(interaction);
    return;
  }

  if (customId.startsWith("marketplace_") || customId.startsWith("stock_")) {
    await handleMarketplaceButton(interaction);
    return;
  }

  if (customId.startsWith("link_protection_")) {
    await handleLinkProtectionButton(interaction);
    return;
  }

  if (customId.startsWith("review_")) {
    await handleReviewButton(interaction);
    return;
  }

  if (customId.startsWith("presensi_")) {
    await handlePresensiButton(interaction);
    return;
  }

  if (customId.startsWith("sholat_")) {
    await handleSholatButton(interaction);
    return;
  }
}
