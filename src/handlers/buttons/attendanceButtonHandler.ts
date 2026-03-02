import {
  ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} from "discord.js";
import { showAttendanceWorkTypePanel } from "../../views/attendance/attendanceWorkTypePanel";
import { callAttendanceApi } from "../../utils/attendanceUtils";

export async function handleAttendanceButton(interaction: ButtonInteraction) {
  const { customId } = interaction;

  if (!customId.startsWith("attendance_")) {
    await interaction.reply({
      content: "❌ Unknown attendance button interaction",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Parse customId - format can be: attendance_action:guildId or attendance_action:guildId:channelId:messageId
  const parts = customId.replace("attendance_", "").split(":");
  const action = parts[0];
  const guildId = parts[1];
  const channelId = parts[2];
  const messageId = parts[3];

  if (!guildId) {
    await interaction.reply({
      content: "❌ Invalid attendance button data.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === "no") {
    await interaction.update({
      content: "✅ Baik, kamu memilih untuk **tidak** melakukan presensi sekarang.",
      embeds: [],
      components: [],
    });
    return;
  }

  if (action === "yes") {
    const baseUrl = process.env.ATTENDANCE_BASE_URL || "";
    const apiKey = process.env.ATTENDANCE_API_KEY || "";

    if (!baseUrl || !apiKey) {
      await interaction.reply({
        content:
          "❌ Attendance service belum dikonfigurasi dengan benar. Mohon hubungi admin server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Show WFH/WFO selection panel instead of modal
    await showAttendanceWorkTypePanel(interaction);
    return;
  }

  if (action === "wfo") {
    await handleAttendanceWFO(interaction, guildId, channelId, messageId);
    return;
  }

  if (action === "wfh") {
    await handleAttendanceWFH(interaction, guildId, channelId, messageId);
    return;
  }

  await interaction.reply({
    content: "❌ Unknown attendance action.",
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Handle WFO (Work From Office) attendance - call API with empty remark
 */
async function handleAttendanceWFO(
  interaction: ButtonInteraction,
  guildId: string,
  channelId: string | undefined,
  messageId: string | undefined
) {
  const baseUrl = process.env.ATTENDANCE_BASE_URL || "";
  const apiKey = process.env.ATTENDANCE_API_KEY || "";

  if (!baseUrl || !apiKey) {
    await interaction.reply({
      content:
        "❌ Attendance service belum dikonfigurasi dengan benar. Mohon hubungi admin server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!channelId || !messageId) {
    await interaction.reply({
      content: "❌ Invalid attendance button data.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // Call API with empty remark for WFO
    const result = await callAttendanceApi(
      interaction.user.id,
      baseUrl,
      apiKey,
      undefined
    );

    if (result.success && result.message) {
      const successEmbed = new EmbedBuilder()
        .setColor("#00B894")
        .setTitle("✅ Presensi Berhasil")
        .setDescription(result.message)
        .setFooter({ text: "Powered by MENI" })
        .setTimestamp();

      // Edit the original message to show success and remove buttons
      try {
        const channel = await interaction.client.channels.fetch(channelId);
        if (channel && "messages" in channel) {
          const originalMessage = await channel.messages.fetch(messageId);
          await originalMessage.edit({
            content: "✅ Presensi berhasil dikirim!",
            embeds: [successEmbed],
            components: [],
          });
        }
      } catch (editError) {
        console.error("⚠️ Could not edit original message:", editError);
        // Continue with reply even if edit fails
      }

      await interaction.editReply({
        content: "✅ Presensi berhasil dikirim!",
        embeds: [],
        components: [],
      });
    } else {
      const errorEmbed = new EmbedBuilder()
        .setColor("#E74C3C")
        .setTitle("❌ Presensi Gagal")
        .setDescription(
          result.error ||
            "Terjadi kesalahan saat menghubungi layanan presensi. Silakan coba lagi nanti."
        )
        .setFooter({ text: "Powered by MENI" })
        .setTimestamp();

      await interaction.editReply({
        content: "",
        embeds: [errorEmbed],
        components: [],
      });
    }
  } catch (error) {
    console.error("❌ Error processing WFO attendance:", error);

    await interaction.editReply({
      content:
        "❌ Terjadi kesalahan tidak terduga saat memproses presensi. Silakan coba lagi nanti.",
      embeds: [],
      components: [],
    });
  }
}

/**
 * Handle WFH (Work From Home) attendance - show remarks modal
 */
async function handleAttendanceWFH(
  interaction: ButtonInteraction,
  guildId: string,
  channelId: string | undefined,
  messageId: string | undefined
) {
  const baseUrl = process.env.ATTENDANCE_BASE_URL || "";
  const apiKey = process.env.ATTENDANCE_API_KEY || "";

  if (!baseUrl || !apiKey) {
    await interaction.reply({
      content:
        "❌ Attendance service belum dikonfigurasi dengan benar. Mohon hubungi admin server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!channelId || !messageId) {
    await interaction.reply({
      content: "❌ Invalid attendance button data.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Show modal for remarks input
  // Include message ID and channel ID in customId to edit the original message later
  const modal = new ModalBuilder()
    .setCustomId(
      `attendance_remarks_modal:${guildId}:${channelId}:${messageId}`
    )
    .setTitle("Presensi Remarks");

  const remarksInput = new TextInputBuilder()
    .setCustomId("attendance_remarks")
    .setLabel("Remarks")
    .setPlaceholder("Masukkan catatan untuk presensi ini...")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(200)
    .setRequired(true);

  const remarksActionRow =
    new ActionRowBuilder<TextInputBuilder>().addComponents(remarksInput);

  modal.addComponents(remarksActionRow);

  await interaction.showModal(modal);
}

