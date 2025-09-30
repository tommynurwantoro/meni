import { Client, EmbedBuilder } from "discord.js";
import { ConfigManager } from "./config";
import { redisManager } from "./redis";

interface PrayerTime {
  name: string;
  time: string;
}

interface SholatSchedule {
  date: string;
  prayers: PrayerTime[];
}

/**
 * Fetches prayer times from the API
 */
export async function fetchPrayerTimes(): Promise<SholatSchedule | null> {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    // Construct API URL with year/month structure
    const apiUrl = `https://raw.githubusercontent.com/lakuapik/jadwalsholatorg/master/adzan/yogyakarta/${year}/${month}.json`;
    
    console.log(`Fetching prayer times from: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse the API response and extract today's prayer times
    const todayStr = `${year}-${month}-${day}`; // YYYY-MM-DD format
    
    // Find today's schedule in the response
    const todaySchedule = data.find((schedule: any) => schedule.tanggal === todayStr);
    
    if (!todaySchedule) {
      console.log(`No prayer schedule found for ${todayStr}`);
      return null;
    }
    
    // Convert the API response format to our expected format
    const prayers = [
      { name: "Dzuhur", time: todaySchedule.dzuhur },
      { name: "Ashar", time: todaySchedule.ashr },
    ];
    
    return {
      date: todaySchedule.tanggal,
      prayers: prayers
    };
  } catch (error) {
    console.error('Error fetching prayer times:', error);
    return null;
  }
}

/**
 * Sends a sholat reminder to the configured channel
 */
export async function sendSholatReminder(
  client: Client,
  guildId: string,
  prayerName: string,
  prayerTime: string
): Promise<void> {
  try {
    const guildConfig = ConfigManager.getGuildConfig(guildId);
    const sholatConfig = guildConfig?.sholat;

    // Check if sholat is enabled and configured
    if (!sholatConfig?.enabled || !sholatConfig.channel || !sholatConfig.role) {
      console.log(`Sholat not configured for guild ${guildId}`);
      return;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.log(`Guild ${guildId} not found`);
      return;
    }

    const channel = guild.channels.cache.get(sholatConfig.channel);
    if (!channel || !channel.isTextBased()) {
      console.log(`Channel ${sholatConfig.channel} not found or not text-based`);
      return;
    }

    // Create reminder message
    const embed = new EmbedBuilder()
      .setColor("#00BFFF")
      .setTitle(`🕌 Waktu Sholat ${prayerName}`)
      .setDescription(
        `Assalamu'alaikum <@&${sholatConfig.role}>!\n\n` +
        `Waktunya untuk melaksanakan sholat **${prayerName}**\n` +
        `⏰ **${prayerTime}**\n\n` +
        `Jangan lupa untuk melaksanakan sholat ya! 🤲`
      )
      .setFooter({
        text: "Powered by MENI",
      })
      .setTimestamp();

    await channel.send({
      content: `<@&${sholatConfig.role}>`,
      embeds: [embed],
    });

    console.log(`Sholat reminder sent to guild ${guildId} for ${prayerName}`);
  } catch (error) {
    console.error(`Error sending sholat reminder to guild ${guildId}:`, error);
  }
}

/**
 * Gets all guilds with sholat enabled
 */
export function getGuildsWithSholatEnabled(client: Client): string[] {
  const allConfigs = ConfigManager.loadConfig();
  const enabledGuilds: string[] = [];

  for (const [guildId, config] of Object.entries(allConfigs)) {
    if (config.sholat?.enabled && config.sholat?.channel && config.sholat?.role) {
      // Check if the guild is available
      if (client.guilds.cache.has(guildId)) {
        enabledGuilds.push(guildId);
      }
    }
  }

  return enabledGuilds;
}

/**
 * Checks if current time matches any prayer time and sends reminders
 */
export async function checkAndSendSholatReminders(client: Client): Promise<void> {
  try {
    // First try to get schedule from Redis
    let prayerSchedule = await redisManager.getTodayPrayerSchedule();
    
    // If not in Redis, fetch from API and store it
    if (!prayerSchedule) {
      console.log('No prayer schedule in Redis, fetching from API...');
      prayerSchedule = await fetchPrayerTimes();
      if (prayerSchedule) {
        await redisManager.storePrayerSchedule(prayerSchedule);
      }
    }

    if (!prayerSchedule) {
      console.log('No prayer schedule available');
      return;
    }

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    const today = now.toISOString().split('T')[0];
    
    console.log(`Checking prayer times at ${currentTime}`);

    // Check each prayer time
    for (const prayer of prayerSchedule.prayers) {
      if (prayer.time === currentTime) {
        // Check if we already sent this reminder today
        const alreadySent = await redisManager.wasPrayerTimeSent(prayer.name, today);
        if (alreadySent) {
          console.log(`🕌 ${prayer.name} reminder already sent today`);
          continue;
        }

        console.log(`🕌 Time for ${prayer.name} prayer!`);
        
        const enabledGuilds = getGuildsWithSholatEnabled(client);
        
        // Send reminders to all enabled guilds
        const promises = enabledGuilds.map(guildId => 
          sendSholatReminder(client, guildId, prayer.name, prayer.time)
        );
        
        await Promise.allSettled(promises);
        
        // Mark as sent to avoid duplicates
        await redisManager.markPrayerTimeSent(prayer.name, today);
      }
    }
  } catch (error) {
    console.error('Error checking prayer times:', error);
  }
}

/**
 * Updates daily prayer schedule and stores in Redis
 */
export async function updateDailyPrayerSchedule(): Promise<void> {
  try {
    const prayerSchedule = await fetchPrayerTimes();
    if (!prayerSchedule) {
      console.log('Failed to fetch prayer schedule for today');
      return;
    }

    // Store today's schedule in Redis
    const stored = await redisManager.storePrayerSchedule(prayerSchedule);
    if (stored) {
      console.log('📅 Daily prayer schedule updated and stored in Redis:', prayerSchedule);
    } else {
      console.log('❌ Failed to store prayer schedule in Redis');
    }
    
  } catch (error) {
    console.error('Error updating daily prayer schedule:', error);
  }
}