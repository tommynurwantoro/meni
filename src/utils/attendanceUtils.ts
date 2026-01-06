import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GuildMember,
} from "discord.js";
import axios, { AxiosError } from "axios";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

/**
 * API response structure for successful attendance clock-in
 */
interface AttendanceApiResponse {
  status: string;
  message: string;
}

/**
 * Individual user attendance result
 */
interface AttendanceResult {
  discordId: string;
  username: string;
  status: "success" | "failed";
  error?: string;
}

/**
 * Complete attendance report structure
 */
export interface AttendanceReport {
  date: string; // YYYY-MM-DD format
  timestamp: string; // ISO timestamp
  guildId: string;
  totalOnlineUsers: number;
  checkedInUsers: number;
  failedUsers: number;
  results: AttendanceResult[];
}

/**
 * Call attendance API for a single user
 */
export async function callAttendanceApi(
  discordId: string,
  baseUrl: string,
  apiKey: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const response = await axios.post<AttendanceApiResponse>(
      baseUrl,
      {
        discord_id: discordId,
      },
      {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout
      }
    );

    if (response.status === 200 && response.data.status === "00") {
      return {
        success: true,
        message: response.data.message,
      };
    } else {
      return {
        success: false,
        error: `API returned status ${response.status} but success was false`,
      };
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      let errorMessage = axiosError.message || "Unknown error occurred";

      // Provide more specific error messages
      if (axiosError.response?.status === 401) {
        errorMessage = "Authentication failed with attendance API";
      } else if (axiosError.response?.status === 404) {
        errorMessage = "Attendance API endpoint not found";
      } else if (axiosError.response?.status === 500) {
        errorMessage = "Attendance API server error";
      } else if (axiosError.code === "ECONNABORTED") {
        errorMessage = "Request to attendance API timed out";
      } else if (axiosError.code === "ENOTFOUND" || axiosError.code === "ECONNREFUSED") {
        errorMessage = "Could not connect to attendance API";
      } else if (axiosError.response?.status) {
        errorMessage = `API returned status ${axiosError.response.status}`;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Get all online members from a Discord guild
 */
async function getOnlineMembers(
  client: Client,
  guildId: string
): Promise<GuildMember[]> {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.log(`⚠️ Guild ${guildId} not found`);
      return [];
    }

    // Fetch all members to ensure we have presence data
    // This may take a while for large servers, but it's necessary to get accurate presence
    console.log(`📥 Fetching members for guild ${guildId}...`);
    const members = await guild.members.fetch();

    // Filter members who are online
    const onlineMembers = members
      .filter((member) => {
        // Check if member is online (not offline, idle, dnd, or invisible)
        const presence = member.presence;
        return presence?.status === "online";
      })
      .map((member) => member);

    console.log(
      `✅ Found ${onlineMembers.length} online members out of ${members.size} total members`
    );
    return Array.from(onlineMembers.values());
  } catch (error) {
    console.error(`❌ Error fetching members for guild ${guildId}:`, error);
    return [];
  }
}

/**
 * Save attendance report to JSON file
 */
async function saveReport(report: AttendanceReport): Promise<void> {
  try {
    // Ensure reports directory exists
    const reportsDir = join(process.cwd(), "reports");
    try {
      await mkdir(reportsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }

    // Create filename with date
    const filename = `attendance-${report.date}.json`;
    const filepath = join(reportsDir, filename);

    // Write report to file
    await writeFile(filepath, JSON.stringify(report, null, 2), "utf-8");
    console.log(`✅ Attendance report saved to ${filepath}`);
  } catch (error) {
    console.error(`❌ Error saving attendance report:`, error);
    throw error;
  }
}

/**
 * Check attendance for all online users in a Discord guild
 */
export async function checkAttendanceForOnlineUsers(
  client: Client,
  guildId: string,
  baseUrl: string,
  apiKey: string
): Promise<AttendanceReport | null> {
  try {
    console.log(`🕐 Starting attendance check for guild ${guildId}`);

    // Get online members
    const onlineMembers = await getOnlineMembers(client, guildId);

    if (onlineMembers.length === 0) {
      console.log(`⚠️ No online members found in guild ${guildId}`);
      return null;
    }

    // Initialize report
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD format
    const report: AttendanceReport = {
      date: dateStr,
      timestamp: now.toISOString(),
      guildId: guildId,
      totalOnlineUsers: onlineMembers.length,
      checkedInUsers: 0,
      failedUsers: 0,
      results: [],
    };

    // Process each online member
    console.log(`🔄 Processing ${onlineMembers.length} online users...`);

    for (const member of onlineMembers) {
      const discordId = member.id;
      const username = member.user.tag;

      try {
        // Call attendance API
        const result = await callAttendanceApi(discordId, baseUrl, apiKey);

        if (result.success && result.message) {
          report.results.push({
            discordId,
            username,
            status: "success",
          });
          report.checkedInUsers++;
          console.log(`✅ Checked in: ${username} (${discordId})`);
        } else {
          report.results.push({
            discordId,
            username,
            status: "failed",
            error: result.error || "Unknown error",
          });
          report.failedUsers++;
          console.log(
            `❌ Failed to check in: ${username} (${discordId}) - ${result.error}`
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        report.results.push({
          discordId,
          username,
          status: "failed",
          error: errorMessage,
        });
        report.failedUsers++;
        console.error(
          `❌ Error processing ${username} (${discordId}):`,
          error
        );
      }
    }

    // Save report to file
    await saveReport(report);

    // Log summary
    console.log(`📊 Attendance check completed:`);
    console.log(`   Total online users: ${report.totalOnlineUsers}`);
    console.log(`   ✅ Successful: ${report.checkedInUsers}`);
    console.log(`   ❌ Failed: ${report.failedUsers}`);

    return report;
  } catch (error) {
    console.error(`❌ Error checking attendance for guild ${guildId}:`, error);
    return null;
  }
}

/**
 * Send attendance prompt DMs to all online users in a Discord guild.
 * Users can choose whether they want to check in.
 */
export async function promptAttendanceForOnlineUsers(
  client: Client,
  guildId: string
): Promise<void> {
  try {
    console.log(`🕐 Starting attendance prompt for guild ${guildId}`);

    const onlineMembers = await getOnlineMembers(client, guildId);

    if (onlineMembers.length === 0) {
      console.log(`⚠️ No online members found in guild ${guildId} for attendance prompt`);
      return;
    }

    console.log(`📨 Sending attendance prompt to ${onlineMembers.length} users...`);

    const promptEmbed = new EmbedBuilder()
      .setColor("#00B894")
      .setTitle("⏰ Attendance Reminder")
      .setDescription(
          "Apakah kamu ingin melakukan **presensi masuk** sekarang?\n\n" +
          "Klik **Yes** untuk melakukan presensi, atau **No** jika tidak ingin."
      )
      .setFooter({ text: "Powered by MENI" })
      .setTimestamp();

    const components = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`attendance_yes:${guildId}`)
        .setLabel("Yes")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`attendance_no:${guildId}`)
        .setLabel("No")
        .setStyle(ButtonStyle.Secondary)
    );

    for (const member of onlineMembers) {
      if (member.user.bot) continue;
      try {
        await member.send({
          embeds: [promptEmbed],
          components: [components],
        });
        console.log(`📨 Attendance prompt sent to ${member.user.tag} (${member.id})`);
      } catch (error) {
        console.error(
          `❌ Failed to send attendance prompt DM to ${member.user.tag} (${member.id})`,
          error
        );
      }
    }
  } catch (error) {
    console.error(`❌ Error sending attendance prompts for guild ${guildId}:`, error);
  }
}


