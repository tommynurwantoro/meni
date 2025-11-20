import { 
  MessageFlags, 
  StringSelectMenuInteraction, 
  ActionRowBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
} from "discord.js";
import { redisManager } from "../../utils/redis";

/**
 * Handle thanks category selection
 */
export async function handleThanksCategorySelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const selectedCategory = interaction.values[0];
  const guildId = interaction.guildId;
  
  if (!guildId) {
    await interaction.reply({
      content: "❌ Guild not found.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Get stored user data from Redis
  const thanksData = await redisManager.getThanksData(interaction.user.id, guildId);
  if (!thanksData) {
    await interaction.reply({
      content: "❌ Thanks session expired. Please start over.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Update Redis data with selected category
  thanksData.selectedCategory = selectedCategory;
  await redisManager.storeThanksData(interaction.user.id, guildId, thanksData);

  // Get the selected user from guild members
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: "❌ Guild not found.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const selectedUser = await guild.members.fetch(thanksData.selectedUserId).catch(() => null);
  if (!selectedUser) {
    await interaction.reply({
      content: "❌ Selected user not found.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Create modal for reason input
  const modal = new ModalBuilder()
    .setCustomId("thanks_reason_modal")
    .setTitle("🙏 Add Thanks Reason");

  const reasonInput = new TextInputBuilder()
    .setCustomId("thanks_reason")
    .setLabel("Why are you thanking this person?")
    .setPlaceholder("Describe what they did that you're grateful for...")
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(10)
    .setMaxLength(500)
    .setRequired(true);

  const reasonActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);

  modal.addComponents(reasonActionRow);

  await interaction.showModal(modal);
}

