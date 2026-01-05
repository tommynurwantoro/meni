import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface Reminder {
    name: string;
    time: string; // HH:mm format
    message: string;
    roleId?: string | null;
    userId?: string | null;
    channelId?: string | null;
    recurring: boolean;
    daysOfWeek?: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday. If not set, runs every day
    createdBy: string;
    createdAt: string;
}

export interface GuildConfig {
    welcome?: {
        channel?: string;
        message?: string;
    };
    points?: {
        logsChannel?: string;
        thanksChannel?: string;
        enabled?: boolean;
        achievementRoleUser?: string;
        achievementRoleMention?: string;
        marketplace?: {
            enabled?: boolean;
            channel?: string;
            stock?: Array<{
                name: string;
                description: string;
                price: number;
                quantity: number;
                addedBy: string;
                addedAt: string;
            }>;
        };
    };
    moderation?: {
        linkProtection?: boolean;
        logsChannel?: string;
        whitelistDomains?: string[];
    };
    titipReview?: {
        lastMessageId?: string;
        lastChannelId?: string;
    };
    presensi?: {
        channel?: string;
        role?: string;
        enabled?: boolean;
    };
    sholat?: {
        channel?: string;
        role?: string;
        enabled?: boolean;
    };
    reminders?: Reminder[];
    setupBy?: string;
    setupAt?: string;
}

export interface BotConfig {
    [guildId: string]: GuildConfig;
}

export class ConfigManager {
    private static configPath = join(__dirname, '..', '..', 'config.json');
    private static config: BotConfig = {};

    static loadConfig(): BotConfig {
        if (existsSync(this.configPath)) {
            try {
                this.config = JSON.parse(readFileSync(this.configPath, 'utf8'));
            } catch (error) {
                console.error('Error loading config:', error);
                this.config = {};
            }
        }
        return this.config;
    }

    static getGuildConfig(guildId: string): GuildConfig | null {
        this.loadConfig();
        return this.config[guildId] || null;
    }

    static saveConfig(): void {
        try {
            writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving config:', error);
        }
    }

    static updateGuildConfig(guildId: string, config: Partial<GuildConfig>): void {
        this.loadConfig();
        this.config[guildId] = {
            ...this.config[guildId],
            ...config,
            setupAt: new Date().toISOString()
        };
        this.saveConfig();
    }

    static addReminder(guildId: string, reminder: Reminder): void {
        this.loadConfig();
        if (!this.config[guildId]) {
            this.config[guildId] = {};
        }
        if (!this.config[guildId].reminders) {
            this.config[guildId].reminders = [];
        }
        this.config[guildId].reminders!.push(reminder);
        this.saveConfig();
    }

    static removeReminder(guildId: string, reminderName: string): boolean {
        this.loadConfig();
        if (!this.config[guildId] || !this.config[guildId].reminders) {
            return false;
        }
        const initialLength = this.config[guildId].reminders!.length;
        this.config[guildId].reminders = this.config[guildId].reminders!.filter(
            r => r.name !== reminderName
        );
        const removed = this.config[guildId].reminders!.length < initialLength;
        if (removed) {
            this.saveConfig();
        }
        return removed;
    }

    static getReminders(guildId: string): Reminder[] {
        this.loadConfig();
        return this.config[guildId]?.reminders || [];
    }

    static getAllReminders(): Map<string, Reminder[]> {
        this.loadConfig();
        const result = new Map<string, Reminder[]>();
        for (const [guildId, config] of Object.entries(this.config)) {
            if (config.reminders && config.reminders.length > 0) {
                result.set(guildId, config.reminders);
            }
        }
        return result;
    }
}
