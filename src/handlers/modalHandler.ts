import { ModalSubmitInteraction, MessageFlags, EmbedBuilder } from "discord.js";
import Review from "../models/Review";
import { showMarketplaceStockPanel } from "../views/marketplace/marketplaceStockPanel";
import { createLinkProtectionPanel } from "../views/moderation/linkProtectionPanel";
import { getReviewQueueData, updateReviewMessage } from "../utils/reviewUtils";
import { addPoints, notifyThanksMessage } from "../utils/pointsUtils";
import { PointsTransaction } from "../models/PointsTransaction";
import { redisManager } from "../utils/redis";

export async function handleModal(interaction: ModalSubmitInteraction) {
  const customId = interaction.customId;

  // Check if customId contains a message ID (format: modalType:messageId)
  if (customId.includes(":")) {
    const [modalType, messageId] = customId.split(":");

    switch (modalType) {
      case "stock_add_modal":
        await handleAddStockModal(interaction, messageId);
        break;
      case "stock_update_modal":
        await handleUpdateStockModal(interaction, messageId);
        break;
      case "stock_remove_modal":
        await handleRemoveStockModal(interaction, messageId);
        break;
      case "link_protection_whitelist_modal":
        await handleLinkProtectionWhitelistModal(interaction, messageId);
        break;
      case "done_review_modal":
        await handleDoneReviewModal(interaction, messageId);
        break;
      default:
        await interaction.reply({
          content: "❌ Unknown modal submission",
          flags: MessageFlags.Ephemeral,
        });
    }
    return;
  }

  switch (customId) {
    case "welcome_message_modal":
      await handleWelcomeMessageModal(interaction);
      break;
    case "thanks_reason_modal":
      await handleThanksReasonModal(interaction);
      break;
    default:
      await interaction.reply({
        content: "❌ Unknown modal submission",
        flags: MessageFlags.Ephemeral,
      });
  }
}

