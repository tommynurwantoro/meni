import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { ConfigManager } from "../../utils/config";

export async function createPointsConfigPanel(guildId: string) {
  if (!guildId) return null;

  const config = ConfigManager.getGuildConfig(guildId);
  const pointsConfig = config?.points;

  const configEmbed = new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle("☀️ Points System Configuration")
    .setDescription(
      "Configure the points system for your server.\n\n" +
      "**Features:**\n" +
      "• Points logging and tracking\n" +
      "• Thanks channel for point rewards\n" +
      "• Marketplace integration\n\n" +
      "**Current Configuration:**"
    )
    .addFields(
      {
        name: "📊 Points Logs Channel",
        value: pointsConfig?.logsChannel
          ? `<#${pointsConfig.logsChannel}>`
          : "❌ Not set",
        inline: true,
      },
      {
        name: "🙏 Thanks Channel",
        value: pointsConfig?.thanksChannel
          ? `<#${pointsConfig.thanksChannel}>`
          : "❌ Not set",
        inline: true,
      },
      {
        name: "🔧 Status",
        value: pointsConfig?.enabled ? "✅ Enabled" : "❌ Disabled",
        inline: true,
      },
      {
        name: "👤 Achievement Role User",
        value: pointsConfig?.achievementRoleUser
          ? `<@&${pointsConfig.achievementRoleUser}>`
          : "❌ Not set",
        inline: true,
      },
      {
        name: "🏆 Achievement Role Mention",
        value: pointsConfig?.achievementRoleMention
          ? `<@&${pointsConfig.achievementRoleMention}>`
          : "❌ Not set",
        inline: true,
      }
    )
    .setFooter({ text: "Powered by MENI" })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("points_logs_channel")
      .setLabel("Set Logs Channel")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📊"),
    new ButtonBuilder()
      .setCustomId("points_thanks_channel")
      .setLabel("Set Thanks Channel")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🙏"),
    new ButtonBuilder()
      .setCustomId("points_achievement_role_user")
      .setLabel("Set Achievement Role User")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("👤")
  );

  const row1b = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("points_achievement_role_mention")
      .setLabel("Set Achievement Role Mention")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🏆")
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("points_toggle")
      .setLabel(pointsConfig?.enabled ? "Disable" : "Enable")
      .setStyle(pointsConfig?.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
      .setEmoji(pointsConfig?.enabled ? "❌" : "✅")
      .setDisabled(!pointsConfig?.logsChannel || !pointsConfig?.thanksChannel),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("main_back")
      .setLabel("Back to Main")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("⬅️")
  );

  return {
    embed: configEmbed,
    components: [row1, row1b, row2, row3],
  };
}

export async function showPointsConfigPanel(
  interaction: ButtonInteraction,
  additionalMessage?: string
) {
  const panel = await createPointsConfigPanel(interaction.guildId!);
  if (!panel) return;

  await interaction.update({
    content: additionalMessage || "",
    embeds: [panel.embed],
    components: [
      panel.components[0] as any,
      panel.components[1] as any,
      panel.components[2] as any,
      panel.components[3] as any,
    ],
  });
}
