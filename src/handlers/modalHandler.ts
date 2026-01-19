import { ModalSubmitInteraction, MessageFlags } from "discord.js";
import { handleGitLabTokenModal, handleCreateTagModal } from "./modals/deployModalHandler";
import { handleAddStockModal, handleUpdateStockModal, handleRemoveStockModal } from "./modals/marketplaceModalHandler";
import { handleLinkProtectionWhitelistModal } from "./modals/moderationModalHandler";
import { handleDoneReviewModal } from "./modals/reviewModalHandler";
import { handleWelcomeMessageModal, handleThanksReasonModal } from "./modals/generalModalHandler";
import { handleAttendanceRemarksModal } from "./modals/attendanceModalHandler";

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

  // Modals with message ID or guild ID (format: modalType:id)
  if (customId.includes(":")) {
    const [modalType, id] = customId.split(":");

    switch (modalType) {
      case "stock_add_modal":
        await handleAddStockModal(interaction, id);
        break;
      case "stock_update_modal":
        await handleUpdateStockModal(interaction, id);
        break;
      case "stock_remove_modal":
        await handleRemoveStockModal(interaction, id);
        break;
      case "link_protection_whitelist_modal":
        await handleLinkProtectionWhitelistModal(interaction, id);
        break;
      case "done_review_modal":
        await handleDoneReviewModal(interaction, id);
        break;
      case "attendance_remarks_modal":
        await handleAttendanceRemarksModal(interaction);
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
