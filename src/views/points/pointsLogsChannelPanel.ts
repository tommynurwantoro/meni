import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChannelSelectMenuBuilder,
} from "discord.js";

export async function showPointsLogsChannelPanel(interaction: ButtonInteraction) {
  const embed = new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle("📊 Select Points Logs Channel")
    .setDescription(
      "Please select the channel where points logs will be sent.\n\n" +
      "**How it works:**\n" +
      "• Bot will log all points transactions to this channel\n" +
      "• Users can see their points history and transactions\n" +
      "• Only enabled servers will have points logging"
    )
    .setFooter({ text: "Powered by BULLSTER" })
    .setTimestamp();

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`points_logs_channel_select`)
      .setPlaceholder("Select channel for points logs")
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
