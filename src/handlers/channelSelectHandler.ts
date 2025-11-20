import { ChannelSelectMenuInteraction, MessageFlags } from "discord.js";
import { ConfigManager } from "../utils/config";
import { createModerationConfigPanel } from "../views/moderation/moderationConfigPanel";
import { createMarketplaceConfigPanel } from "../views/marketplace/marketplaceConfigPanel";
import { createWelcomeConfigPanel } from "../views/welcome/welcomeConfigPanel";
import { createPointsConfigPanel } from "../views/points/pointsConfigPanel";
import { createPresensiConfigPanel } from "../views/presensi/presensiConfigPanel";
import { createSholatConfigPanel } from "../views/sholat/sholatConfigPanel";

export async function handleChannelSelect(
  interaction: ChannelSelectMenuInteraction
) {
  const customId = interaction.customId;

  switch (customId) {
    case "welcome_channel_select":
      await handleWelcomeChannel(interaction);
      break;
    case "points_logs_channel":
      await handlePointsLogsChannel(interaction);
      break;
    case "points_thanks_channel":
      await handlePointsThanksChannel(interaction);
      break;
    case "moderation_channel_select":
      await handleModerationLogsChannel(interaction);
      break;
    case "marketplace_channel_select":
      await handleMarketplaceChannelSelect(interaction);
      break;
    case "presensi_channel_select":
      await handlePresensiChannelSelect(interaction);
      break;
    case "sholat_channel_select":
      await handleSholatChannelSelect(interaction);
      break;
    default:
      await interaction.reply({
        content: "❌ Unknown channel selection",
        flags: MessageFlags.Ephemeral,
      });
  }
}

