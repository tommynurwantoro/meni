import { StringSelectMenuInteraction, MessageFlags } from "discord.js";
import { handleThanksCategorySelect } from "./selects/thanksStringSelectHandler";
import { handleMarketplaceItemSelect } from "./selects/marketplaceStringSelectHandler";

/**
 * Main string select handler router
 * Routes string select menu interactions to domain-specific handlers
 */
export async function handleStringSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const customId = interaction.customId;

  switch (customId) {
    case "thanks_category_select":
      await handleThanksCategorySelect(interaction);
      break;
    case "marketplace_item_select":
      await handleMarketplaceItemSelect(interaction);
      break;
    default:
      await interaction.reply({
        content: "❌ Unknown string select interaction",
        flags: MessageFlags.Ephemeral,
      });
  }
}
