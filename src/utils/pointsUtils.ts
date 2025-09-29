import { PointsUser, PointsTransaction } from '../models';
import { ConfigManager } from './config';
import { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export interface PointsResult {
  success: boolean;
  message: string;
  newBalance?: number;
  error?: string;
}

export interface UserBalance {
  points: number;
  level: number;
  experience: number;
  total_received: number;
  total_given: number;
  rank?: number;
}

/**
 * Get or create a user in the points system
 */
export async function getOrCreateUser(discordId: string, guildId: string): Promise<PointsUser> {
  const [user, created] = await PointsUser.findOrCreate({
    where: {
      discord_id: discordId,
      guild_id: guildId,
    },
    defaults: {
      discord_id: discordId,
      guild_id: guildId,
      points: 0,
      total_received: 0,
      total_given: 0,
      level: 1,
      experience: 0,
    },
  });

  // Update last_active timestamp
  await user.update({ last_active: new Date() });

  return user;
}

/**
 * Add points to a user
 */
export async function addPoints(
  toUserId: string,
  guildId: string,
  points: number,
  transactionType: string = 'thanks',
  fromUserId?: string,
  category?: string,
  reason?: string,
  metadata?: any
): Promise<PointsResult> {
  try {
    // Validate points amount
    if (points <= 0) {
      return {
        success: false,
        message: 'Points amount must be positive',
        error: 'INVALID_AMOUNT',
      };
    }

    // Get or create recipient user
    const recipient = await getOrCreateUser(toUserId, guildId);

    // Update recipient's points
    await recipient.increment({
      points: points,
      total_received: points,
    });

    // Update sender's total_given if applicable
    if (fromUserId && fromUserId !== toUserId) {
      const sender = await getOrCreateUser(fromUserId, guildId);
      await sender.increment({ total_given: points });
    }

    // Create transaction record
    await PointsTransaction.create({
      from_user_id: fromUserId || null,
      to_user_id: toUserId,
      guild_id: guildId,
      points: points,
      transaction_type: transactionType,
      category: category || null,
      reason: reason || null,
      metadata: metadata || null,
    });

    // Check for level up
    const updatedRecipient = await recipient.reload();
    const levelUpResult = await checkLevelUp(updatedRecipient);

    return {
      success: true,
      message: levelUpResult.leveledUp 
        ? `✅ ${points} points added! 🎉 Level up! (Level ${levelUpResult.newLevel})`
        : `✅ ${points} points added!`,
      newBalance: updatedRecipient.points,
    };
  } catch (error) {
    console.error('Error adding points:', error);
    return {
      success: false,
      message: 'Failed to add points',
      error: 'DATABASE_ERROR',
    };
  }
}

/**
 * Remove points from a user
 */
export async function removePoints(
  fromUserId: string,
  guildId: string,
  points: number,
  transactionType: string = 'penalty',
  category?: string,
  reason?: string,
  metadata?: any
): Promise<PointsResult> {
  try {
    if (points <= 0) {
      return {
        success: false,
        message: 'Points amount must be positive',
        error: 'INVALID_AMOUNT',
      };
    }

    const user = await getOrCreateUser(fromUserId, guildId);

    if (user.points < points) {
      return {
        success: false,
        message: 'Insufficient points',
        error: 'INSUFFICIENT_POINTS',
      };
    }

    // Update user's points
    await user.decrement({ points: points });

    // Create transaction record
    await PointsTransaction.create({
      from_user_id: fromUserId,
      to_user_id: fromUserId, // Self-transaction for penalties
      guild_id: guildId,
      points: -points,
      transaction_type: transactionType,
      category: category || null,
      reason: reason || null,
      metadata: metadata || null,
    });

    const updatedUser = await user.reload();

    return {
      success: true,
      message: `✅ ${points} points removed`,
      newBalance: updatedUser.points,
    };
  } catch (error) {
    console.error('Error removing points:', error);
    return {
      success: false,
      message: 'Failed to remove points',
      error: 'DATABASE_ERROR',
    };
  }
}

/**
 * Get user's balance and stats
 */
export async function getUserBalance(discordId: string, guildId: string): Promise<UserBalance | null> {
  try {
    const user = await PointsUser.findOne({
      where: {
        discord_id: discordId,
        guild_id: guildId,
      },
    });

    if (!user) {
      return null;
    }

    // Get user's rank in guild
    const rank = await PointsUser.count({
      where: {
        guild_id: guildId,
        points: { [require('sequelize').Op.gt]: user.points },
      },
    }) + 1;

    return {
      points: user.points,
      level: user.level,
      experience: user.experience,
      total_received: user.total_received,
      total_given: user.total_given,
      rank,
    };
  } catch (error) {
    console.error('Error getting user balance:', error);
    return null;
  }
}

/**
 * Get leaderboard for a guild
 */
export async function getLeaderboard(guildId: string, limit: number = 10): Promise<PointsUser[]> {
  try {
    return await PointsUser.findAll({
      where: { guild_id: guildId },
      order: [['points', 'DESC']],
      limit,
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return [];
  }
}

/**
 * Check if user should level up
 */
async function checkLevelUp(user: PointsUser): Promise<{ leveledUp: boolean; newLevel: number }> {
  const currentLevel = user.level;
  const experienceNeeded = currentLevel * 100; // 100 points per level

  if (user.points >= experienceNeeded) {
    const newLevel = Math.floor(user.points / 100) + 1;
    await user.update({
      level: newLevel,
      experience: user.points % 100,
    });
    return { leveledUp: true, newLevel };
  }

  return { leveledUp: false, newLevel: currentLevel };
}

/**
 * Send points transaction log to logs channel
 */
export async function logPointsTransaction(
  client: Client,
  guildId: string,
  transaction: PointsTransaction,
  fromUser?: any,
  toUser?: any
): Promise<void> {
  try {
    const config = ConfigManager.getGuildConfig(guildId);
    const logsChannelId = config?.points?.logsChannel;

    if (!logsChannelId) return;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const logsChannel = guild.channels.cache.get(logsChannelId);
    if (!logsChannel || !logsChannel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(transaction.points > 0 ? '#00ff00' : '#ff0000')
      .setTitle('💰 Points Transaction')
      .setDescription(`${transaction.points > 0 ? '+' : ''}${transaction.points} points`)
      .addFields(
        {
          name: 'Type',
          value: transaction.transaction_type.charAt(0).toUpperCase() + transaction.transaction_type.slice(1),
          inline: true,
        },
        {
          name: 'Points',
          value: `${transaction.points > 0 ? '+' : ''}${transaction.points}`,
          inline: true,
        },
        {
          name: 'Recipient',
          value: toUser ? `<@${toUser.id}>` : `<@${transaction.to_user_id}>`,
          inline: true,
        }
      )
      .setTimestamp(transaction.created_at);

    if (transaction.category) {
      embed.addFields({
        name: 'Category',
        value: transaction.category,
        inline: true,
      });
    }

    if (transaction.from_user_id && fromUser) {
      embed.addFields({
        name: 'From',
        value: `<@${fromUser.id}>`,
        inline: true,
      });
    }

    if (transaction.reason) {
      embed.addFields({
        name: 'Reason',
        value: transaction.reason,
        inline: false,
      });
    }

    await logsChannel.send({
        content: `<@${transaction.to_user_id}>`,
        embeds: [embed]
    });
  } catch (error) {
    console.error('Error logging points transaction:', error);
  }
}

// Notif thanks message
export async function notifyThanksMessage(
  client: Client,
  guildId: string,
  transaction: PointsTransaction,
): Promise<void> {
  try {
    const config = ConfigManager.getGuildConfig(guildId);
    const thanksChannelId = config?.points?.logsChannel;

    if (!thanksChannelId) return;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const thanksChannel = guild.channels.cache.get(thanksChannelId);
    if (!thanksChannel || !thanksChannel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle("👍 Thanks Sent!")
      .setDescription(`<@${transaction.from_user_id}> barusan kasih ${transaction.points} rubic ke <@${transaction.to_user_id}>!`)
      .setFooter({ text: "Powered by BULLSTER" })
      .addFields(
        {
          name: "Reason",
          value: transaction.reason || "No reason",
          inline: false,
        }
      )
      .setTimestamp();

    await thanksChannel.send({
      content: `<@${transaction.to_user_id}>`,
      embeds: [embed]
    });
  } catch (error) {
    console.error('Error notifying thanks message:', error);
  }
}