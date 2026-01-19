import { ModalSubmitInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import { callAttendanceApi } from "../../utils/attendanceUtils";

/**
 * Handle attendance remarks modal submission
 */
export async function handleAttendanceRemarksModal(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const { customId, user } = interaction;

  // Extract guildId from customId (format: attendance_remarks_modal:guildId)
  const [, guildId] = customId.split(":");

  if (!guildId) {
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

      await interaction.editReply({
        content: "",
        embeds: [successEmbed],
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
