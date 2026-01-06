import { ButtonInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import { callAttendanceApi } from "../../utils/attendanceUtils";

export async function handleAttendanceButton(interaction: ButtonInteraction) {
  const { customId, user } = interaction;

  if (!customId.startsWith("attendance_")) {
    await interaction.reply({
      content: "❌ Unknown attendance button interaction",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const [action, guildId] = customId.replace("attendance_", "").split(":");

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

    await interaction.deferUpdate();

    try {
      const result = await callAttendanceApi(user.id, baseUrl, apiKey);
      
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
      console.error("❌ Error processing attendance button:", error);

      await interaction.editReply({
        content:
          "❌ Terjadi kesalahan tidak terduga saat memproses presensi. Silakan coba lagi nanti.",
        embeds: [],
        components: [],
      });
    }

    return;
  }

  await interaction.reply({
    content: "❌ Unknown attendance action.",
    flags: MessageFlags.Ephemeral,
  });
}

