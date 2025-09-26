import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import Review from "../models/Review";

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
    const reviews = await Review.findAll({
      where: {
        guild_id: interaction.guildId,
      },
      order: [["created_at", "ASC"]],
    });

    // Collect all unique reviewer IDs for notifications
    const reviewerIds = [
      ...new Set(reviews.flatMap((review) => review.reviewer)),
    ];
    const reviewerMentions =
      reviewerIds.length > 0
        ? reviewerIds.map((id) => `<@${id}>`).join(" ")
        : "";

    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle("📋 Antrian Review")
      .setDescription(
        "Reviewers can use command `/titip_review` or use button below to update the review status. Here is the queue:"
      )
      .addFields({
        name: reviews.length > 0 ? "Need Review" : "No reviews in queue",
        value:
          reviews.length > 0
            ? reviews
                .map(
                  (review, index) =>
                    `${index + 1}. **[${review.title}](${review.url})** by <@${
                      review.reporter
                    }>\n\tReviewers: ${review.reviewer
                      .map((id) => `<@${id}>`)
                      .join(", ")} (${review.total_pending} pending)`
                )
                .join("\n")
            : "",
        inline: false,
      })
      .setFooter({
        text: "Powered by BULLSTER",
      })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId("review_done")
      .setLabel("Done Review")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Primary);

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      button
    );

    await interaction.reply({
      content: reviewerMentions,
      embeds: [embed],
      components: [actionRow],
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    await interaction.reply({
      content: "❌ An error occurred while fetching the review queue.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
