import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { ConfigManager } from "../../utils/config";

export async function createSholatConfigPanel(guildId: string) {
  if (!guildId) return null;

  const config = ConfigManager.getGuildConfig(guildId);
  const sholatConfig = config?.sholat;

  const configEmbed = new EmbedBuilder()
    .setColor("#00BFFF")
    .setTitle("🕌 Sholat Reminders Configuration")
    .setDescription(
      "Configure automatic prayer time reminders for your server.\n\n" +
      "**Features:**\n" +
      "• Automatic prayer time detection\n" +
      "• Daily schedule updates\n" +
      "• Customizable channel and role\n\n" +
      "**Current Configuration:**"
    )
    .addFields(
      {
        name: "📢 Channel",
        value: sholatConfig?.channel
          ? `<#${sholatConfig.channel}>`
          : "❌ Not set",
        inline: true,
      },
      {
        name: "👥 Role",
        value: sholatConfig?.role
          ? `<@&${sholatConfig.role}>`
          : "❌ Not set",
        inline: true,
      },
      {
        name: "🔧 Status",
        value: sholatConfig?.enabled ? "✅ Enabled" : "❌ Disabled",
        inline: true,
      }
    )
    .setFooter({ text: "Powered by BULLSTER" })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("sholat_channel")
      .setLabel("Set Channel")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📢"),
    new ButtonBuilder()
      .setCustomId("sholat_role")
      .setLabel("Set Role")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("👥")
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("sholat_toggle")
      .setLabel(sholatConfig?.enabled ? "Disable" : "Enable")
      .setStyle(sholatConfig?.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
      .setEmoji(sholatConfig?.enabled ? "❌" : "✅")
      .setDisabled(!sholatConfig?.channel || !sholatConfig?.role),
    new ButtonBuilder()
      .setCustomId("sholat_test")
      .setLabel("Test Reminder")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🧪")
      .setDisabled(!sholatConfig?.enabled || !sholatConfig?.channel || !sholatConfig?.role)
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

export async function showSholatConfigPanel(
  interaction: ButtonInteraction,
  additionalMessage?: string
) {
  const panel = await createSholatConfigPanel(interaction.guildId!);
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