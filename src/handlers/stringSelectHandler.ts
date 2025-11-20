import { 
  MessageFlags, 
  StringSelectMenuInteraction, 
  ActionRowBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  EmbedBuilder,
} from "discord.js";
import { redisManager } from "../utils/redis";
import { processPurchase } from "../utils/marketplaceUtils";
import { createMarketplaceUserPanel } from "../views/marketplace/marketplaceUserPanel";

export async function handleStringSelect(interaction: StringSelectMenuInteraction) {
  const customId = interaction.customId;

  if (customId === "thanks_category_select") {
    await handleThanksCategorySelect(interaction);
  } else if (customId === "marketplace_item_select") {
    await handleMarketplaceItemSelect(interaction);
  }
}

async function handleThanksCategorySelect(interaction: StringSelectMenuInteraction) {
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

async function handleMarketplaceItemSelect(interaction: StringSelectMenuInteraction) {
  const guildId = interaction.guildId;
  
  if (!guildId) {
    await interaction.reply({
      content: "❌ Guild not found.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const itemIndex = parseInt(interaction.values[0]);
  
  try {
    // Defer the reply since purchase processing might take time
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Process the purchase with validation
    const result = await processPurchase(
      interaction.user.id,
      guildId,
      itemIndex,
      interaction.client
    );

    if (!result.success) {
      // Purchase failed - show error message
      await interaction.editReply({
        content: result.message,
      });
      return;
    }

    // Purchase successful - update the marketplace panel
    const panel = createMarketplaceUserPanel(guildId);
    if (panel) {
      await interaction.message.edit({
        embeds: [panel.embed],
        components: panel.components as any[],
      });
    }

    // Send success message with purchase details
    const successEmbed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🎉 Purchase Successful!')
      .setDescription(result.message)
      .addFields(
        {
          name: '📦 Item',
          value: result.itemName || 'N/A',
          inline: true
        },
        {
          name: '💰 Price',
          value: `${result.price || 0} points`,
          inline: true
        },
        {
          name: '💎 New Balance',
          value: `${result.newBalance || 0} points`,
          inline: true
        }
      )
      .setFooter({ text: 'Thank you for your purchase!' })
      .setTimestamp();

    await interaction.editReply({
      embeds: [successEmbed],
    });

  } catch (error) {
    console.error('Error handling marketplace item selection:', error);
    await interaction.editReply({
      content: '❌ An error occurred while processing your purchase. Please try again.',
    });
  }
}
