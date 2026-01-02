import { ModalSubmitInteraction, MessageFlags, EmbedBuilder } from "discord.js";
import { addPoints, notifyThanksMessage } from "../../utils/pointsUtils";
import { PointsTransaction } from "../../models/PointsTransaction";
import { redisManager } from "../../utils/redis";

/**
 * Handle welcome message modal submission
 */
export async function handleWelcomeMessageModal(interaction: ModalSubmitInteraction): Promise<void> {
  const { ConfigManager } = await import("../../utils/config");

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

/**
 * Handle thanks reason modal submission
 */
export async function handleThanksReasonModal(interaction: ModalSubmitInteraction): Promise<void> {
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
      // Add 5 points to the user who gave thanks (the giver)
      let giverRewardResult;
      try {
        giverRewardResult = await addPoints(
          interaction.user.id,
          guildId,
          5, // Give 5 points to the giver
          "reward",
          undefined, // No fromUserId for system reward
          "thanks_giver_reward",
          `Reward for giving thanks to ${selectedUser.displayName}`,
          {
            timestamp: new Date().toISOString(),
            thanksGiver: interaction.user.displayName,
            thanksReceiver: selectedUser.displayName,
            relatedTransaction: "thanks_given",
          }
        );
        if (!giverRewardResult.success) {
          console.error(`Failed to reward giver: ${giverRewardResult.message}`);
        }
      } catch (error) {
        console.error("Error rewarding giver:", error);
        // Continue even if giver reward fails - main thanks transaction succeeded
        giverRewardResult = { success: false, newBalance: undefined };
      }

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
            name: "🎁 Reward Earned",
            value: giverRewardResult?.success ? "You received 5 points!" : "Reward processing...",
            inline: true,
          },
          {
            name: "Your New Balance",
            value: giverRewardResult?.newBalance?.toString() || "Unknown",
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

/**
 * Get category information for thanks
 */
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

