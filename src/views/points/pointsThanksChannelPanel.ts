import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChannelSelectMenuBuilder,
} from "discord.js";

export async function showPointsThanksChannelPanel(interaction: ButtonInteraction) {
  const embed = new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle("🙏 Select Thanks Channel")
    .setDescription(
      "Please select the channel where users can give thanks and earn points.\n\n" +
      "**How it works:**\n" +
      "• Bot will send thanks panel to this channel\n" +
      "• Users can give thanks to others in this channel\n" +
      "• Only enabled servers will have thanks panel"
    )
    .setFooter({ text: "Powered by MENI" })
    .setTimestamp();

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`points_thanks_channel`)
      .setPlaceholder("Select channel for thanks and points")
      .setChannelTypes(ChannelType.GuildText)
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
    components: [channelRow as any, buttonRow as any],
  });
}
