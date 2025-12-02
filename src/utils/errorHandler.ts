import { EmbedBuilder, MessageFlags } from "discord.js";
import { Interaction } from "discord.js";

/**
 * Standardized error handling utilities for Discord interactions
 */

export interface ErrorResponseOptions {
    title?: string;
    description?: string;
    ephemeral?: boolean;
    footer?: string;
}

/**
 * Create a standardized error embed
 */
export function createErrorEmbed(
    title: string = "❌ Error",
    description: string = "An error occurred",
    footer: string = "Powered by MENI"
): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: footer })
        .setTimestamp();
}

/**
 * Handle and reply to an interaction with an error
 */
export async function handleError(
    interaction: Interaction,
    error: Error | unknown,
    options: ErrorResponseOptions = {}
): Promise<void> {
    const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
    const title = options.title || "❌ Error";
    const description = options.description || errorMessage;
    const footer = options.footer || "Powered by MENI";

    const errorEmbed = createErrorEmbed(title, description, footer);

    // Handle different interaction types
    if (interaction.isRepliable()) {
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({
                embeds: [errorEmbed],
                ephemeral: options.ephemeral ?? true,
            });
        }
    }
}

/**
 * Log error with context
 */
export function logError(
    context: string,
    error: Error | unknown,
    additionalInfo?: Record<string, unknown>
): void {
    const errorMessage =
        error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`❌ [${context}] Error:`, errorMessage);
    if (errorStack) {
        console.error(`Stack trace:`, errorStack);
    }
    if (additionalInfo) {
        console.error(`Additional info:`, additionalInfo);
    }
}