async function handleWelcomeMessageModal(interaction: ModalSubmitInteraction) {
  const { ConfigManager } = await import("../utils/config");

  const messageInput = interaction.fields.getTextInputValue(
    "welcome_message_input"
  );
  const guildId = interaction.guildId;
  if (!guildId) return;

  try {
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    const welcomeConfig = currentConfig.welcome || {};

    // Update configuration with both channel and message
    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      welcome: {
        ...welcomeConfig,
        message: messageInput,
      },
    });

    // Show simple success message
    await interaction.reply({
      content: `✅ Successfully updated welcome message!`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("Error configuring welcome system:", error);

    await interaction.reply({
      content:
        "❌ Failed to configure welcome system. Please check bot permissions and try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleLinkProtectionWhitelistModal(
  interaction: ModalSubmitInteraction,
  messageId: string
) {
  const { ConfigManager } = await import("../utils/config");

  const domainsInput =
    interaction.fields.getTextInputValue("whitelist_domains");
  const descriptionInput = interaction.fields.getTextInputValue(
    "whitelist_description"
  );
  const guildId = interaction.guildId;
  if (!guildId) return;

  try {
    // Parse domains input (split by comma and clean up)
    const domains = domainsInput
      .split(",")
      .map((domain) => domain.trim())
      .filter((domain) => domain.length > 0)
      .map((domain) => domain.toLowerCase());

    // Update configuration with whitelist domains
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    const moderationConfig = currentConfig.moderation || {};

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      moderation: {
        ...moderationConfig,
        whitelistDomains: domains,
        linkProtection: true,
      },
    });

    const channel = interaction.channel;

    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(messageId);
      if (message) {
        const panel = createLinkProtectionPanel(guildId);
        await message.edit({
          embeds: [panel.embed],
          components: [panel.components[0] as any, panel.components[1] as any],
        });
        await interaction.reply({
          content: "✅ Link protection whitelist updated!",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } catch (error) {
    console.error("Error configuring link protection whitelist:", error);

    await interaction.reply({
      content: "❌ Failed to configure whitelist. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleAddStockModal(
  interaction: ModalSubmitInteraction,
  messageId: string
) {
  const { ConfigManager } = await import("../utils/config");

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
            "../views/marketplace/marketplaceStockPanel"
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

async function handleUpdateStockModal(
  interaction: ModalSubmitInteraction,
  messageId: string
) {
  const { ConfigManager } = await import("../utils/config");

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
              "../views/marketplace/marketplaceStockPanel"
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

async function handleRemoveStockModal(
  interaction: ModalSubmitInteraction,
  messageId: string
) {
  const { ConfigManager } = await import("../utils/config");

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
              "../views/marketplace/marketplaceStockPanel"
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

async function handleDoneReviewModal(
  interaction: ModalSubmitInteraction,
  messageId: string
) {
  const reviewNumber = interaction.fields.getTextInputValue("review_number");
  const num = parseInt(reviewNumber) - 1;

  if (isNaN(num) || num < 0) {
    await interaction.reply({
      content: "❌ Invalid review number.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guildId = interaction.guildId;
  if (!guildId) return;

  try {
    // Query pending reviews with proper error handling and optimization
    const reviews = await Review.findAll({
      where: {
        guild_id: guildId,
      },
      order: [["created_at", "ASC"]],
      // Performance optimization: only fetch required fields
      attributes: [
        "id",
        "title",
        "url",
        "reporter",
        "reviewer",
        "total_pending",
        "created_at",
      ],
      // Add reasonable limit to prevent memory issues
      limit: 30,
    });

    if (num >= reviews.length) {
      await interaction.reply({
        content: "❌ Review number out of range.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const review = reviews[num];

    if (!review.reviewer.includes(interaction.user.id)) {
      await interaction.reply({
        content: "❌ You are not a reviewer for this item.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    review.reviewer = review.reviewer.filter(
      (id) => id !== interaction.user.id
    );
    review.total_pending = review.reviewer.length;
    await review.save();

    if (review.total_pending === 0) {
      await review.destroy();
    }
    
    // send new message to reviewer
    if (interaction.channel && "send" in interaction.channel) {
    await interaction.channel?.send({
        content: `<@${review.reporter}> -- **[${review.title}](${review.url})** has been marked as done by <@${interaction.user.id}>`,
      });
    }

    // Get updated review queue data using centralized function
    const reviewData = await getReviewQueueData(guildId);

    // Send updated review message using centralized function
    await updateReviewMessage(guildId, interaction.channel, reviewData);

    await interaction.reply({
      content: "✅ Review marked as done!",
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("Error processing done review:", error);
    await interaction.reply({
      content: "❌ An error occurred while processing the review.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleThanksReasonModal(interaction: ModalSubmitInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  // Get stored user data from Redis
  const thanksData = await redisManager.getThanksData(
    interaction.user.id,
    guildId
  );
  if (!thanksData) {
    await interaction.reply({
      content: "❌ Thanks session expired. Please start over.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const reason = interaction.fields.getTextInputValue("thanks_reason");

  // Get the selected user
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: "❌ Guild not found.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const selectedUser = await guild.members
    .fetch(thanksData.selectedUserId)
    .catch(() => null);
  if (!selectedUser) {
    await interaction.reply({
      content: "❌ Selected user not found.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    // Check weekly thanks limits
    const weeklyStats = await redisManager.getWeeklyThanksStats(
      interaction.user.id,
      guildId
    );

    if (weeklyStats.thanksRemaining <= 0) {
      await interaction.reply({
        content: `❌ You have reached your weekly thanks limit (${weeklyStats.maxThanksPerWeek}/week). Resets every Monday.`,
        flags: MessageFlags.Ephemeral,
      });
      // Clear Redis data on failure
      await redisManager.clearThanksData(interaction.user.id, guildId);
      return;
    }

    // Check if user has already thanked this recipient this week
    const hasAlreadyThanked = await redisManager.hasUserThankedRecipient(
      interaction.user.id,
      thanksData.selectedUserId,
      guildId
    );

    if (hasAlreadyThanked) {
      await interaction.reply({
        content: `❌ You have already thanked **${selectedUser.displayName}** this week. You can thank the same person again next Monday.`,
        flags: MessageFlags.Ephemeral,
      });
      // Clear Redis data on failure
      await redisManager.clearThanksData(interaction.user.id, guildId);
      return;
    }

    // Add points to the selected user with category and reason
    const result = await addPoints(
      selectedUser.id,
      guildId,
      10, // Give 10 points for thanks
      "thanks",
      interaction.user.id,
      thanksData.selectedCategory,
      reason,
      {
        timestamp: new Date().toISOString(),
        thanksGiver: interaction.user.displayName,
        thanksReceiver: selectedUser.displayName,
      }
    );

    if (result.success) {
      // Update weekly counters
      await redisManager.incrementWeeklyThanksCount(
        interaction.user.id,
        guildId
      );
      await redisManager.addThankedRecipient(
        interaction.user.id,
        thanksData.selectedUserId,
        guildId
      );

      // Get updated weekly stats for display
      const updatedWeeklyStats = await redisManager.getWeeklyThanksStats(
        interaction.user.id,
        guildId
      );

      const categoryInfo = getCategoryInfo(thanksData.selectedCategory);

      const embed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("✅ Thanks Sent!")
        .setDescription(`You gave thanks to **${selectedUser.displayName}**!`)
        .addFields(
          {
            name: "Category",
            value: `${categoryInfo.emoji} ${categoryInfo.label}`,
            inline: true,
          },
          {
            name: "Points Given",
            value: "10 points",
            inline: true,
          },
          {
            name: "New Balance",
            value: result.newBalance?.toString() || "Unknown",
            inline: true,
          },
          {
            name: "Weekly Thanks",
            value: `${updatedWeeklyStats.thanksUsed}/${updatedWeeklyStats.maxThanksPerWeek} used`,
            inline: true,
          },
          {
            name: "Remaining This Week",
            value: `${updatedWeeklyStats.thanksRemaining} left`,
            inline: true,
          },
          {
            name: "Resets",
            value: "Every Monday",
            inline: true,
          },
          {
            name: "Reason",
            value: reason,
            inline: false,
          }
        )
        .setFooter({ text: "Powered by MENI" })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        components: [],
        flags: MessageFlags.Ephemeral,
      });

      // Clear Redis data after successful completion
      await redisManager.clearThanksData(interaction.user.id, guildId);

      // Log the transaction
      const transaction = await PointsTransaction.findOne({
        where: {
          from_user_id: interaction.user.id,
          to_user_id: selectedUser.id,
          guild_id: guildId,
        },
        order: [["created_at", "DESC"]],
      });

      if (transaction) {
        await notifyThanksMessage(interaction.client, guildId, transaction);
      }
    } else {
      await interaction.reply({
        content: `❌ ${result.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    console.error("Error sending thanks:", error);
    await interaction.reply({
      content: "❌ An error occurred while sending thanks.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

function getCategoryInfo(category: string) {
  const categories = {
    RUN: { emoji: "🏃", label: "Run" },
    UNITY: { emoji: "🤝", label: "Unity" },
    BRAVERY: { emoji: "💪", label: "Bravery" },
    INTEGRITY: { emoji: "💚", label: "Integrity" },
    CUSTOMER_ORIENTED: { emoji: "👥", label: "Customer Oriented" },
  };

  return (
    categories[category as keyof typeof categories] || {
      emoji: "⭐",
      label: "General",
    }
  );
}
