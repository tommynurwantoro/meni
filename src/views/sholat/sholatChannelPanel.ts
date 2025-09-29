import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChannelSelectMenuBuilder,
} from "discord.js";

export async function showSholatChannelPanel(interaction: ButtonInteraction) {
  const embed = new EmbedBuilder()
    .setColor("#00BFFF")
    .setTitle("📢 Select Sholat Reminder Channel")
    .setDescription(
      "Please select the channel where sholat reminders will be sent.\n\n" +
        "**How it works:**\n" +
        "• Bot will send prayer time reminders to this channel\n" +
        "• Reminders are sent automatically based on prayer times\n" +
        "• Only enabled servers will receive reminders"
    )
    .setFooter({ text: "Powered by BULLSTER" })
    .setTimestamp();

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`sholat_channel_select`)
      .setPlaceholder("Select channel for sholat messages")
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1)
  );

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("sholat_back")
      .setLabel("Back")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("⬅️")
  );

  await interaction.update({
    embeds: [embed],
    components: [channelRow as any, buttonRow as any],
  });
}
