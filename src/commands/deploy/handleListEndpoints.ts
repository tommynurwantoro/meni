import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import {
    getWhitelistConfig,
    getWhitelistedEndpoints,
    getStackConfig,
} from "../../utils/deployConfigUtils";

/**
 * Handle /deploy list-endpoints command - Show all endpoints with their stacks
 */
export async function handleListEndpoints(
    interaction: ChatInputCommandInteraction
): Promise<void> {
    await interaction.deferReply();

    try {
        const endpoints = getWhitelistedEndpoints();
        const config = getWhitelistConfig();

        if (!config || endpoints.length === 0) {
            const noConfigEmbed = new EmbedBuilder()
                .setColor(0xffa500)
                .setTitle("📋 Available Endpoints and Stacks")
                .setDescription(
                    "No endpoints configured in whitelist_deploy.json."
                )
                .setFooter({ text: "Contact admin to configure endpoints" })
                .setTimestamp();

            await interaction.editReply({ embeds: [noConfigEmbed] });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("📋 Available Endpoints and Stacks")
            .setDescription("Endpoints and their associated stacks available for deployment")
            .setFooter({ text: "Powered by MENI" })
            .setTimestamp();

        // Group endpoints with their stacks
        endpoints.forEach((endpoint) => {
            const stacks = endpoint.stacks;
            let stacksText = "";

            if (stacks.length === 0) {
                stacksText = "No stacks configured";
            } else {
                stacks.forEach((stackName) => {
                    const stackConfig = getStackConfig(stackName);
                    const serviceCount = stackConfig?.services.length || 0;
                    stacksText += `• **${stackName}** (${serviceCount} service${serviceCount !== 1 ? "s" : ""})\n`;
                });
            }

            embed.addFields({
                name: `Endpoint ${endpoint.id}`,
                value: stacksText || "No stacks",
                inline: false,
            });
        });

        await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
        throw error;
    }
}

