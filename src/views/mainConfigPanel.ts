import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { ConfigManager } from "../utils/config";

export async function createMainConfigPanel(
  interaction: ButtonInteraction | ChatInputCommandInteraction
) {
  const guildId = interaction.guildId;
  if (!guildId) return null;

  const config = ConfigManager.getGuildConfig(guildId);

  const configEmbed = new EmbedBuilder()
    .setColor("#0099ff")
    .setTitle("⚙️ Bot Configuration Panel")
    .setDescription(
      "Click the buttons below to configure different aspects of the bot:"
    )
    .addFields(
      {
        name: "🎯 Welcome System",
        value: config?.welcome?.channel
          ? `
                ✅ Configured
                Channel: <#${config.welcome.channel}>
                Message: ${config.welcome.message}`
          : "❌ Not configured",
        inline: false,
      },
      {
        name: "🛡️ Moderation",
        value: config?.moderation?.logsChannel
          ? `
                    ✅ Configured
                    Logs: <#${config.moderation.logsChannel}>`
          : "❌ Not configured",
        inline: false,
      },
      {
        name: "☀️ Points System",
        value:
          config?.points?.enabled &&
          config?.points?.logsChannel &&
          config?.points?.thanksChannel
            ? `
                    ✅ Configured
                    Logs: <#${config.points.logsChannel}>
                    Thanks: <#${config.points.thanksChannel}>`
            : "❌ Not configured",
        inline: false,
      },
      {
        name: "💰 Marketplace Feature",
        value: config?.points?.marketplace?.channel
          ? `
                    ✅ Configured
                    Channel: <#${config.points.marketplace.channel}>`
          : "❌ Not configured",
        inline: false,
      },
      {
        name: "⏰ Presensi Reminders",
        value:
          config?.presensi?.enabled &&
          config?.presensi?.channel &&
          config?.presensi?.role
            ? `
                    ✅ Configured
                    Channel: <#${config.presensi.channel}>
                    Role: <@&${config.presensi.role}>
                    Schedule: 07:55 & 17:05 (Weekdays)`
            : "❌ Not configured",
        inline: false,
      },
      {
        name: "🕌 Sholat Reminders",
        value:
          config?.sholat?.enabled &&
          config?.sholat?.channel &&
          config?.sholat?.role
            ? `
                    ✅ Configured
                    Channel: <#${config.sholat.channel}>
                    Role: <@&${config.sholat.role}>
                    Schedule: Automatic prayer times`
            : "❌ Not configured",
        inline: false,
      }
    )
    .setFooter({ text: "Powered by MENI" })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("config_welcome")
      .setLabel("Welcome System")
      .setStyle(
        config?.welcome?.channel ? ButtonStyle.Success : ButtonStyle.Primary
      )
      .setEmoji("🎯"),
    new ButtonBuilder()
      .setCustomId("config_moderation")
      .setLabel("Moderation")
      .setStyle(
        config?.moderation?.logsChannel
          ? ButtonStyle.Success
          : ButtonStyle.Primary
      )
      .setEmoji("🛡️"),
    new ButtonBuilder()
      .setCustomId("config_points")
      .setLabel("Points Feature")
      .setStyle(
        config?.points?.logsChannel ? ButtonStyle.Success : ButtonStyle.Primary
      )
      .setEmoji("☀️")
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("config_marketplace")
      .setLabel("Marketplace Feature")
      .setStyle(
        config?.points?.marketplace?.enabled
          ? ButtonStyle.Success
          : config?.points?.logsChannel
          ? ButtonStyle.Primary
          : ButtonStyle.Secondary
      )
      .setEmoji("💰")
      .setDisabled(!config?.points?.logsChannel),
    new ButtonBuilder()
      .setCustomId("config_presensi")
      .setLabel("Presensi Reminders")
      .setStyle(
        config?.presensi?.enabled &&
          config?.presensi?.channel &&
          config?.presensi?.role
          ? ButtonStyle.Success
          : ButtonStyle.Primary
      )
      .setEmoji("⏰"),
    new ButtonBuilder()
      .setCustomId("config_sholat")
      .setLabel("Sholat Reminders")
      .setStyle(
        config?.sholat?.enabled &&
          config?.sholat?.channel &&
          config?.sholat?.role
          ? ButtonStyle.Success
          : ButtonStyle.Primary
      )
      .setEmoji("🕌")
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("config_reset")
      .setLabel("Reset All")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🗑️")
  );

  return {
    embed: configEmbed,
    components: [row1, row2, row3],
  };
}

export async function showMainConfigPanel(
  interaction: ButtonInteraction,
  additionalMessage?: string
) {
  const panel = await createMainConfigPanel(interaction);
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
