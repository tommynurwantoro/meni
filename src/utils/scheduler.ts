import * as cron from "node-cron";
import { Client } from "discord.js";
import { sendPresensiRemindersToAllGuilds } from "./presensiUtils";
import { checkAndSendSholatReminders, updateDailyPrayerSchedule } from "./sholatUtils";
import { checkAndSendReminders } from "./reminderUtils";
import { promptAttendanceForOnlineUsers } from "./attendanceUtils";

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

  // Merged check for prayer times and user reminders every minute
  // Cron: * * * * * (every minute)
  cron.schedule("* * * * *", async () => {
    await checkAndSendSholatReminders(client);
    await checkAndSendReminders(client);
  }, {
    timezone: "Asia/Jakarta"
  });

  if (process.env.ATTENDANCE_ENABLED === "true") {
    const schedule = process.env.ATTENDANCE_TIME || "09:00";
    // convert schedule HH:mm to cron expression mm HH * * 1-5
    // 09:30 -> 30 9 * * 1-5
    // 09 to 9
    const hours = schedule.split(":")[0].replace(/^0/, ""); // remove leading 0
    const minutes = schedule.split(":")[1].replace(/^0/, ""); // remove leading 0
    const cronExpression = `${minutes} ${hours} * * 1-5`;

    // Attendance clock-in check (Monday to Friday)
    cron.schedule(cronExpression, async () => {
      console.log("🕐 Attendance clock-in check triggered");
      const guildId = process.env.ATTENDANCE_GUILD_ID;
      if (!guildId) {
        console.log("⚠️ ATTENDANCE_GUILD_ID not set in environment variables");
        return;
      }
      const baseUrl = process.env.ATTENDANCE_BASE_URL || "";
      if (!baseUrl) {
        console.log("⚠️ ATTENDANCE_BASE_URL not set in environment variables");
        return;
      }
      await promptAttendanceForOnlineUsers(client, guildId, "in");
    }, {
      timezone: "Asia/Jakarta"
    });

    const outSchedule = process.env.ATTENDANCE_OUT_TIME || "17:05";
    const outHours = outSchedule.split(":")[0].replace(/^0/, "");
    const outMinutes = outSchedule.split(":")[1].replace(/^0/, "");
    const outCronExpression = `${outMinutes} ${outHours} * * 1-5`;

    // Attendance clock-out check (Monday to Friday)
    cron.schedule(outCronExpression, async () => {
      console.log("🕐 Attendance clock-out check triggered");
      const guildId = process.env.ATTENDANCE_GUILD_ID;
      if (!guildId) {
        console.log("⚠️ ATTENDANCE_GUILD_ID not set in environment variables");
        return;
      }
      const baseUrl = process.env.ATTENDANCE_BASE_URL || "";
      if (!baseUrl) {
        console.log("⚠️ ATTENDANCE_BASE_URL not set in environment variables");
        return;
      }
      await promptAttendanceForOnlineUsers(client, guildId, "out");
    }, {
      timezone: "Asia/Jakarta"
    });
  }

  console.log("✅ Scheduler initialized successfully");
  console.log("📅 Morning reminders: 07:55 (Monday-Friday)");
  console.log("📅 Evening reminders: 17:05 (Monday-Friday)");
  console.log("🕌 Prayer reminders: Every minute check");
  console.log("⏰ User reminders: Every minute check");
  console.log("📅 Prayer schedule update: 00:01 daily");
  if (process.env.ATTENDANCE_ENABLED === "true") {
    console.log(`🕐 Attendance clock-in check: ${process.env.ATTENDANCE_TIME || "09:00"} (Monday-Friday)`);
    console.log(`🕐 Attendance clock-out check: ${process.env.ATTENDANCE_OUT_TIME || "17:05"} (Monday-Friday)`);
  }
}
