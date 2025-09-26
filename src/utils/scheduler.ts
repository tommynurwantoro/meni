import * as cron from "node-cron";
import { Client } from "discord.js";
import { sendPresensiRemindersToAllGuilds } from "./presensiUtils";

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

  console.log("✅ Scheduler initialized successfully");
  console.log("📅 Morning reminders: 07:55 (Monday-Friday)");
  console.log("📅 Evening reminders: 17:05 (Monday-Friday)");
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): string {
  const tasks = cron.getTasks();
  const taskCount = Object.keys(tasks).length;
  
  return `Scheduler Status: ${taskCount} active tasks\n` +
         `- Morning presensi: 07:55 (Mon-Fri)\n` +
         `- Evening presensi: 17:05 (Mon-Fri)`;
}
