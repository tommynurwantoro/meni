import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
} from "discord.js";

export async function showSholatRolePanel(interaction: ButtonInteraction) {
  const embed = new EmbedBuilder()
    .setColor("#00BFFF")
    .setTitle("👥 Select Sholat Reminder Role")
    .setDescription(
      "Please select the role that will be mentioned in sholat reminders.\n\n" +
        "**How it works:**\n" +
        "• This role will be mentioned in prayer time reminders\n" +
        "• Choose a role that includes all Muslims in your server\n" +
        "• You can create a specific role for prayer reminders"
    )
    .setFooter({ text: "Powered by BULLSTER" })
    .setTimestamp();

  const roleRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`sholat_role_select`)
      .setPlaceholder("Select role for sholat reminders notification")
      .setMinValues(1)
      .setMaxValues(1)
  );

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("sholat_role_back")
      .setLabel("Back")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("⬅️")
  );

  await interaction.update({
    embeds: [embed],
    components: [roleRow as any, buttonRow as any],
  });
}
