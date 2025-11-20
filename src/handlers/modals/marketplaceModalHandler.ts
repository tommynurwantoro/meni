import { ModalSubmitInteraction, MessageFlags } from "discord.js";
import { showMarketplaceStockPanel } from "../../views/marketplace/marketplaceStockPanel";

/**
 * Handle add stock modal submission
 */
export async function handleAddStockModal(
  interaction: ModalSubmitInteraction,
  messageId: string
): Promise<void> {
  const { ConfigManager } = await import("../../utils/config");

  const stockName = interaction.fields.getTextInputValue("stock_name");
  const descriptionInput =
    interaction.fields.getTextInputValue("stock_description");
  const priceInput = interaction.fields.getTextInputValue("stock_price");
  const quantityInput = interaction.fields.getTextInputValue("stock_quantity");
  const guildId = interaction.guildId;
  if (!guildId) return;

  try {
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    const stockConfig = currentConfig.points?.marketplace?.stock || [];

    // Check if stock with the same name already exists (case-insensitive)
    const stockExists = stockConfig.some(
      (stock) =>
        stock.name.trim().toLowerCase() === stockName.trim().toLowerCase()
    );

    if (stockExists) {
      await interaction.reply({
        content: `❌ A stock item with the name **${stockName}** already exists. Please choose a different name.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      points: {
        ...currentConfig.points,
        marketplace: {
          ...currentConfig.points?.marketplace,
          stock: [
            ...stockConfig,
            {
              name: stockName,
              description: descriptionInput,
              price: Number(priceInput),
              quantity: Number(quantityInput),
              addedBy: interaction.user.id,
              addedAt: new Date().toISOString(),
            },
          ],
        },
      },
    });

    // Try to refresh the original embed using the message ID
    try {
      const channel = interaction.channel;
      if (channel && channel.isTextBased()) {
        const message = await channel.messages.fetch(messageId);
        if (message) {
          // Refresh the marketplace stock panel in the original message
          const { createMarketplaceStockPanel } = await import(
            "../../views/marketplace/marketplaceStockPanel"
          );
          const panel = createMarketplaceStockPanel(guildId);

          await message.edit({
            embeds: [panel.embed],
            components: [
              panel.components[0] as any,
              panel.components[1] as any,
            ],
          });

          // Acknowledge the modal submission
          await interaction.reply({
            content:
              "✅ Stock item added successfully! The panel has been updated.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }
    } catch (fetchError) {
      console.log(
        "Could not fetch original message, falling back to new panel"
      );
    }

    // Fallback: Show new panel if original message can't be updated
    const additionalMessage = `
        > ===========================
        > ✅ Successfully added new stock item!
        > ===========================`;
    await showMarketplaceStockPanel(interaction, additionalMessage);
  } catch (error) {
    console.error("Error configuring stock:", error);

    await interaction.reply({
      content: "❌ Failed to configure stock. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handle update stock modal submission
 */
export async function handleUpdateStockModal(
  interaction: ModalSubmitInteraction,
  messageId: string
): Promise<void> {
  const { ConfigManager } = await import("../../utils/config");

  const stockName = interaction.fields.getTextInputValue("stock_name");
  const descriptionInput =
    interaction.fields.getTextInputValue("stock_description");
  const priceInput = interaction.fields.getTextInputValue("stock_price");
  const quantityInput = interaction.fields.getTextInputValue("stock_quantity");
  const guildId = interaction.guildId;
  if (!guildId) return;

  try {
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    const stockConfig = currentConfig.points?.marketplace?.stock || [];
    let stockFound = false;

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      points: {
        ...currentConfig.points,
        marketplace: {
          ...currentConfig.points?.marketplace,
          stock: stockConfig.map((stock) => {
            if (stock.name.toLowerCase() === stockName.toLowerCase()) {
              stockFound = true;
              // Only update fields if the input is not an empty string
              return {
                ...stock,
                name: stockName, // Always update name, since it's the identifier
                description:
                  descriptionInput !== ""
                    ? descriptionInput
                    : stock.description,
                price: priceInput !== "" ? Number(priceInput) : stock.price,
                quantity:
                  quantityInput !== "" ? Number(quantityInput) : stock.quantity,
              };
            }
            return stock;
          }),
        },
      },
    });

    if (stockFound) {
      // Try to refresh the original embed using the message ID
      try {
        const channel = interaction.channel;
        if (channel && channel.isTextBased()) {
          const message = await channel.messages.fetch(messageId);
          if (message) {
            // Refresh the marketplace stock panel in the original message
            const { createMarketplaceStockPanel } = await import(
              "../../views/marketplace/marketplaceStockPanel"
            );
            const panel = createMarketplaceStockPanel(guildId);

            await message.edit({
              embeds: [panel.embed],
              components: [
                panel.components[0] as any,
                panel.components[1] as any,
              ],
            });

            // Acknowledge the modal submission
            await interaction.reply({
              content:
                "✅ Stock item updated successfully! The panel has been updated.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        }
      } catch (fetchError) {
        console.log(
          "Could not fetch original message, falling back to new panel"
        );
      }

      // Fallback: Show new panel if original message can't be updated
      const additionalMessage = `
            > ===========================
            > ✅ Successfully updated stock item!
            > ===========================`;
      await showMarketplaceStockPanel(interaction, additionalMessage);
    } else {
      await interaction.reply({
        content: "❌ Stock not found. Please check the name and try again.",
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    console.error("Error configuring stock:", error);

    await interaction.reply({
      content: "❌ Failed to configure stock. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handle remove stock modal submission
 */
export async function handleRemoveStockModal(
  interaction: ModalSubmitInteraction,
  messageId: string
): Promise<void> {
  const { ConfigManager } = await import("../../utils/config");

  const stockName = interaction.fields.getTextInputValue("stock_name");
  const guildId = interaction.guildId;
  if (!guildId) return;

  try {
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    const stockConfig = currentConfig.points?.marketplace?.stock || [];
    const stockIndex = stockConfig.findIndex(
      (stock) => stock.name.toLowerCase() === stockName.toLowerCase()
    );

    if (stockIndex !== -1) {
      const updatedStock = [...stockConfig];
      updatedStock.splice(stockIndex, 1);

      ConfigManager.updateGuildConfig(guildId, {
        ...currentConfig,
        points: {
          ...currentConfig.points,
          marketplace: {
            ...currentConfig.points?.marketplace,
            stock: updatedStock,
          },
        },
      });

      // Try to refresh the original embed using the message ID
      try {
        const channel = interaction.channel;
        if (channel && channel.isTextBased()) {
          const message = await channel.messages.fetch(messageId);
          if (message) {
            // Refresh the marketplace stock panel in the original message
            const { createMarketplaceStockPanel } = await import(
              "../../views/marketplace/marketplaceStockPanel"
            );
            const panel = createMarketplaceStockPanel(guildId);

            await message.edit({
              embeds: [panel.embed],
              components: [
                panel.components[0] as any,
                panel.components[1] as any,
              ],
            });

            // Acknowledge the modal submission
            await interaction.reply({
              content:
                "✅ Stock item removed successfully! The panel has been updated.",
              flags: MessageFlags.Ephemeral,
            });

            return;
          }
        }
      } catch (fetchError) {
        console.log(
          "Could not fetch original message, falling back to new panel"
        );
      }

      // Fallback: Show new panel if original message can't be updated
      const additionalMessage = `
            > ===========================
            > ✅ Successfully removed stock item!
            > ===========================`;
      await showMarketplaceStockPanel(interaction, additionalMessage);
    } else {
      await interaction.reply({
        content: "❌ Stock not found. Please check the name and try again.",
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    console.error("Error removing stock:", error);

    await interaction.reply({
      content: "❌ Failed to remove stock. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

