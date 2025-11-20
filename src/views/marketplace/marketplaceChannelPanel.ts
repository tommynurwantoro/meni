import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChannelSelectMenuBuilder,
} from "discord.js";

export async function showMarketplaceChannelPanel(interaction: ButtonInteraction) {
  const embed = new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle("📊 Select Marketplace Channel")
    .setDescription(
      "Please select the channel where users can buy items.\n\n" +
      "**How it works:**\n" +
      "• Bot will send marketplace panel to this channel\n" +
      "• Users can buy items from this channel\n" +
      "• Only enabled servers will have marketplace panel"
    )
    .setFooter({ text: "Powered by MENI" })
    .setTimestamp();

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`marketplace_channel`)
      .setPlaceholder("Select channel for marketplace")
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1)
  );

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("marketplace_back")
      .setLabel("Back")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("⬅️")
  );

  await interaction.update({
    embeds: [embed],
    components: [channelRow as any, buttonRow as any],
  });
}
