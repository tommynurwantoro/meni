import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import Review from "../models/Review";
import { ConfigManager } from "./config";

export interface ReviewQueueData {
  reviews: Review[];
  reviewerMentions: string;
  embed: EmbedBuilder;
  actionRow: ActionRowBuilder<ButtonBuilder>;
}

/**
 * Fetches reviews for a guild and creates the review queue data
 */
export async function getReviewQueueData(guildId: string): Promise<ReviewQueueData> {
  // Fetch all reviews for the guild
  const reviews = await Review.findAll({
    where: {
      guild_id: guildId,
    },
    order: [["created_at", "ASC"]],
    limit: 30,
  });

  // Collect all unique reviewer IDs for notifications
  const reviewerIds = [
    ...new Set(reviews.flatMap((review) => review.reviewer)),
  ];
  const reviewerMentions =
    reviewerIds.length > 0
      ? reviewerIds.map((id) => `<@${id}>`).join(" ")
      : "";

  // Create queue text
  const queue = reviews.length > 0
    ? reviews
        .map(
          (review, index) =>
            `${index + 1}. **[${review.title}](${review.url})** by <@${
              review.reporter
            }>\n\tReviewers: ${review.reviewer
              .map((id) => `<@${id}>`)
              .join(", ")} (${review.total_pending} pending)\n`
        )
        .join("\n")
    : "";

  // Create description
  const description = reviews.length > 0 
    ? "Reviewers can use command `/titip_review` to add new review or use button below to update the review status.\n\n**Need Review**\n" + queue 
    : "No reviews in queue. Use command `/titip_review` to add new review";

  // Create embed
  const embed = new EmbedBuilder()
    .setColor("#00ff00")
    .setTitle("📋 Antrian Review")
    .setDescription(description)
    .setFooter({
      text: "Powered by MENI",
    })
    .setTimestamp();

  // Create button
  const button = new ButtonBuilder()
    .setCustomId("review_done")
    .setLabel("Done Review")
    .setEmoji("✅")
    .setStyle(ButtonStyle.Primary);

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  return {
    reviews,
    reviewerMentions,
    embed,
    actionRow,
  };
}

/**
 * Deletes the last review message if it exists
 */
export async function deleteLastReviewMessage(
  guildId: string,
  client: any
): Promise<void> {
  const guildConfig = ConfigManager.getGuildConfig(guildId);
  const lastMessageId = guildConfig?.titipReview?.lastMessageId;
  const lastChannelId = guildConfig?.titipReview?.lastChannelId;

  if (lastMessageId && lastChannelId) {
    try {
      const lastChannel = await client.channels.fetch(lastChannelId);
      if (lastChannel && "messages" in lastChannel && lastChannel.messages) {
        const lastMessage = await lastChannel.messages.fetch(lastMessageId);
        if (lastMessage) {
          await lastMessage.delete();
        }
      }
    } catch (error) {
      console.log("Could not delete last message:", error);
      // Continue even if deletion fails
    }
  }
}

/**
 * Sends a new review message and updates the config
 */
export async function sendReviewMessage(
  guildId: string,
  channel: any,
  reviewData: ReviewQueueData
): Promise<void> {
  if (channel && "send" in channel) {
    const message = await channel.send({
      content: reviewData.reviewerMentions.length > 0 ? "Need review from: " + reviewData.reviewerMentions : "",
      embeds: [reviewData.embed],
      components: [reviewData.actionRow],
    });

    // Update lastMessageId and lastChannelId in config
    ConfigManager.updateGuildConfig(guildId, {
      titipReview: {
        lastMessageId: message.id,
        lastChannelId: message.channelId,
      },
    });
  }
}

/**
 * Updates the review message in the same channel and updates config
 */
export async function updateReviewMessage(
  guildId: string,
  channel: any,
  reviewData: ReviewQueueData
): Promise<void> {
  // Delete old message first
  await deleteLastReviewMessage(guildId, channel.client);
  
  // Send new message
  await sendReviewMessage(guildId, channel, reviewData);
}
