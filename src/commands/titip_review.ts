import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import Review from "../models/Review";
import { getReviewQueueData, updateReviewMessage } from "../utils/reviewUtils";

export const data = new SlashCommandBuilder()
  .setName("titip_review")
  .setDescription("Add a new item to the review queue")
  .addStringOption((option) =>
    option
      .setName("title")
      .setDescription("Title of the item to be reviewed")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("url")
      .setDescription("URL of the item to be reviewed")
      .setRequired(true)
  )
  .addUserOption((option) =>
    option
      .setName("reviewer_1")
      .setDescription("First reviewer")
      .setRequired(true)
  )
  .addUserOption((option) =>
    option
      .setName("reviewer_2")
      .setDescription("Second reviewer")
      .setRequired(false)
  )
  .addUserOption((option) =>
    option
      .setName("reviewer_3")
      .setDescription("Third reviewer")
      .setRequired(false)
  )
  .addUserOption((option) =>
    option
      .setName("reviewer_4")
      .setDescription("Fourth reviewer")
      .setRequired(false)
  )
  .addUserOption((option) =>
    option
      .setName("reviewer_5")
      .setDescription("Fifth reviewer")
      .setRequired(false)
  );

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
    // Get parameters
    const title = interaction.options.getString("title", true);
    const url = interaction.options.getString("url", true);
    const reviewer1 = interaction.options.getUser("reviewer_1", true);
    const reviewer2 = interaction.options.getUser("reviewer_2");
    const reviewer3 = interaction.options.getUser("reviewer_3");
    const reviewer4 = interaction.options.getUser("reviewer_4");
    const reviewer5 = interaction.options.getUser("reviewer_5");

    // Collect all reviewers
    const reviewers = [
      reviewer1.id,
      reviewer2?.id,
      reviewer3?.id,
      reviewer4?.id,
      reviewer5?.id,
    ].filter(Boolean) as string[];

    // Create new review
    const newReview = Review.build({
      guild_id: interaction.guildId,
      reporter: interaction.user.id,
      title,
      url,
      reviewer: reviewers,
      total_pending: reviewers.length,
    } as any);
    await newReview.save();

    // Get review queue data using centralized function
    const reviewData = await getReviewQueueData(interaction.guildId);

    // Update review message using centralized function
    await updateReviewMessage(interaction.guildId, interaction.channel, reviewData);

    // Send ephemeral success message to user
    await interaction.reply({
      content: `✅ Successfully added **${title}** to the review queue!`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("Error adding review:", error);
    await interaction.reply({
      content: "❌ An error occurred while adding the review to the queue.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
