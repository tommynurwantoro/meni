import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { getReviewQueueData, updateReviewMessage } from "../utils/reviewUtils";

export const data = new SlashCommandBuilder()
  .setName("antrian_review")
  .setDescription("Show all pending reviews in the queue");

export const cooldown = 5;

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "❌ This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    // Get review queue data using centralized function
    const reviewData = await getReviewQueueData(interaction.guildId);

    // Update review message using centralized function
    await updateReviewMessage(interaction.guildId, interaction.channel, reviewData);

    // Send ephemeral success message to user
    await interaction.reply({
      content: "✅ Review queue updated successfully!",
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    await interaction.reply({
      content: "❌ An error occurred while fetching the review queue.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
