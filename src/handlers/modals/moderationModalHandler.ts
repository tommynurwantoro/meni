import { ModalSubmitInteraction, MessageFlags } from "discord.js";
import { createLinkProtectionPanel } from "../../views/moderation/linkProtectionPanel";

/**
 * Handle link protection whitelist modal submission
 */
export async function handleLinkProtectionWhitelistModal(
  interaction: ModalSubmitInteraction,
  messageId: string
): Promise<void> {
  const { ConfigManager } = await import("../../utils/config");

  const domainsInput =
    interaction.fields.getTextInputValue("whitelist_domains");
  const descriptionInput = interaction.fields.getTextInputValue(
    "whitelist_description"
  );
  const guildId = interaction.guildId;
  if (!guildId) return;

  try {
    // Parse domains input (split by comma and clean up)
    const domains = domainsInput
      .split(",")
      .map((domain) => domain.trim())
      .filter((domain) => domain.length > 0)
      .map((domain) => domain.toLowerCase());

    // Update configuration with whitelist domains
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    const moderationConfig = currentConfig.moderation || {};

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      moderation: {
        ...moderationConfig,
        whitelistDomains: domains,
        linkProtection: true,
      },
    });

    const channel = interaction.channel;

    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(messageId);
      if (message) {
        const panel = createLinkProtectionPanel(guildId);
        await message.edit({
          embeds: [panel.embed],
          components: [panel.components[0] as any, panel.components[1] as any],
        });
        await interaction.reply({
          content: "✅ Link protection whitelist updated!",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } catch (error) {
    console.error("Error configuring link protection whitelist:", error);

    await interaction.reply({
      content: "❌ Failed to configure whitelist. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

