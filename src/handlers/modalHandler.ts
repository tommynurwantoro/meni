import { ModalSubmitInteraction, MessageFlags, EmbedBuilder, TextChannel } from "discord.js";
import Review from "../models/Review";
import { showMarketplaceStockPanel } from "../views/marketplace/marketplaceStockPanel";
import { createLinkProtectionPanel } from "../views/moderation/linkProtectionPanel";
import { getReviewQueueData, updateReviewMessage } from "../utils/reviewUtils";
import { addPoints, notifyThanksMessage } from "../utils/pointsUtils";
import { PointsTransaction } from "../models/PointsTransaction";
import { redisManager } from "../utils/redis";
import { validateServiceExists, extractCurrentImageTag, updateImageTagInYaml, generateCommitMessage, validateYamlContent } from "../utils/gitopsUtils";

export async function handleModal(interaction: ModalSubmitInteraction) {
  const customId = interaction.customId;

  // Check if customId starts with gitlab_token_modal (format: gitlab_token_modal_userId)
  if (customId.startsWith("gitlab_token_modal_")) {
    await handleGitLabTokenModal(interaction);
    return;
  }

  // Check if customId starts with create_tag_modal (format: create_tag_modal_serviceName_projectId)
  if (customId.startsWith("create_tag_modal_")) {
    await handleCreateTagModal(interaction);
    return;
  }

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

async function handleGitLabTokenModal(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const token = interaction.fields.getTextInputValue("gitlab_token").trim();

    // Save the token
    const { saveGitLabToken } = await import("../commands/gitlab");
    await saveGitLabToken(interaction.user.id, token);

    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle("✅ Token Saved Successfully")
      .setDescription(
        "Your GitLab personal access token has been encrypted and stored securely.\n\n" +
          "You can now use GitLab features like:\n" +
          "• `/deploy tags` - View repository tags\n" +
          "• `/deploy create-tag` - Create new tags"
      )
      .addFields({
        name: "Security",
        value:
          "🔒 Your token is encrypted using AES-256-GCM encryption and stored securely in the database.",
        inline: false,
      })
      .setFooter({ text: "Powered by MENI" })
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error: any) {
    console.error("Save GitLab token modal error:", error);

    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle("❌ Failed to Save Token")
      .setDescription(
        error.message || "An unknown error occurred while saving your token"
      )
      .setFooter({ text: "Powered by MENI" })
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleCreateTagModal(interaction: ModalSubmitInteraction) {
  try {
    // Parse custom ID to get service name, project ID, and stack name
    // Format: create_tag_modal_serviceName_projectId_stackName
    const customIdParts = interaction.customId.split("_");
    const stackName = customIdParts.pop(); // Last part is stack name
    const projectId = customIdParts.pop(); // Second to last is project ID
    customIdParts.shift(); // Remove "create"
    customIdParts.shift(); // Remove "tag"
    customIdParts.shift(); // Remove "modal"
    const serviceName = customIdParts.join("_"); // Rest is service name

    if (!projectId || !serviceName || !stackName) {
      await interaction.reply({
        content: "❌ Invalid modal data.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Get form values
    const tagName = interaction.fields.getTextInputValue("tag_name").trim();
    const tagMessage = interaction.fields.getTextInputValue("tag_message").trim();

    // Get the original message that triggered this modal
    const originalMessage = interaction.message;
    if (!originalMessage) {
      await interaction.reply({
        content: "❌ Could not find original message.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Acknowledge the modal submission
    await interaction.deferUpdate();

    // Update the original message to show loading state
    const loadingEmbed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle("🔄 Creating Tag and Updating YAML")
      .setDescription(`Creating tag **${tagName}** for **${serviceName}** and updating GitOps configuration...`)
      .setFooter({ text: "Powered by MENI" })
      .setTimestamp();

    await originalMessage.edit({ embeds: [loadingEmbed], components: [] });

    // Get user's GitLab token
    const { getGitLabToken } = await import("../commands/gitlab");
    const userToken = await getGitLabToken(interaction.user.id);
    
    if (!userToken) {
      const noTokenEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle("🔐 GitLab Token Not Found")
        .setDescription("Your GitLab token could not be retrieved. Please set it again using `/gitlab token`.")
        .setFooter({ text: "Powered by MENI" })
        .setTimestamp();
      
      await originalMessage.edit({ embeds: [noTokenEmbed], components: [] });
      return;
    }

    // Import GitLab client and create instance with user's token
    const { GitLabClient } = await import("../utils/gitlabClient");
    const gitlabUrl = process.env.GITLAB_URL;
    
    if (!gitlabUrl) {
      throw new Error("GitLab URL is not configured");
    }
    
    const gitlabClient = new GitLabClient({ baseUrl: gitlabUrl, token: userToken });

    // Load stack config to get GitOps info
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const whitelistPath = join(process.cwd(), "whitelist_deploy.json");
    const whitelistData = readFileSync(whitelistPath, "utf-8");
    const whitelist = JSON.parse(whitelistData);
    const stackConfig = whitelist.stacks?.[stackName];

    if (!stackConfig) {
      throw new Error(`Stack "${stackName}" configuration not found`);
    }

    // Create the tag (from main branch)
    const tag = await gitlabClient.createTag(projectId, tagName, "main", tagMessage);

    // Update YAML file with new tag
    let yamlUpdated = false;
    let yamlCommitInfo = null;
    
    try {
      // Get current YAML content
      const yamlContent = await gitlabClient.getFileRawContent(
        stackConfig.gitOpsRepoId,
        stackConfig.gitOpsFilePath,
        stackConfig.gitOpsBranch
      );

      if (!validateServiceExists(yamlContent, serviceName)) {
        throw new Error(`Service "${serviceName}" not found in GitOps configuration file`);
      }

      // Extract current tag and update YAML
      const currentTag = extractCurrentImageTag(yamlContent, serviceName);
      let updatedYamlContent = updateImageTagInYaml(yamlContent, serviceName, tagName);

      // Validate and commit changes back to GitLab
      const commitMessage = generateCommitMessage(serviceName, tagName, currentTag || undefined);
      
      // Validate and clean YAML content before upload
      updatedYamlContent = validateYamlContent(updatedYamlContent);
      
      await gitlabClient.updateFile(
        stackConfig.gitOpsRepoId,
        stackConfig.gitOpsFilePath,
        stackConfig.gitOpsBranch,
        updatedYamlContent,
        commitMessage
      );

      yamlUpdated = true;
    } catch (error: any) {
      console.error(`⚠️ Failed to update YAML file: ${error.message}`);
      // Continue - tag was created successfully, YAML update failed
    }

    // Success embed with user info
    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle("✅ Tag Created Successfully")
      .setDescription(`Tag **${tagName}** has been created for **${serviceName}** in GitLab by <@${interaction.user.id}>`)
      .addFields(
        { name: "Tag Name", value: tagName, inline: true },
        { name: "Project ID", value: projectId, inline: true },
        { name: "Branch", value: "main", inline: true },
        { name: "Commit", value: tag.commit.short_id, inline: true },
        { name: "Commit Author", value: tag.commit.author_name, inline: true },
        { name: "Created At", value: new Date(tag.commit.created_at).toLocaleString("id-ID"), inline: true },
        { name: "Tag Message", value: tagMessage, inline: false },
        { name: "Created By", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Created On", value: new Date().toLocaleString("id-ID"), inline: true }
      )
      .setFooter({ text: "Powered by MENI" })
      .setTimestamp();

    // Add YAML update info if successful
    if (yamlUpdated && yamlCommitInfo) {
      successEmbed.addFields({
        name: "📝 GitOps YAML Updated",
        value: `✅ Updated \`${stackConfig.gitOpsFilePath}\``,
        inline: false,
      });
      successEmbed.setDescription(
        `Tag **${tagName}** created and GitOps configuration updated. Monitoring pipeline status...`
      );
    } else if (!yamlUpdated) {
      successEmbed.addFields({
        name: "⚠️ YAML Update Failed",
        value: "Tag was created but YAML file could not be updated. Please update manually.",
        inline: false,
      });
    }

    // Edit the original message with success
    await originalMessage.edit({ embeds: [successEmbed], components: [] });

    // Check and monitor pipeline status if YAML was updated
    if (yamlUpdated) {
      const commitSha = tag?.commit?.id;
      
      if (commitSha) {
        console.log(`🔍 Starting pipeline monitoring for commit: ${commitSha.substring(0, 8)}`);
        // Start pipeline monitoring in background
        monitorPipelineStatus(
          gitlabClient,
          projectId,
          commitSha,
          originalMessage,
          interaction.channel,
          serviceName,
          tagName
        ).catch((error) => {
          console.error("❌ Pipeline monitoring error:", error);
        });
      } else {
        console.warn("❌ No commit SHA available for pipeline monitoring.");
      }
    }
  } catch (error: any) {
    console.error("❌ Create tag modal error:", error);

    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle("❌ Failed to Create Tag")
      .setDescription(error.message || "An unknown error occurred while creating the tag")
      .addFields(
        { name: "Attempted By", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Time", value: new Date().toLocaleString("id-ID"), inline: true }
      )
      .setFooter({ text: "Powered by MENI" })
      .setTimestamp();

    // Try to edit the original message, fallback to reply if not available
    const originalMessage = interaction.message;
    if (originalMessage) {
      await originalMessage.edit({ embeds: [errorEmbed], components: [] });
    } else if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [errorEmbed], components: [] });
    } else {
      await interaction.reply({
        embeds: [errorEmbed],
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

/**
 * Safely convert timestamp from embed data to Date or null
 */
function safeTimestamp(timestamp: any): Date | null {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'number') return new Date(timestamp);
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Monitor pipeline status for a commit and send notification when it completes
 */
async function monitorPipelineStatus(
  gitlabClient: any,
  projectId: string,
  commitSha: string,
  originalMessage: any,
  channel: any,
  serviceName: string,
  tagName: string
) {
  const maxWaitTime = 10 * 60 * 1000; // 10 minutes
  const pollInterval = 15 * 1000; // 15 seconds
  const initialWait = 5 * 1000; // Wait 5 seconds before first check
  const startTime = Date.now();

  // Wait a bit for pipeline to start
  await new Promise((resolve) => setTimeout(resolve, initialWait));

  let pipelineId: number | null = null;
  let lastStatus: string | null = null;

  // Update original message to show pipeline monitoring
  const originalEmbedData = originalMessage.embeds[0]?.data || {};
  const monitoringEmbed = new EmbedBuilder()
    .setColor(originalEmbedData.color || 0x00FF00)
    .setTitle(originalEmbedData.title || "✅ Tag Created Successfully")
    .setDescription(
      `Tag **${tagName}** created and GitOps configuration updated.\n🔍 Monitoring pipeline status...`
    )
    .setFooter(originalEmbedData.footer || { text: "Powered by MENI" });
  
  const safeTs = safeTimestamp(originalEmbedData.timestamp);
  if (safeTs) {
    monitoringEmbed.setTimestamp(safeTs);
  }

  // Copy existing fields except pipeline status
  if (originalEmbedData.fields) {
    originalEmbedData.fields.forEach((field: any) => {
      if (field.name !== "⏳ Pipeline Status" && field.name !== "✅ Pipeline Status" && field.name !== "ℹ️ Pipeline Status") {
        monitoringEmbed.addFields(field);
      }
    });
  }

  monitoringEmbed.addFields({
    name: "⏳ Pipeline Status",
    value: "Waiting for pipeline to start...",
    inline: false,
  });

  try {
    await originalMessage.edit({ embeds: [monitoringEmbed] });
  } catch (error) {
    console.error("❌ Failed to update message:", error);
  }

  // Poll for pipeline status
  while (Date.now() - startTime < maxWaitTime) {
    console.log("🔍 Polling for pipeline status...");
    try {
      // Get pipelines for this commit
      const pipelines = await gitlabClient.getPipelinesForCommit(projectId, commitSha);

      if (pipelines.length > 0) {
        // Use the most recent pipeline
        const pipeline = pipelines[0];
        pipelineId = pipeline.id;
        const status = pipeline.status;

        // If status changed, update the message
        if (status !== lastStatus) {
          lastStatus = status;

          const statusEmoji = getPipelineStatusEmoji(status);
          const statusText = getPipelineStatusText(status);

          const currentEmbedData = originalMessage.embeds[0]?.data || {};
          const updatedEmbed = new EmbedBuilder()
            .setColor(currentEmbedData.color || 0x00FF00)
            .setTitle(currentEmbedData.title || "✅ Tag Created Successfully")
            .setDescription(currentEmbedData.description || "")
            .setFooter(currentEmbedData.footer || { text: "Powered by MENI" });
          
          const safeTs = safeTimestamp(currentEmbedData.timestamp);
          if (safeTs) {
            updatedEmbed.setTimestamp(safeTs);
          }

          // Copy existing fields except pipeline status
          if (currentEmbedData.fields) {
            currentEmbedData.fields.forEach((field: any) => {
              if (field.name !== "⏳ Pipeline Status" && field.name !== "✅ Pipeline Status" && field.name !== "ℹ️ Pipeline Status" && field.name !== "⏰ Pipeline Status") {
                updatedEmbed.addFields(field);
              }
            });
          }

          updatedEmbed.addFields({
            name: "⏳ Pipeline Status",
            value: `${statusEmoji} ${statusText}\nPipeline ID: \`${pipelineId}\``,
            inline: false,
          });

          try {
            await originalMessage.edit({ embeds: [updatedEmbed] });
          } catch (error) {
            console.error("❌ Failed to update message:", error);
          }
        }

        // Check if pipeline is finished
        if (isPipelineFinished(status)) {
          // Send notification in channel
          await sendPipelineNotification(
            channel,
            serviceName,
            tagName,
            pipeline,
            projectId,
            commitSha
          );

          // Update original message with final status
          const currentEmbedData = originalMessage.embeds[0]?.data || {};
          const finalEmoji = getPipelineStatusEmoji(status);
          const finalText = getPipelineStatusText(status);
          const finalEmbed = new EmbedBuilder()
            .setColor(currentEmbedData.color || 0x00FF00)
            .setTitle(currentEmbedData.title || "✅ Tag Created Successfully")
            .setDescription(
              `Tag **${tagName}** created and GitOps configuration updated. Pipeline ${finalText.toLowerCase()}.`
            )
            .setFooter(currentEmbedData.footer || { text: "Powered by MENI" });
          
          const safeTs = safeTimestamp(currentEmbedData.timestamp);
          if (safeTs) {
            finalEmbed.setTimestamp(safeTs);
          }

          // Copy existing fields except pipeline status
          if (currentEmbedData.fields) {
            currentEmbedData.fields.forEach((field: any) => {
              if (field.name !== "⏳ Pipeline Status" && field.name !== "✅ Pipeline Status" && field.name !== "ℹ️ Pipeline Status" && field.name !== "⏰ Pipeline Status") {
                finalEmbed.addFields(field);
              }
            });
          }

          finalEmbed.addFields({
            name: "✅ Pipeline Status",
            value: `${finalEmoji} ${finalText}\nPipeline ID: \`${pipelineId}\``,
            inline: false,
          });

          try {
            await originalMessage.edit({ embeds: [finalEmbed] });
          } catch (error) {
            console.error("❌ Failed to update message:", error);
          }

          return; // Pipeline finished, stop monitoring
        }
      } else if (Date.now() - startTime > 30 * 1000) {
        // If no pipeline found after 30 seconds, might not have CI/CD configured
        const currentEmbedData = originalMessage.embeds[0]?.data || {};
        const updatedEmbed = new EmbedBuilder()
          .setColor(currentEmbedData.color || 0x00FF00)
          .setTitle(currentEmbedData.title || "✅ Tag Created Successfully")
          .setDescription(
            `Tag **${tagName}** created and GitOps configuration updated. Ready for deployment via \`/deploy stack\`.`
          )
          .setFooter(currentEmbedData.footer || { text: "Powered by MENI" });
        
        const safeTs = safeTimestamp(currentEmbedData.timestamp);
        if (safeTs) {
          updatedEmbed.setTimestamp(safeTs);
        }

        // Copy existing fields except pipeline status
        if (currentEmbedData.fields) {
          currentEmbedData.fields.forEach((field: any) => {
            if (field.name !== "⏳ Pipeline Status" && field.name !== "✅ Pipeline Status" && field.name !== "ℹ️ Pipeline Status" && field.name !== "⏰ Pipeline Status") {
              updatedEmbed.addFields(field);
            }
          });
        }

        updatedEmbed.addFields({
          name: "ℹ️ Pipeline Status",
          value: "No pipeline found for this commit. CI/CD may not be configured.",
          inline: false,
        });

        try {
          await originalMessage.edit({ embeds: [updatedEmbed] });
        } catch (error) {
          console.error("❌ Failed to update message:", error);
        }
        return;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (error: any) {
      console.error("❌ Error checking pipeline status:", error);
      // Continue polling despite errors
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  // Timeout reached
  if (pipelineId && lastStatus && !isPipelineFinished(lastStatus)) {
    const currentEmbedData = originalMessage.embeds[0]?.data || {};
    const timeoutEmbed = new EmbedBuilder()
      .setColor(currentEmbedData.color || 0xFFA500)
      .setTitle(currentEmbedData.title || "✅ Tag Created Successfully")
      .setDescription(currentEmbedData.description || "")
      .setFooter(currentEmbedData.footer || { text: "Powered by MENI" });
    
    const safeTs = safeTimestamp(currentEmbedData.timestamp);
    if (safeTs) {
      timeoutEmbed.setTimestamp(safeTs);
    }

    // Copy existing fields except pipeline status
    if (currentEmbedData.fields) {
      currentEmbedData.fields.forEach((field: any) => {
        if (field.name !== "⏳ Pipeline Status" && field.name !== "✅ Pipeline Status" && field.name !== "ℹ️ Pipeline Status" && field.name !== "⏰ Pipeline Status") {
          timeoutEmbed.addFields(field);
        }
      });
    }

    timeoutEmbed.addFields({
      name: "⏰ Pipeline Status",
      value: `⏳ Still running (monitoring timeout)\nPipeline ID: \`${pipelineId}\`\nStatus: ${getPipelineStatusText(lastStatus)}`,
      inline: false,
    });

    try {
      await originalMessage.edit({ embeds: [timeoutEmbed] });
    } catch (error) {
      console.error("❌ Failed to update message:", error);
    }
  }
}

/**
 * Send pipeline completion notification in the channel
 */
async function sendPipelineNotification(
  channel: any,
  serviceName: string,
  tagName: string,
  pipeline: any,
  projectId: string,
  commitSha: string
) {
  if (!channel || !(channel instanceof TextChannel)) {
    return; // Can't send notification if channel is not available
  }

  const statusEmoji = getPipelineStatusEmoji(pipeline.status);
  const statusText = getPipelineStatusText(pipeline.status);
  const embedColor = pipeline.status === "success" ? 0x00ff00 : pipeline.status === "failed" ? 0xff0000 : 0xffa500;

  const gitlabUrl = process.env.GITLAB_URL || "";
  const pipelineUrl = gitlabUrl
    ? `${gitlabUrl.replace(/\/$/, "")}/${projectId}/-/pipelines/${pipeline.id}`
    : null;

  const notificationEmbed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`${statusEmoji} Pipeline ${statusText}`)
    .setDescription(
      `Pipeline for **${serviceName}** tag **${tagName}** has ${statusText.toLowerCase()}.`
    )
    .addFields(
      { name: "Service", value: serviceName, inline: true },
      { name: "Tag", value: tagName, inline: true },
      { name: "Pipeline ID", value: `\`${pipeline.id}\``, inline: true },
      { name: "Status", value: statusText, inline: true },
      { name: "Commit", value: `\`${commitSha.substring(0, 8)}\``, inline: true }
    )
    .setFooter({ text: "Powered by MENI" })
    .setTimestamp();

  if (pipelineUrl) {
    notificationEmbed.setURL(pipelineUrl);
    notificationEmbed.addFields({
      name: "🔗 Pipeline Link",
      value: `[View Pipeline](${pipelineUrl})`,
      inline: false,
    });
  }

  try {
    await channel.send({ embeds: [notificationEmbed] });
  } catch (error) {
    console.error("❌ Failed to send pipeline notification:", error);
  }
}

/**
 * Get emoji for pipeline status
 */
function getPipelineStatusEmoji(status: string): string {
  switch (status) {
    case "success":
      return "✅";
    case "failed":
      return "❌";
    case "running":
      return "🔄";
    case "pending":
      return "⏳";
    case "canceled":
      return "🚫";
    case "skipped":
      return "⏭️";
    default:
      return "❓";
  }
}

/**
 * Get human-readable text for pipeline status
 */
function getPipelineStatusText(status: string): string {
  switch (status) {
    case "success":
      return "Completed Successfully";
    case "failed":
      return "Failed";
    case "running":
      return "Running";
    case "pending":
      return "Pending";
    case "canceled":
      return "Canceled";
    case "skipped":
      return "Skipped";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

/**
 * Check if pipeline status indicates it's finished
 */
function isPipelineFinished(status: string): boolean {
  return ["success", "failed", "canceled", "skipped"].includes(status);
}
