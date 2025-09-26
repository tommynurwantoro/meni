import { Client, EmbedBuilder } from "discord.js";
import { ConfigManager } from "./config";

/**
 * Sends a presensi reminder to the configured channel
 */
export async function sendPresensiReminder(
  client: Client,
  guildId: string,
  reminderType: "morning" | "evening"
): Promise<void> {
  try {
    const guildConfig = ConfigManager.getGuildConfig(guildId);
    const presensiConfig = guildConfig?.presensi;

    // Check if presensi is enabled and configured
    if (!presensiConfig?.enabled || !presensiConfig.channel || !presensiConfig.role) {
      console.log(`Presensi not configured for guild ${guildId}`);
      return;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.log(`Guild ${guildId} not found`);
      return;
    }

    const channel = guild.channels.cache.get(presensiConfig.channel);
    if (!channel || !channel.isTextBased()) {
      console.log(`Channel ${presensiConfig.channel} not found or not text-based`);
      return;
    }

    // Create reminder message
    const timeText = reminderType === "morning" ? "07:55" : "17:05";
    const greeting = reminderType === "morning" ? "Selamat pagi" : "Selamat sore";
    const action = reminderType === "morning" ? "masuk" : "pulang";

    const embed = new EmbedBuilder()
      .setColor(reminderType === "morning" ? "#FFD700" : "#FF6B35")
      .setTitle(`⏰ Reminder Presensi ${timeText}`)
      .setDescription(
        `${greeting} <@&${presensiConfig.role}>!\n\n` +
        `Waktunya untuk presensi ${action} kerja.\n` +
        `Jangan lupa untuk melakukan presensi ya! 🕐`
      )
      .setFooter({
        text: "Powered by BULLSTER",
      })
      .setTimestamp();

    await channel.send({
      content: `<@&${presensiConfig.role}>`,
      embeds: [embed],
    });

    console.log(`Presensi reminder sent to guild ${guildId} for ${reminderType}`);
  } catch (error) {
    console.error(`Error sending presensi reminder to guild ${guildId}:`, error);
  }
}

/**
 * Gets all guilds with presensi enabled
 */
export function getGuildsWithPresensiEnabled(client: Client): string[] {
  const allConfigs = ConfigManager.loadConfig();
  const enabledGuilds: string[] = [];

  for (const [guildId, config] of Object.entries(allConfigs)) {
    if (config.presensi?.enabled && config.presensi?.channel && config.presensi?.role) {
      // Check if the guild is available
      if (client.guilds.cache.has(guildId)) {
        enabledGuilds.push(guildId);
      }
    }
  }

  return enabledGuilds;
}

/**
 * Sends presensi reminders to all configured guilds
 */
export async function sendPresensiRemindersToAllGuilds(
  client: Client,
  reminderType: "morning" | "evening"
): Promise<void> {
  const enabledGuilds = getGuildsWithPresensiEnabled(client);
  
  console.log(`Sending ${reminderType} presensi reminders to ${enabledGuilds.length} guilds`);
  
  // Send reminders to all enabled guilds
  const promises = enabledGuilds.map(guildId => 
    sendPresensiReminder(client, guildId, reminderType)
  );
  
  await Promise.allSettled(promises);
}
