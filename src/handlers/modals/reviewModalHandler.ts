import { ModalSubmitInteraction, MessageFlags } from "discord.js";
import Review from "../../models/Review";
import { getReviewQueueData, updateReviewMessage } from "../../utils/reviewUtils";

/**
 * Handle done review modal submission
 */
export async function handleDoneReviewModal(
  interaction: ModalSubmitInteraction,
  messageId: string
): Promise<void> {
  const reviewNumber = interaction.fields.getTextInputValue("review_number");
  const num = parseInt(reviewNumber) - 1;

  if (isNaN(num) || num < 0) {
    await interaction.reply({
      content: "❌ Invalid review number.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guildId = interaction.guildId;
  if (!guildId) return;

  try {
    // Query pending reviews with proper error handling and optimization
    const reviews = await Review.findAll({
      where: {
        guild_id: guildId,
      },
      order: [["created_at", "ASC"]],
      // Performance optimization: only fetch required fields
      attributes: [
        "id",
        "title",
        "url",
        "reporter",
        "reviewer",
        "total_pending",
        "created_at",
      ],
      // Add reasonable limit to prevent memory issues
      limit: 30,
    });

    if (num >= reviews.length) {
      await interaction.reply({
        content: "❌ Review number out of range.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const review = reviews[num];

    if (!review.reviewer.includes(interaction.user.id)) {
      await interaction.reply({
        content: "❌ You are not a reviewer for this item.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    review.reviewer = review.reviewer.filter(
      (id) => id !== interaction.user.id
    );
    review.total_pending = review.reviewer.length;
    await review.save();

    if (review.total_pending === 0) {
      await review.destroy();
    }
    
    // send new message to reviewer
    if (interaction.channel && "send" in interaction.channel) {
    await interaction.channel?.send({
        content: `<@${review.reporter}> -- **[${review.title}](${review.url})** has been marked as done by <@${interaction.user.id}>`,
      });
    }

    // Get updated review queue data using centralized function
    const reviewData = await getReviewQueueData(guildId);

    // Send updated review message using centralized function
    await updateReviewMessage(guildId, interaction.channel, reviewData);

    await interaction.reply({
      content: "✅ Review marked as done!",
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("Error processing done review:", error);
    await interaction.reply({
      content: "❌ An error occurred while processing the review.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