async function handleWelcomeChannel(interaction: ChannelSelectMenuInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const selectedChannel = interaction.channels.first();

  try {
    // Update the configuration with the selected welcome channel
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      welcome: {
        channel: selectedChannel?.id,
        message: "Welcome to the server!",
      },
    });

    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(interaction.message.id);
      if (message) {
        const panel = createWelcomeConfigPanel(interaction.guildId!);

        await message.edit({
          embeds: [panel.embed],
          components: [panel.components[0] as any, panel.components[1] as any],
        });

        await interaction.reply({
          content: `✅ Welcome channel set to <#${selectedChannel?.id}>!`,
          flags: MessageFlags.Ephemeral,
        });

        return;
      }
    }
  } catch (error) {
    console.error("Error setting welcome channel:", error);
    await interaction.reply({
      content: "❌ Failed to set welcome channel. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handlePointsLogsChannel(
  interaction: ChannelSelectMenuInteraction
) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const selectedChannel = interaction.channels.first();
  if (!selectedChannel) {
    await interaction.reply({
      content: "❌ No channel selected. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    // Update the configuration with the selected logs channel
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      points: {
        ...currentConfig.points,
        logsChannel: selectedChannel.id,
      },
    });

    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(interaction.message.id);
      if (message) {
        const panel = await createPointsConfigPanel(interaction.guildId!);
        if (!panel) return;

        await message.edit({
          embeds: [panel.embed],
          components: [panel.components[0] as any, panel.components[1] as any],
        });

        await interaction.reply({
          content: `✅ Points logs channel set to <#${selectedChannel.id}>!`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } catch (error) {
    console.error("Error setting points logs channel:", error);
    await interaction.reply({
      content: "❌ Failed to set points logs channel. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handlePointsThanksChannel(
  interaction: ChannelSelectMenuInteraction
) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const selectedChannel = interaction.channels.first();
  if (!selectedChannel) {
    await interaction.reply({
      content: "❌ No channel selected. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    // Update the configuration with the selected thanks channel
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    const pointsConfig = currentConfig.points || {};

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      points: {
        ...pointsConfig,
        thanksChannel: selectedChannel?.id,
      },
    });

    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(interaction.message.id);
      if (message) {
        const panel = await createPointsConfigPanel(interaction.guildId!);
        if (!panel) return;

        await message.edit({
          embeds: [panel.embed],
          components: [panel.components[0] as any, panel.components[1] as any],
        });
      }
    }

    await interaction.reply({
      content: `✅ Thanks channel set to <#${selectedChannel?.id}>!`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  } catch (error) {
    console.error("Error setting thanks channel:", error);
    await interaction.reply({
      content: "❌ Failed to set thanks channel. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleMarketplaceChannelSelect(
  interaction: ChannelSelectMenuInteraction
) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const selectedChannel = interaction.channels.first();
  if (!selectedChannel) {
    await interaction.reply({
      content: "❌ No channel selected. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    // Update the configuration with the selected marketplace channel
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    const pointsConfig = currentConfig.points || {};

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      points: {
        ...pointsConfig,
        marketplace: {
          ...pointsConfig.marketplace,
          channel: selectedChannel.id,
        },
      },
    });

    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(interaction.message.id);
      if (message) {
        const panel = await createMarketplaceConfigPanel(interaction.guildId!);
        if (!panel) return;

        await message.edit({
          embeds: [panel.embed],
          components: [panel.components[0] as any, panel.components[1] as any],
        });
      }
    }

    await interaction.reply({
      content: `✅ Marketplace channel set to <#${selectedChannel.id}>!`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("Error setting marketplace channel:", error);
    await interaction.reply({
      content: "❌ Failed to set marketplace channel. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleModerationLogsChannel(
  interaction: ChannelSelectMenuInteraction
) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const selectedChannel = interaction.channels.first();
  if (!selectedChannel) {
    await interaction.reply({
      content: "❌ No channel selected. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    // Update the configuration with the selected moderation logs channel
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    const moderationConfig = currentConfig.moderation || {};

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      moderation: {
        ...moderationConfig,
        linkProtection: false,
        logsChannel: selectedChannel.id,
      },
    });

    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(interaction.message.id);
      if (message) {
        const panel = createModerationConfigPanel(interaction.guildId!);
        await message.edit({
          embeds: [panel.embed],
          components: [panel.components[0] as any, panel.components[1] as any],
        });
        await interaction.reply({
          content: `✅ Moderation logs channel set to <#${selectedChannel.id}>!`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } catch (error) {
    console.error("Error setting moderation logs channel:", error);
    await interaction.reply({
      content: "❌ Failed to set moderation logs channel. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handlePresensiChannelSelect(
  interaction: ChannelSelectMenuInteraction
) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const selectedChannel = interaction.channels.first();
  if (!selectedChannel) {
    await interaction.reply({
      content: "❌ No channel selected. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    // Update the configuration with the selected welcome channel
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    const presensiConfig = currentConfig.presensi || {};

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      presensi: {
        ...presensiConfig,
        channel: selectedChannel?.id,
      },
    });

    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(interaction.message.id);
      if (message) {
        const panel = await createPresensiConfigPanel(interaction.guildId!);
        if (!panel) return;

        await message.edit({
          embeds: [panel.embed],
          components: [panel.components[0] as any, panel.components[1] as any],
        });

        await interaction.reply({
          content: `✅ Presensi channel set to <#${selectedChannel?.id}>!`,
          flags: MessageFlags.Ephemeral,
        });

        return;
      }
    }
  } catch (error) {
    console.error("Error setting presensi channel:", error);
    await interaction.reply({
      content: "❌ Failed to set presensi channel. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleSholatChannelSelect(
  interaction: ChannelSelectMenuInteraction
) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const selectedChannel = interaction.channels.first();
  if (!selectedChannel) {
    await interaction.reply({
      content: "❌ No channel selected. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    // Update the configuration with the selected sholat channel
    const currentConfig = ConfigManager.getGuildConfig(guildId) || {};
    const sholatConfig = currentConfig.sholat || {};

    ConfigManager.updateGuildConfig(guildId, {
      ...currentConfig,
      sholat: {
        ...sholatConfig,
        channel: selectedChannel?.id,
      },
    });

    const channel = interaction.channel;
    if (channel && channel.isTextBased()) {
      const message = await channel.messages.fetch(interaction.message.id);
      if (message) {
        const panel = await createSholatConfigPanel(interaction.guildId!);
        if (!panel) return;

        await message.edit({
          embeds: [panel.embed],
          components: [panel.components[0] as any, panel.components[1] as any],
        });

        await interaction.reply({
          content: `✅ Sholat channel set to <#${selectedChannel?.id}>!`,
          flags: MessageFlags.Ephemeral,
        });

        return;
      }
    }
  } catch (error) {
    console.error("Error setting sholat channel:", error);
    await interaction.reply({
      content: "❌ Failed to set sholat channel. Please try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
