import { ModalSubmitInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import { callAttendanceApi } from "../../utils/attendanceUtils";

/**
 * Handle attendance remarks modal submission
 */
export async function handleAttendanceRemarksModal(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const { customId, user } = interaction;
  const client = interaction.client;

  // Extract guildId, channelId, and messageId from customId
  // Format: attendance_remarks_modal:guildId:channelId:messageId
  const [, guildId, channelId, messageId] = customId.split(":");

  if (!guildId || !channelId || !messageId) {
    await interaction.reply({
      content: "❌ Invalid attendance modal data.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

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

  // Get remarks from modal input
  const remarks = interaction.fields.getTextInputValue("attendance_remarks");

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const result = await callAttendanceApi(user.id, baseUrl, apiKey, remarks);

    if (result.success && result.message) {
      const successEmbed = new EmbedBuilder()
        .setColor("#00B894")
        .setTitle("✅ Presensi Berhasil")
        .setDescription(result.message)
        .setFooter({ text: "Powered by MENI" })
        .setTimestamp();

      // Edit the original message to show success and remove buttons
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel && 'messages' in channel) {
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
    console.error("❌ Error processing attendance modal:", error);

    await interaction.editReply({
      content:
        "❌ Terjadi kesalahan tidak terduga saat memproses presensi. Silakan coba lagi nanti.",
      embeds: [],
      components: [],
    });
  }
}
