import { Client, TextChannel } from 'discord.js';
import { ConfigManager, Reminder } from './config';

/**
 * Check and send reminders that match the current time
 * This function should be called every minute by the cron job
 */
export async function checkAndSendReminders(client: Client): Promise<void> {
    try {
        // Get current time in Jakarta timezone
        const now = new Date();
        const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const currentHour = jakartaTime.getHours();
        const currentMinute = jakartaTime.getMinutes();
        const currentDayOfWeek = jakartaTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

        // Format current time as HH:mm
        const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

        // Get all reminders from all guilds
        const allReminders = ConfigManager.getAllReminders();

        for (const [guildId, reminders] of allReminders.entries()) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                console.log(`⚠️ Guild ${guildId} not found, skipping reminders`);
                continue;
            }

            for (const reminder of reminders) {
                // Check if time matches
                if (reminder.time !== currentTime) {
                    continue;
                }

                // Check if day of week matches (if daysOfWeek is specified)
                if (reminder.daysOfWeek && reminder.daysOfWeek.length > 0) {
                    if (!reminder.daysOfWeek.includes(currentDayOfWeek)) {
                        continue;
                    }
                }

                // Time and day match, send the reminder
                await sendReminder(client, guildId, reminder);
            }
        }
    } catch (error) {
        console.error('❌ Error checking reminders:', error);
    }
}

/**
 * Send a reminder message
 */
async function sendReminder(client: Client, guildId: string, reminder: Reminder): Promise<void> {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            console.log(`⚠️ Guild ${guildId} not found, cannot send reminder "${reminder.name}"`);
            return;
        }

        // Get the channel
        let channel: TextChannel | null = null;
        if (reminder.channelId) {
            const fetchedChannel = await guild.channels.fetch(reminder.channelId).catch(() => null);
            if (fetchedChannel && fetchedChannel.isTextBased()) {
                channel = fetchedChannel as TextChannel;
            }
        }

        if (!channel) {
            console.log(`⚠️ Channel not found for reminder "${reminder.name}" in guild ${guildId}`);
            // Try to find a default channel (system channel or first text channel)
            const systemChannel = guild.systemChannel;
            if (systemChannel && systemChannel.isTextBased()) {
                channel = systemChannel as TextChannel;
            } else {
                const textChannels = guild.channels.cache.filter(
                    (ch) => ch.isTextBased() && !ch.isThread()
                );
                if (textChannels.size > 0) {
                    channel = textChannels.first() as TextChannel;
                }
            }
        }

        if (!channel) {
            console.log(`❌ No suitable channel found for reminder "${reminder.name}" in guild ${guildId}`);
            return;
        }

        // Build mention string
        let mention = '';
        if (reminder.roleId) {
            const role = await guild.roles.fetch(reminder.roleId).catch(() => null);
            if (role) {
                mention = `<@&${reminder.roleId}>`;
            } else {
                console.log(`⚠️ Role ${reminder.roleId} not found for reminder "${reminder.name}"`);
                // Fallback to user if role not found
                if (reminder.userId) {
                    mention = `<@${reminder.userId}>`;
                }
            }
        } else if (reminder.userId) {
            const member = await guild.members.fetch(reminder.userId).catch(() => null);
            if (member) {
                mention = `<@${reminder.userId}>`;
            } else {
                console.log(`⚠️ User ${reminder.userId} not found for reminder "${reminder.name}"`);
            }
        }

        // Build and send message
        const messageContent = mention ? `${mention} ${reminder.message}` : reminder.message;

        // Check if bot has permission to send messages
        const botMember = await guild.members.fetch(client.user!.id).catch(() => null);
        if (botMember && channel.permissionsFor(botMember)?.has('SendMessages')) {
            await channel.send(messageContent);
            console.log(`✅ Sent reminder "${reminder.name}" in guild ${guildId}`);
        } else {
            console.log(`❌ No permission to send messages in channel ${channel.id} for reminder "${reminder.name}"`);
            return;
        }

        // If it's a one-time reminder, delete it after sending
        if (!reminder.recurring) {
            ConfigManager.removeReminder(guildId, reminder.name);
            console.log(`🗑️ Deleted one-time reminder "${reminder.name}" after sending`);
        }
    } catch (error) {
        console.error(`❌ Error sending reminder "${reminder.name}":`, error);
    }
}


