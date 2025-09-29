import { createClient, RedisClientType } from 'redis';

interface PrayerTime {
  name: string;
  time: string;
}

interface SholatSchedule {
  date: string;
  prayers: PrayerTime[];
}

class RedisManager {
  private client: RedisClientType | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('❌ Redis disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.isConnected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  private async ensureConnected(): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }
    return this.isConnected;
  }

  /**
   * Store daily prayer schedule in Redis
   */
  async storePrayerSchedule(schedule: SholatSchedule): Promise<boolean> {
    try {
      if (!(await this.ensureConnected())) {
        console.error('Redis not connected, cannot store prayer schedule');
        return false;
      }

      const key = `prayer_schedule:${schedule.date}`;
      await this.client!.setEx(key, 86400, JSON.stringify(schedule)); // Expire in 24 hours
      
      console.log(`📅 Prayer schedule stored for ${schedule.date}`);
      return true;
    } catch (error) {
      console.error('Error storing prayer schedule:', error);
      return false;
    }
  }

  /**
   * Get daily prayer schedule from Redis
   */
  async getPrayerSchedule(date: string): Promise<SholatSchedule | null> {
    try {
      if (!(await this.ensureConnected())) {
        console.error('Redis not connected, cannot get prayer schedule');
        return null;
      }

      const key = `prayer_schedule:${date}`;
      const data = await this.client!.get(key);
      
      if (!data) {
        console.log(`No prayer schedule found for ${date}`);
        return null;
      }

      return JSON.parse(data) as SholatSchedule;
    } catch (error) {
      console.error('Error getting prayer schedule:', error);
      return null;
    }
  }

  /**
   * Get today's prayer schedule
   */
  async getTodayPrayerSchedule(): Promise<SholatSchedule | null> {
    const today = new Date().toISOString().split('T')[0];
    return await this.getPrayerSchedule(today);
  }

  /**
   * Check if prayer schedule exists for today
   */
  async hasTodaySchedule(): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const schedule = await this.getPrayerSchedule(today);
    return schedule !== null;
  }

  /**
   * Store prayer time check result to avoid duplicate reminders
   */
  async markPrayerTimeSent(prayerName: string, date: string): Promise<boolean> {
    try {
      if (!(await this.ensureConnected())) {
        return false;
      }

      const key = `prayer_sent:${date}:${prayerName}`;
      await this.client!.setEx(key, 86400, 'true'); // Expire in 24 hours
      
      return true;
    } catch (error) {
      console.error('Error marking prayer time as sent:', error);
      return false;
    }
  }

  /**
   * Check if prayer time reminder was already sent
   */
  async wasPrayerTimeSent(prayerName: string, date: string): Promise<boolean> {
    try {
      if (!(await this.ensureConnected())) {
        return false;
      }

      const key = `prayer_sent:${date}:${prayerName}`;
      const result = await this.client!.get(key);
      
      return result === 'true';
    } catch (error) {
      console.error('Error checking if prayer time was sent:', error);
      return false;
    }
  }

  /**
   * Get Redis connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Clear all prayer-related data (for testing)
   */
  async clearPrayerData(): Promise<boolean> {
    try {
      if (!(await this.ensureConnected())) {
        return false;
      }

      const keys = await this.client!.keys('prayer_*');
      if (keys.length > 0) {
        await this.client!.del(keys);
        console.log(`Cleared ${keys.length} prayer-related keys`);
      }
      
      return true;
    } catch (error) {
      console.error('Error clearing prayer data:', error);
      return false;
    }
  }

  /**
   * Store temporary user data for thanks flow
   */
  async storeThanksData(userId: string, guildId: string, data: any): Promise<void> {
    try {
      if (!(await this.ensureConnected())) {
        console.error('Redis not connected, cannot store thanks data');
        return;
      }
      
      const key = `thanks_temp:${guildId}:${userId}`;
      const value = JSON.stringify(data);
      
      // Store with 10 minute expiration
      await this.client!.setEx(key, 600, value);
      console.log(`Stored thanks data for user ${userId} in guild ${guildId}`);
    } catch (error) {
      console.error('Error storing thanks data:', error);
    }
  }

  /**
   * Get temporary user data for thanks flow
   */
  async getThanksData(userId: string, guildId: string): Promise<any | null> {
    try {
      if (!(await this.ensureConnected())) {
        console.error('Redis not connected, cannot get thanks data');
        return null;
      }
      
      const key = `thanks_temp:${guildId}:${userId}`;
      const value = await this.client!.get(key);
      
      if (!value) {
        console.log(`No thanks data found for user ${userId} in guild ${guildId}`);
        return null;
      }

      return JSON.parse(value);
    } catch (error) {
      console.error('Error getting thanks data:', error);
      return null;
    }
  }

  /**
   * Clear temporary user data for thanks flow
   */
  async clearThanksData(userId: string, guildId: string): Promise<void> {
    try {
      if (!(await this.ensureConnected())) {
        console.error('Redis not connected, cannot clear thanks data');
        return;
      }
      
      const key = `thanks_temp:${guildId}:${userId}`;
      await this.client!.del(key);
      console.log(`Cleared thanks data for user ${userId} in guild ${guildId}`);
    } catch (error) {
      console.error('Error clearing thanks data:', error);
    }
  }
}

// Export singleton instance
export const redisManager = new RedisManager();
