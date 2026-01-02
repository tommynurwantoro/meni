import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  EmbedBuilder,
} from "discord.js";
import { ConfigManager } from "../utils/config";
import { addPoints } from "../utils/pointsUtils";

export const data = new SlashCommandBuilder()
  .setName("achievement")
  .setDescription("Award an achievement to a user")
  .addUserOption((option) =>
    option
      .setName("target_user")
      .setDescription("User who received the achievement")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("message")
      .setDescription("Appreciation message for the achievement")
      .setRequired(true)
      .setMaxLength(2000)
  );

export const cooldown = 5;

/**
 * Check if user has required role for achievement command
 */
async function checkAchievementPermissions(
  interaction: ChatInputCommandInteraction
): Promise<boolean> {
  const allowedRoleId = process.env.ACHIEVEMENT_ROLE_ID;

  if (!allowedRoleId) {
    // If not set, restrict to prevent unauthorized usage
    const noConfigEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("❌ Configuration Error")
      .setDescription(
        "Achievement command is not configured. Please contact an administrator."
      )
      .setTimestamp();

    await interaction.reply({ embeds: [noConfigEmbed], ephemeral: true });
    return false;
  }

  // Check if interaction is from a guild (not DM)
  if (!interaction.guild) {
    const dmEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("❌ Access Denied")
      .setDescription("Achievement command can only be used in a server.")
      .setTimestamp();

    await interaction.reply({ embeds: [dmEmbed], ephemeral: true });
    return false;
  }

  // Get member from guild
  const member = await interaction.guild.members.fetch(interaction.user.id);

  // Check if member has the required role
  if (!member.roles.cache.has(allowedRoleId)) {
    const noPermissionEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("❌ Access Denied")
      .setDescription(
        "You do not have permission to use the achievement command."
      )
      .setFooter({ text: "Required role is missing" })
      .setTimestamp();

    await interaction.reply({
      embeds: [noPermissionEmbed],
      ephemeral: true,
    });
    return false;
  }

  return true;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  // Check permissions first
  const hasPermission = await checkAchievementPermissions(interaction);
  if (!hasPermission) {
    return;
  }

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: "❌ This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Get parameters
  const targetUser = interaction.options.getUser("target_user", true);
  const message = interaction.options.getString("message", true);

  // Validate: Cannot award achievement to yourself
  if (targetUser.id === interaction.user.id) {
    await interaction.reply({
      content: "❌ You cannot award an achievement to yourself.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    // Check if points system is enabled
    const config = ConfigManager.getGuildConfig(guildId);
    if (!config?.points?.enabled) {
      await interaction.reply({
        content:
          "❌ Points system is not enabled in this server. Please enable it first.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check if logs channel is configured
    const logsChannelId = config?.points?.logsChannel;
    if (!logsChannelId) {
      await interaction.reply({
        content:
          "❌ Points logs channel is not configured. Please configure it first.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Award 50 points to the target user
    const pointsResult = await addPoints(
      targetUser.id,
      guildId,
      50,
      "reward",
      interaction.user.id,
      "achievement",
      message,
      {
        timestamp: new Date().toISOString(),
        awardedBy: interaction.user.displayName,
        recipient: targetUser.displayName,
        commandAuthor: interaction.user.id,
      }
    );

    if (!pointsResult.success) {
      await interaction.reply({
        content: `❌ Failed to award points: ${pointsResult.message}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Get the guild and logs channel
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: "❌ Could not access guild information.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const logsChannel = guild.channels.cache.get(logsChannelId);
    if (!logsChannel || !logsChannel.isTextBased()) {
      await interaction.reply({
        content: "❌ Points logs channel not found or not accessible.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Create achievement embed
    const achievementEmbed = new EmbedBuilder()
      .setColor(0xffd700) // Gold color for achievements
      .setTitle("🏆 Achievement Awarded!")
      .setDescription(
        `**${targetUser}** has been awarded an achievement!\n\n${message}`
      )
      .addFields(
        {
          name: "👤 Awarded By",
          value: `<@${interaction.user.id}>`,
          inline: true,
        },
        {
          name: "🎯 Recipient",
          value: `<@${targetUser.id}>`,
          inline: true,
        },
        {
          name: "💰 Points Awarded",
          value: "50 points",
          inline: true,
        },
        {
          name: "💎 New Balance",
          value: pointsResult.newBalance?.toString() || "Unknown",
          inline: true,
        }
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({ text: "Powered by MENI" })
      .setTimestamp();

    // Reply with success message
    await interaction.reply({
      content: `✅ Successfully awarded achievement to **${targetUser.displayName}**! The announcement has been sent to the points logs channel.`,
      flags: MessageFlags.Ephemeral,
    });

    // Send embed to logs channel
    await logsChannel.send({
      content: `<@${targetUser.id}>`,
      embeds: [achievementEmbed],
    });
  } catch (error) {
    console.error("Error awarding achievement:", error);
    await interaction.reply({
      content:
        "❌ An error occurred while awarding the achievement. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

