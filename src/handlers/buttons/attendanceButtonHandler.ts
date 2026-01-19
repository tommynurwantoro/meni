import {
  ButtonInteraction,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";

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

    // Show modal for remarks input
    const modal = new ModalBuilder()
      .setCustomId(`attendance_remarks_modal:${guildId}`)
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
    return;
  }

  await interaction.reply({
    content: "❌ Unknown attendance action.",
    flags: MessageFlags.Ephemeral,
  });
}

