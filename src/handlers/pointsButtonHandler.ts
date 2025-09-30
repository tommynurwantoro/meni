import {
  ButtonInteraction,
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
} from "discord.js";
import { ConfigManager } from "../utils/config";
import { showPointsConfigPanel } from "../views/points/pointsConfigPanel";
import { showPointsLogsChannelPanel } from "../views/points/pointsLogsChannelPanel";
import { showPointsThanksChannelPanel } from "../views/points/pointsThanksChannelPanel";
import {
  getUserBalance,
} from "../utils/pointsUtils";
import { redisManager } from "../utils/redis";

export async function handlePointsButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({
      content: "❌ This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    switch (customId) {
      case "points_logs_channel":
        await handlePointsLogsChannel(interaction);
        break;

      case "points_thanks_channel":
        await handlePointsThanksChannel(interaction);
        break;

      case "points_toggle":
        await handlePointsToggle(interaction);
        break;

      case "points_send_thanks":
        await handleSendThanks(interaction);
        break;

      case "points_check_balance":
        await handleCheckBalance(interaction);
        break;

      default:
        await interaction.reply({
          content: "❌ Unknown points button interaction",
          flags: MessageFlags.Ephemeral,
        });
    }
  } catch (error) {
    console.error("Error handling points button:", error);
    await interaction.reply({
      content: "❌ An error occurred while processing the request.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handlePointsLogsChannel(interaction: ButtonInteraction) {
  await showPointsLogsChannelPanel(interaction);
}

async function handlePointsThanksChannel(interaction: ButtonInteraction) {
  await showPointsThanksChannelPanel(interaction);
}

async function handlePointsToggle(interaction: ButtonInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const config = ConfigManager.getGuildConfig(guildId);
  const pointsConfig = config?.points;

  if (!pointsConfig?.logsChannel || !pointsConfig?.thanksChannel) {
    await interaction.reply({
      content:
        "❌ Please set both logs channel and thanks channel before enabling points system.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const newEnabled = !pointsConfig.enabled;

  ConfigManager.updateGuildConfig(guildId, {
    points: {
      ...pointsConfig,
      enabled: newEnabled,
    },
  });

  // If enabling the points system, send embed to thanks channel
  if (newEnabled) {
    try {
      const guild = interaction.guild;
      if (!guild) {
        await interaction.reply({
          content: "❌ Could not access guild information.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const thanksChannel = guild.channels.cache.get(
        pointsConfig.thanksChannel
      );
      if (!thanksChannel || !thanksChannel.isTextBased()) {
        await interaction.reply({
          content: "❌ Thanks channel not found or not accessible.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Create points system embed
      const embed = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle("👍 Thanks!")
        .setDescription(
          "• Give thanks to other members to earn them points\n" +
            "• Check your balance anytime\n" +
            "• Points can be used in the marketplace\n\n" +
            "Use the buttons below to get started!"
        )
        .setFooter({ text: "Powered by BULLSTER" })
        .setTimestamp();

      // Create buttons
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("points_send_thanks")
          .setLabel("Send Thanks")
          .setStyle(ButtonStyle.Success)
          .setEmoji("🙏"),
        new ButtonBuilder()
          .setCustomId("points_check_balance")
          .setLabel("Check Balance")
          .setStyle(ButtonStyle.Success)
          .setEmoji("💰")
      );

      // Send embed to thanks channel
      await thanksChannel.send({
        embeds: [embed],
        components: [row],
      });

      await showPointsConfigPanel(
        interaction,
        `✅ Points system enabled successfully! Welcome message sent to <#${pointsConfig.thanksChannel}>`
      );
    } catch (error) {
      console.error("Error sending points system message:", error);
      await showPointsConfigPanel(
        interaction,
        `✅ Points system enabled, but failed to send welcome message to thanks channel.`
      );
    }
  } else {
    await showPointsConfigPanel(
      interaction,
      `✅ Points system disabled successfully!`
    );
  }
}

async function handleSendThanks(interaction: ButtonInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const config = ConfigManager.getGuildConfig(guildId);
  const pointsConfig = config?.points;

  if (!pointsConfig?.enabled) {
    await interaction.reply({
      content: "❌ Points system is not enabled in this server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle("👍 Send Thanks")
    .setDescription(
      "Select a user to give thanks to. They will receive points!"
    );

  const userSelect =
    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId("thanks_user_select")
        .setPlaceholder("Select a user to thank")
        .setMinValues(1)
        .setMaxValues(1)
    );

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("points_back")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("❌")
  );

  await interaction.reply({
    embeds: [embed],
    components: [userSelect, buttonRow],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleCheckBalance(interaction: ButtonInteraction) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!guildId) return;

  const config = ConfigManager.getGuildConfig(guildId);
  const pointsConfig = config?.points;

  if (!pointsConfig?.enabled) {
    await interaction.reply({
      content: "❌ Points system is not enabled in this server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const balance = await getUserBalance(userId, guildId);
    const weeklyStats = await redisManager.getWeeklyThanksStats(userId, guildId);

    if (!balance) {
      await interaction.reply({
        content:
          "❌ You don't have a points account yet. Give or receive some thanks to get started!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Get thanked users display names
    let thankedUsersText = "None";
    if (weeklyStats.thankedRecipients.length > 0) {
      const guild = interaction.guild;
      const thankedNames = [];
      for (const recipientId of weeklyStats.thankedRecipients) {
        try {
          const member = await guild?.members.fetch(recipientId);
          thankedNames.push(member?.displayName || `<@${recipientId}>`);
        } catch {
          thankedNames.push(`<@${recipientId}>`);
        }
      }
      thankedUsersText = thankedNames.join(", ");
      if (thankedUsersText.length > 1024) {
        thankedUsersText = thankedUsersText.substring(0, 1020) + "...";
      }
    }

    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle("💰 Your Rubic Balance")
      .setDescription(`**Total accumulated Rubic: ${balance.points}**\n\nHere's your current points information:`)
      .addFields(
        {
          name: "📈 Total Received",
          value: balance.total_received.toString(),
          inline: true,
        },
        {
          name: "📤 Total Given",
          value: balance.total_given.toString(),
          inline: true,
        },
        {
          name: "🙏 Weekly Thanks Used",
          value: `${weeklyStats.thanksUsed}/${weeklyStats.maxThanksPerWeek}`,
          inline: true,
        },
        {
          name: "⏳ Thanks Remaining",
          value: `${weeklyStats.thanksRemaining} left`,
          inline: true,
        },
        {
          name: "🔄 Resets",
          value: `Every Monday`,
          inline: true,
        },
        {
          name: "👥 Thanked This Week",
          value: thankedUsersText,
          inline: false,
        }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: "Powered by BULLSTER" })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("Error checking balance:", error);
    await interaction.reply({
      content: "❌ An error occurred while checking your balance.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
