import { UserSelectMenuInteraction, MessageFlags } from "discord.js";
import { handleThanksUserSelect } from "./selects/thanksUserSelectHandler";

/**
 * Main user select handler router
 * Routes user select menu interactions to domain-specific handlers
 */
export async function handleUserSelect(interaction: UserSelectMenuInteraction): Promise<void> {
  const customId = interaction.customId;

  switch (customId) {
    case "thanks_user_select":
      await handleThanksUserSelect(interaction);
      break;
    default:
      await interaction.reply({
        content: "❌ Unknown user select interaction",
        flags: MessageFlags.Ephemeral,
      });
  }
}
