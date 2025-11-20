import { StringSelectMenuInteraction, MessageFlags } from "discord.js";
import { handleThanksCategorySelect } from "./selects/thanksStringSelectHandler";
import { handleMarketplaceItemSelect } from "./selects/marketplaceStringSelectHandler";

/**
 * Main string select handler router
 * Routes string select menu interactions to domain-specific handlers
 */
export async function handleStringSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const customId = interaction.customId;

  // Deploy-related selects are handled by collectors in deploy.ts
  // Skip them here to allow collectors to handle them
  if (customId === "tags_service_select" || 
      customId === "create_tag_service_select" || 
      customId === "stack_select") {
    return; // Let collectors handle these
  }

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
