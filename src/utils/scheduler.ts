import * as cron from "node-cron";
import { Client } from "discord.js";
import { sendPresensiRemindersToAllGuilds } from "./presensiUtils";
import { checkAndSendSholatReminders, updateDailyPrayerSchedule } from "./sholatUtils";
import { checkAndSendReminders } from "./reminderUtils";

/**
 * Initialize all scheduled tasks
 */
export function initializeScheduler(client: Client): void {
  console.log("🕐 Initializing scheduler...");

  // Morning presensi reminder at 07:55 (Monday to Friday)
  // Cron: 55 7 * * 1-5 (55 minutes, 7 hours, any day of month, Monday to Friday)
  cron.schedule("55 7 * * 1-5", async () => {
    console.log("🌅 Morning presensi reminder triggered");
    await sendPresensiRemindersToAllGuilds(client, "morning");
  }, {
    timezone: "Asia/Jakarta" // Adjust timezone as needed
  });

  // Evening presensi reminder at 17:05 (Monday to Friday)
  // Cron: 5 17 * * 1-5 (5 minutes, 17 hours, any day of month, Monday to Friday)
  cron.schedule("5 17 * * 1-5", async () => {
    console.log("🌆 Evening presensi reminder triggered");
    await sendPresensiRemindersToAllGuilds(client, "evening");
  }, {
    timezone: "Asia/Jakarta" // Adjust timezone as needed
  });

  // Daily prayer schedule update at 00:01
  // Cron: 1 0 * * * (1 minute, 0 hours, any day of month, any month, any day of week)
  cron.schedule("1 0 * * *", async () => {
    console.log("📅 Updating daily prayer schedule");
    await updateDailyPrayerSchedule();
  }, {
    timezone: "Asia/Jakarta"
  });

  // Check prayer times every minute
  // Cron: * * * * * (every minute)
  cron.schedule("* * * * *", async () => {
    await checkAndSendSholatReminders(client);
  }, {
    timezone: "Asia/Jakarta"
  });

  // Check user reminders every minute
  // Cron: * * * * * (every minute)
  cron.schedule("* * * * *", async () => {
    await checkAndSendReminders(client);
  }, {
    timezone: "Asia/Jakarta"
  });

  console.log("✅ Scheduler initialized successfully");
  console.log("📅 Morning reminders: 07:55 (Monday-Friday)");
  console.log("📅 Evening reminders: 17:05 (Monday-Friday)");
  console.log("🕌 Prayer reminders: Every minute check");
  console.log("⏰ User reminders: Every minute check");
  console.log("📅 Prayer schedule update: 00:01 daily");
}
