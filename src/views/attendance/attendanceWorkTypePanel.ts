import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";

/**
 * Create WFH/WFO selection panel for attendance
 */
export function createAttendanceWorkTypePanel(
  guildId: string,
  channelId: string,
  messageId: string
) {
  const embed = new EmbedBuilder()
    .setColor("#00B894")
    .setTitle("🏢 Pilih Tipe Kerja")
    .setDescription(
      "Silakan pilih tipe kerja untuk presensi ini:\n\n" +
      "**WFO (Work From Office)** - Bekerja dari kantor\n" +
      "**WFH (Work From Home)** - Bekerja dari rumah"
    )
    .setFooter({ text: "Powered by MENI" })
    .setTimestamp();

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`attendance_wfo:${guildId}:${channelId}:${messageId}`)
      .setLabel("WFO")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🏢"),
    new ButtonBuilder()
      .setCustomId(`attendance_wfh:${guildId}:${channelId}:${messageId}`)
      .setLabel("WFH")
      .setStyle(ButtonStyle.Success)
      .setEmoji("🏠")
  );

  return {
    embed,
    components: [buttonRow],
  };
}

/**
 * Show WFH/WFO selection panel
 */
export async function showAttendanceWorkTypePanel(
  interaction: ButtonInteraction
) {
  if (!interaction.channelId || !interaction.message.id) {
    await interaction.reply({
      content: "❌ Invalid attendance button data.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Extract guildId from customId (format: attendance_yes:guildId)
  const { customId } = interaction;
  const parts = customId.replace("attendance_", "").split(":");
  const guildId = parts[1];

  if (!guildId) {
    await interaction.reply({
      content: "❌ Invalid attendance button data.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const panel = createAttendanceWorkTypePanel(
    guildId,
    interaction.channelId,
    interaction.message.id
  );

  await interaction.update({
    embeds: [panel.embed],
    components: [panel.components[0] as any],
  });
}
