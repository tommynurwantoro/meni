import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
} from "discord.js";

export async function showAchievementRoleUserPanel(interaction: ButtonInteraction) {
  const embed = new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle("👤 Select Achievement Role User")
    .setDescription(
      "Please select the role that can use the `/achievement` command.\n\n" +
      "**How it works:**\n" +
      "• Only users with this role can award achievements\n" +
      "• Choose a role for administrators or moderators\n" +
      "• This role controls who can use the achievement command"
    )
    .setFooter({ text: "Powered by MENI" })
    .setTimestamp();

  const roleRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`achievement_role_user`)
      .setPlaceholder("Select role that can use achievement command")
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

