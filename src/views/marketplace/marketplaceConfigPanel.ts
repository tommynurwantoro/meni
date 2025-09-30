import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { ConfigManager } from "../../utils/config";

export async function createMarketplaceConfigPanel(guildId: string) {
  if (!guildId) return null;

  const config = ConfigManager.getGuildConfig(guildId);
  const pointsConfig = config?.points;

  const configEmbed = new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle("🏦 Marketplace System Configuration")
    .setDescription(
      "Configure the marketplace for your server.\n\n" +
      "**Features:**\n" +
      "• Marketplace channel for buying items\n" +
      "• Marketplace stock for selling items\n\n" +
      "**Current Configuration:**"
    )
    .addFields(
      {
        name: "📊 Marketplace Channel",
        value: pointsConfig?.marketplace?.channel
          ? `<#${pointsConfig.marketplace.channel}>`
          : "❌ Not set",
        inline: true,
      },
      {
        name: "🔧 Status",
        value: pointsConfig?.marketplace?.enabled ? "✅ Enabled" : "❌ Disabled",
        inline: true,
      }
    )
    .setFooter({ text: "Powered by MENI" })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("marketplace_channel")
      .setLabel("Set Marketplace Channel")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📊"),
    new ButtonBuilder()
      .setCustomId("marketplace_stock")
      .setLabel("Set Marketplace Stock")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📦")
      .setDisabled(!pointsConfig?.marketplace?.channel),
    new ButtonBuilder()
      .setCustomId("marketplace_send_panel")
      .setLabel("Send Marketplace Panel")
      .setStyle(ButtonStyle.Success)
      .setEmoji("📢")
      .setDisabled(!pointsConfig?.marketplace?.channel),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("marketplace_toggle")
      .setLabel(pointsConfig?.marketplace?.enabled ? "Disable" : "Enable")
      .setStyle(pointsConfig?.marketplace?.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
      .setEmoji(pointsConfig?.marketplace?.enabled ? "❌" : "✅")
      .setDisabled(!pointsConfig?.marketplace?.channel),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("main_back")
      .setLabel("Back to Main")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("⬅️")
  );

  return {
    embed: configEmbed,
    components: [row1, row2, row3],
  };
}

export async function showMarketplaceConfigPanel(
  interaction: ButtonInteraction,
  additionalMessage?: string
) {
  const panel = await createMarketplaceConfigPanel(interaction.guildId!);
  if (!panel) return;

  await interaction.update({
    content: additionalMessage || "",
    embeds: [panel.embed],
    components: [
      panel.components[0] as any,
      panel.components[1] as any,
      panel.components[2] as any,
    ],
  });
}
