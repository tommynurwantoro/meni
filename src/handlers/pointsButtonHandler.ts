import { ButtonInteraction, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { ConfigManager } from "../utils/config";
import { showPointsConfigPanel } from "../views/points/pointsConfigPanel";
import { showPointsLogsChannelPanel } from "../views/points/pointsLogsChannelPanel";
import { showPointsThanksChannelPanel } from "../views/points/pointsThanksChannelPanel";

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
      content: "❌ Please set both logs channel and thanks channel before enabling points system.",
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

      const thanksChannel = guild.channels.cache.get(pointsConfig.thanksChannel);
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
        .setTitle(":thumbsup: Thanks!")
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
          .setCustomId("send_thanks")
          .setLabel("Send Thanks")
          .setStyle(ButtonStyle.Success)
          .setEmoji("🙏"),
        new ButtonBuilder()
          .setCustomId("check_balance")
          .setLabel("Check Balance")
          .setStyle(ButtonStyle.Success)
          .setEmoji("💰")
      );

      // Send embed to thanks channel
      await thanksChannel.send({
        embeds: [embed],
        components: [row],
      });

      await showPointsConfigPanel(interaction, 
        `✅ Points system enabled successfully! Welcome message sent to <#${pointsConfig.thanksChannel}>`
      );
    } catch (error) {
      console.error("Error sending points system message:", error);
      await showPointsConfigPanel(interaction, 
        `✅ Points system enabled, but failed to send welcome message to thanks channel.`
      );
    }
  } else {
    await showPointsConfigPanel(interaction, 
      `✅ Points system disabled successfully!`
    );
  }
}
