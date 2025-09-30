import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { ConfigManager } from "../../utils/config";

export async function createPresensiConfigPanel(guildId: string) {
  if (!guildId) return null;

  const config = ConfigManager.getGuildConfig(guildId);
  const presensiConfig = config?.presensi;

  const configEmbed = new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle("⏰ Presensi Reminders Configuration")
    .setDescription(
      "Configure automatic presensi reminders for your server.\n\n" +
      "**Schedule:**\n" +
      "• Morning: 07:55 (Monday-Friday)\n" +
      "• Evening: 17:05 (Monday-Friday)\n\n" +
      "**Current Configuration:**"
    )
    .addFields(
      {
        name: "📢 Channel",
        value: presensiConfig?.channel
          ? `<#${presensiConfig.channel}>`
          : "❌ Not set",
        inline: true,
      },
      {
        name: "👥 Role",
        value: presensiConfig?.role
          ? `<@&${presensiConfig.role}>`
          : "❌ Not set",
        inline: true,
      },
      {
        name: "🔧 Status",
        value: presensiConfig?.enabled ? "✅ Enabled" : "❌ Disabled",
        inline: true,
      }
    )
    .setFooter({ text: "Powered by MENI" })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("presensi_channel")
      .setLabel("Set Channel")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📢"),
    new ButtonBuilder()
      .setCustomId("presensi_role")
      .setLabel("Set Role")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("👥")
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("presensi_toggle")
      .setLabel(presensiConfig?.enabled ? "Disable" : "Enable")
      .setStyle(presensiConfig?.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
      .setEmoji(presensiConfig?.enabled ? "❌" : "✅")
      .setDisabled(!presensiConfig?.channel || !presensiConfig?.role),
    new ButtonBuilder()
      .setCustomId("presensi_test")
      .setLabel("Test Reminder")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🧪")
      .setDisabled(!presensiConfig?.enabled || !presensiConfig?.channel || !presensiConfig?.role)
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
    components: [row1, row2, row3],
  };
}

export async function showPresensiConfigPanel(
  interaction: ButtonInteraction,
  additionalMessage?: string
) {
  const panel = await createPresensiConfigPanel(interaction.guildId!);
  if (!panel) return;

  await interaction.update({
    content: additionalMessage || "",
    embeds: [panel.embed],
    components: [
      panel.components[0] as any,
      panel.components[1] as any,
      panel.components[2] as any,
    ],
  });
}
