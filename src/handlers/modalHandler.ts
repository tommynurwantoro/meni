import { ModalSubmitInteraction, MessageFlags } from "discord.js";
import { handleGitLabTokenModal, handleCreateTagModal } from "./modals/deployModalHandler";
import { handleAddStockModal, handleUpdateStockModal, handleRemoveStockModal } from "./modals/marketplaceModalHandler";
import { handleLinkProtectionWhitelistModal } from "./modals/moderationModalHandler";
import { handleDoneReviewModal } from "./modals/reviewModalHandler";
import { handleWelcomeMessageModal, handleThanksReasonModal } from "./modals/generalModalHandler";

/**
 * Main modal handler router
 * Routes modal submissions to domain-specific handlers
 */
export async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  const customId = interaction.customId;

  // Deploy-related modals
  if (customId.startsWith("gitlab_token_modal_")) {
    await handleGitLabTokenModal(interaction);
    return;
  }

  if (customId.startsWith("create_tag_modal_")) {
    await handleCreateTagModal(interaction);
    return;
  }

  // Modals with message ID (format: modalType:messageId)
  if (customId.includes(":")) {
    const [modalType, messageId] = customId.split(":");

    switch (modalType) {
      case "stock_add_modal":
        await handleAddStockModal(interaction, messageId);
        break;
      case "stock_update_modal":
        await handleUpdateStockModal(interaction, messageId);
        break;
      case "stock_remove_modal":
        await handleRemoveStockModal(interaction, messageId);
        break;
      case "link_protection_whitelist_modal":
        await handleLinkProtectionWhitelistModal(interaction, messageId);
        break;
      case "done_review_modal":
        await handleDoneReviewModal(interaction, messageId);
        break;
      default:
        await interaction.reply({
          content: "❌ Unknown modal submission",
          flags: MessageFlags.Ephemeral,
        });
    }
    return;
  }

  // Simple modals without message ID
  switch (customId) {
    case "welcome_message_modal":
      await handleWelcomeMessageModal(interaction);
      break;
    case "thanks_reason_modal":
      await handleThanksReasonModal(interaction);
      break;
    default:
      await interaction.reply({
        content: "❌ Unknown modal submission",
        flags: MessageFlags.Ephemeral,
      });
  }
}
