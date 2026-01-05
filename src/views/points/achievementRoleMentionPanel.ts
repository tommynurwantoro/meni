import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
} from "discord.js";

export async function showAchievementRoleMentionPanel(interaction: ButtonInteraction) {
  const embed = new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle("🏆 Select Achievement Role Mention")
    .setDescription(
      "Please select the role that will be mentioned when achievements are awarded.\n\n" +
      "**How it works:**\n" +
      "• This role will be mentioned in achievement announcements\n" +
      "• Choose a role that should be notified about achievements\n" +
      "• The role will be pinged in the points logs channel"
    )
    .setFooter({ text: "Powered by MENI" })
    .setTimestamp();

  const roleRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`achievement_role_mention`)
      .setPlaceholder("Select role to mention in achievement announcements")
      .setMinValues(1)
      .setMaxValues(1)
  );

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("points_back")
      .setLabel("Back")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("⬅️")
  );

  await interaction.update({
    embeds: [embed],
    components: [roleRow as any, buttonRow as any],
  });
}

