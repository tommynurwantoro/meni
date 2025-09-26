import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface GuildConfig {
    welcome?: {
        channel?: string;
        message?: string;
    };
    points?: {
        logsChannel?: string;
        marketplaceChannel?: string;
        stock?: Array<{
            name: string;
            description: string;
            price: number;
            quantity: number;
            addedBy: string;
            addedAt: string;
        }>;
    };
    moderation?: {
        linkProtection?: boolean;
        logsChannel?: string;
        whitelistDomains?: string[];
    };
    titipReview?: {
        channel?: string;
    };
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
}
