import { EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { getServiceConfig, getAllServices } from "../../utils/deployConfigUtils";

/**
 * Shared utility functions for deploy command handlers
 */

/**
 * Check if user has required role for deploy commands
 */
export async function checkDeployPermissions(interaction: ChatInputCommandInteraction): Promise<boolean> {
    const allowedRoleId = process.env.DEPLOY_ROLE_ID;

    if (!allowedRoleId) {
        return true; // No restriction
    }

    // Check if interaction is from a guild (not DM)
    if (!interaction.guild) {
        const dmEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle("❌ Access Denied")
            .setDescription("Deploy commands can only be used in a server.")
            .setTimestamp();

        await interaction.reply({ embeds: [dmEmbed], ephemeral: true });
        return false;
    }

    // Get member from guild
    const member = await interaction.guild.members.fetch(interaction.user.id);

    // Check if member has the required role
    if (!member.roles.cache.has(allowedRoleId)) {
        const noPermissionEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle("❌ Access Denied")
            .setDescription("You do not have permission to use deploy commands.")
            .setFooter({ text: "Required role is missing" })
            .setTimestamp();

        await interaction.reply({
            embeds: [noPermissionEmbed],
            ephemeral: true,
        });
        return false;
    }

    return true;
}

/**
 * Get sorted services with descriptions for select menus
 */
export function getServiceSelectOptions() {
    const services = getAllServices();
    const sortedServices = services.sort((a, b) => a.localeCompare(b));

    return sortedServices.slice(0, 25).map((service) => {
        const serviceConfig = getServiceConfig(service);
        const description = serviceConfig?.description || "No description";

        return {
            label: service,
            value: service,
            description: description.substring(0, 100),
        };
    });
}

/**
 * Create error embed for deploy commands
 */
export function createErrorEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: "Powered by MENI" })
        .setTimestamp();
}

