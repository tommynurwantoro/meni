import { ChatInputCommandInteraction } from "discord.js";

/**
 * Shared types for deploy command handlers
 */

export interface DeployCommandContext {
    interaction: ChatInputCommandInteraction;
    portainerClient?: any;
}

