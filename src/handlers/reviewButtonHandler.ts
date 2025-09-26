import {
  ActionRowBuilder,
  ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { Op } from "sequelize";
import Review from "../models/Review";

export async function handleReviewButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;

  switch (customId) {
    case "review_done":
      await handleDoneReviewButton(interaction);
      break;
    default:
      await interaction.reply({
        content: "❌ Unknown titip review option",
        flags: MessageFlags.Ephemeral,
      });
  }
}

export async function handleDoneReviewButton(interaction: ButtonInteraction) {
  const messageId = interaction.message.id;

  const modal = new ModalBuilder()
    .setCustomId(`done_review_modal:${messageId}`)
    .setTitle("Mark Review as Done")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("review_number")
          .setLabel("Enter the review number (1, 2, 3, ...)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}
