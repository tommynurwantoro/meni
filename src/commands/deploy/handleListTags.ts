import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
} from "discord.js";
import { GitLabClient } from "../../utils/gitlabClient";
import {
    getGitLabProjectId,
    getAllServices,
} from "../../utils/deployConfigUtils";
import { getServiceSelectOptions, createErrorEmbed } from "./utils";

/**
 * Handle /deploy list-tags command - Show top 3 tags for selected service
 */
export async function handleListTags(
    interaction: ChatInputCommandInteraction
): Promise<void> {
    await interaction.deferReply();

    try {
        // Check if user has GitLab token configured
        const { hasGitLabToken } = await import("../gitlab");
        const hasToken = await hasGitLabToken(interaction.user.id);

        if (!hasToken) {
            const noTokenEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("🔐 GitLab Token Required")
                .setDescription(
                    "You need to configure your GitLab personal access token before using this feature."
                )
                .addFields(
                    {
                        name: "How to Set Token",
                        value: "Use `/gitlab token` to set your token",
                        inline: false,
                    },
                    {
                        name: "Why?",
                        value: "Your personal token ensures proper attribution and access to your GitLab projects.",
                        inline: false,
                    }
                )
                .setFooter({ text: "Powered by MENI" })
                .setTimestamp();

            await interaction.editReply({ embeds: [noTokenEmbed] });
            return;
        }

        // Get all services from config
        const services = getAllServices();

        if (services.length === 0) {
            const noServicesEmbed = new EmbedBuilder()
                .setColor(0xffa500)
                .setTitle("📋 Get Service Tags")
                .setDescription("No services found in whitelist configuration.")
                .setFooter({ text: "Contact admin to configure services" })
                .setTimestamp();

            await interaction.editReply({ embeds: [noServicesEmbed] });
            return;
        }

        // Create select menu with services
        const options = getServiceSelectOptions();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("tags_service_select")
            .setPlaceholder("Select a service to view tags")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options);

        const row =
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                selectMenu
            );

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("📋 Get Service Tags from GitLab")
            .setDescription(
                "Select a service to view its latest 3 tags from GitLab."
            )
            .setFooter({ text: "Powered by MENI" })
            .setTimestamp();

        const message = await interaction.editReply({
            embeds: [embed],
            components: [row],
        });

        // Wait for selection
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: (i) => i.customId === "tags_service_select",
            time: 60000, // 1 minute
        });

        collector.on("collect", async (i) => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({
                    content: "This menu is not for you!",
                    ephemeral: true,
                });
                return;
            }

            const serviceName = i.values[0];

            // Show loading message
            await i.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xffa500)
                        .setTitle("🔄 Fetching Tags")
                        .setDescription(
                            `Fetching latest tags for **${serviceName}** from GitLab...`
                        )
                        .setFooter({ text: "Powered by MENI" })
                        .setTimestamp(),
                ],
                components: [],
            });

            try {
                // Get GitLab project ID for the service
                const projectId = getGitLabProjectId(serviceName);
                if (!projectId) {
                    const errorEmbed = createErrorEmbed(
                        "❌ Service Not Configured",
                        `Service "${serviceName}" doesn't have a GitLab project ID mapping.`
                    ).addFields({
                        name: "Service",
                        value: serviceName,
                        inline: true,
                    });

                    await interaction.editReply({ embeds: [errorEmbed] });
                    return;
                }

                // Get user's GitLab token
                const { getGitLabToken } = await import("../gitlab");
                const userToken = await getGitLabToken(interaction.user.id);

                if (!userToken) {
                    const noTokenEmbed = createErrorEmbed(
                        "🔐 GitLab Token Not Found",
                        "Your GitLab token could not be retrieved. Please set it again using `/gitlab token`."
                    );

                    await interaction.editReply({ embeds: [noTokenEmbed] });
                    return;
                }

                // Fetch tags from GitLab using user's token
                const gitlabUrl = process.env.GITLAB_URL;

                if (!gitlabUrl) {
                    throw new Error("GitLab URL is not configured");
                }

                const gitlabClient = new GitLabClient({
                    baseUrl: gitlabUrl,
                    token: userToken,
                });
                const tags = await gitlabClient.getProjectTags(projectId, 3);

                if (tags.length === 0) {
                    const noTagsEmbed = new EmbedBuilder()
                        .setColor(0xffa500)
                        .setTitle("📋 No Tags Found")
                        .setDescription(
                            `No tags found for service "${serviceName}".`
                        )
                        .addFields(
                            {
                                name: "Service",
                                value: serviceName,
                                inline: true,
                            },
                            {
                                name: "GitLab Project ID",
                                value: projectId,
                                inline: true,
                            }
                        )
                        .setFooter({ text: "Powered by MENI" })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [noTagsEmbed] });
                    return;
                }

                // Create embed with tags
                const embed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle(`📋 Latest Tags for ${serviceName}`)
                    .setDescription(
                        `Showing ${tags.length} most recent tag(s) from GitLab`
                    )
                    .addFields(
                        { name: "Service", value: serviceName, inline: true },
                        { name: "Project ID", value: projectId, inline: true }
                    )
                    .setFooter({ text: "Powered by MENI" })
                    .setTimestamp();

                // Add each tag as a field
                tags.forEach((tag) => {
                    const commitDate = new Date(
                        tag.commit.committed_date
                    ).toLocaleString("id-ID", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                    });

                    let tagInfo = `**Commit:** \`${tag.commit.short_id}\`\n`;
                    tagInfo += `**Date:** ${commitDate}\n`;
                    tagInfo += `**Author:** ${tag.commit.author_name}\n`;

                    if (tag.commit.title) {
                        tagInfo += `**Message:** ${tag.commit.title.substring(
                            0,
                            100
                        )}${tag.commit.title.length > 100 ? "..." : ""}`;
                    }

                    embed.addFields({
                        name: `${tag.name}`,
                        value: tagInfo,
                        inline: false,
                    });
                });

                await interaction.editReply({ embeds: [embed] });
            } catch (error: any) {
                console.error("Get tags error:", error);

                const errorEmbed = createErrorEmbed(
                    "❌ Failed to Fetch Tags",
                    error.message ||
                        "An unknown error occurred while fetching tags from GitLab"
                );

                await interaction.editReply({ embeds: [errorEmbed] });
            }
        });

        collector.on("end", (collected) => {
            if (collected.size === 0) {
                interaction.editReply({
                    embeds: [
                        createErrorEmbed(
                            "⏰ Timeout",
                            "Service selection timed out."
                        ),
                    ],
                    components: [],
                });
            }
        });
    } catch (error: any) {
        console.error("Get tags error:", error);

        const errorEmbed = createErrorEmbed(
            "❌ Failed to Load Services",
            error.message ||
                "An unknown error occurred while loading services"
        );

        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

