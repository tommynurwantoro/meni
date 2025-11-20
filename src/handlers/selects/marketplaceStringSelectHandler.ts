import { 
  MessageFlags, 
  StringSelectMenuInteraction, 
  EmbedBuilder,
} from "discord.js";
import { processPurchase } from "../../utils/marketplaceUtils";
import { createMarketplaceUserPanel } from "../../views/marketplace/marketplaceUserPanel";

/**
 * Handle marketplace item selection
 */
export async function handleMarketplaceItemSelect(interaction: StringSelectMenuInteraction): Promise<void> {
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

