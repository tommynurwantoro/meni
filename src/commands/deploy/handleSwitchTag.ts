import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
} from "discord.js";
import { GitLabClient } from "../../utils/gitlabClient";
import {
    extractCurrentImageTag,
    updateImageTagInYaml,
    generateCommitMessage,
} from "../../utils/gitopsUtils";
import {
    getGitLabProjectId,
    findStackForService,
    getAllServices,
} from "../../utils/deployConfigUtils";
import { getServiceSelectOptions, createErrorEmbed } from "./utils";

/**
 * Handle /deploy switch-tag command - Switch image tag for a service in GitLab YAML
 */
export async function handleSwitchTag(
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
                .setTitle("🔄 Switch Tag")
                .setDescription("No services found in whitelist configuration.")
                .setFooter({ text: "Contact admin to configure services" })
                .setTimestamp();

            await interaction.editReply({ embeds: [noServicesEmbed] });
            return;
        }

        // Create select menu with services
        const options = getServiceSelectOptions();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("switch_tag_service_select")
            .setPlaceholder("Select a service to switch tag")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options);

        const row =
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                selectMenu
            );

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("🔄 Switch Image Tag")
            .setDescription(
                "Select a service to switch its image tag in GitLab YAML."
            )
            .setFooter({ text: "Powered by MENI" })
            .setTimestamp();

        const message = await interaction.editReply({
            embeds: [embed],
            components: [row],
        });

        // Wait for service selection
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: (i) => i.customId === "switch_tag_service_select",
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

                await i.update({ embeds: [errorEmbed], components: [] });
                return;
            }

            // Find which stack contains this service to get GitOps config
            const stackInfo = findStackForService(serviceName);

            if (!stackInfo) {
                const errorEmbed = createErrorEmbed(
                    "❌ Stack Not Found",
                    `Service "${serviceName}" is not associated with any stack in the configuration.`
                );

                await i.update({ embeds: [errorEmbed], components: [] });
                return;
            }

            const { stackName, stackConfig } = stackInfo;

            // Get user's GitLab token
            const { getGitLabToken } = await import("../gitlab");
            const userToken = await getGitLabToken(interaction.user.id);

            if (!userToken) {
                const noTokenEmbed = createErrorEmbed(
                    "🔐 GitLab Token Not Found",
                    "Your GitLab token could not be retrieved. Please set it again using `/gitlab token`."
                );

                await i.update({ embeds: [noTokenEmbed], components: [] });
                return;
            }

            // Get GitLab client
            const gitlabUrl = process.env.GITLAB_URL;
            if (!gitlabUrl) {
                const errorEmbed = createErrorEmbed(
                    "❌ Configuration Error",
                    "GitLab URL is not configured."
                );

                await i.update({ embeds: [errorEmbed], components: [] });
                return;
            }

            const gitlabClient = new GitLabClient({
                baseUrl: gitlabUrl,
                token: userToken,
            });

            // Show loading message
            await i.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xffa500)
                        .setTitle("🔄 Loading Tags")
                        .setDescription(
                            `Fetching current tag and available tags for **${serviceName}**...`
                        )
                        .setFooter({ text: "Powered by MENI" })
                        .setTimestamp(),
                ],
                components: [],
            });

            try {
                // Get current YAML content and extract current tag
                const yamlContent = await gitlabClient.getFileRawContent(
                    stackConfig.gitOpsRepoId,
                    stackConfig.gitOpsFilePath,
                    stackConfig.gitOpsBranch
                );

                const currentTag = extractCurrentImageTag(yamlContent, serviceName);

                // Fetch tags from GitLab
                const tags = await gitlabClient.getProjectTags(projectId, 10);

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
                                name: "Current Tag",
                                value: currentTag || "Not found",
                                inline: true,
                            }
                        )
                        .setFooter({ text: "Powered by MENI" })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [noTagsEmbed] });
                    return;
                }

                // Create tag selection dropdown
                const tagOptions = tags.map((tag) => {
                    const isCurrent = tag.name === currentTag;
                    return {
                        label: tag.name,
                        value: tag.name,
                        description: isCurrent
                            ? "Current tag"
                            : tag.commit.title?.substring(0, 100) || "No description",
                    };
                });

                const tagSelectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`switch_tag_tag_select_${serviceName}`)
                    .setPlaceholder("Select a tag to switch to")
                    .setMinValues(1)
                    .setMaxValues(1)
                    .addOptions(tagOptions);

                const tagRow =
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        tagSelectMenu
                    );

                const tagEmbed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle(`🔄 Switch Tag for ${serviceName}`)
                    .setDescription("Select a new tag to switch to.")
                    .addFields(
                        {
                            name: "Current Tag",
                            value: currentTag || "Not found",
                            inline: true,
                        },
                        {
                            name: "Available Tags",
                            value: `${tags.length} tag(s)`,
                            inline: true,
                        }
                    )
                    .setFooter({ text: "Powered by MENI" })
                    .setTimestamp();

                await interaction.editReply({
                    embeds: [tagEmbed],
                    components: [tagRow],
                });

                // Wait for tag selection
                const tagCollector = interaction.channel?.createMessageComponentCollector({
                    componentType: ComponentType.StringSelect,
                    filter: (selectInteraction) =>
                        selectInteraction.customId === `switch_tag_tag_select_${serviceName}` &&
                        selectInteraction.user.id === interaction.user.id,
                    time: 60000, // 1 minute
                });

                tagCollector?.on("collect", async (tagInteraction) => {
                    const selectedTag = tagInteraction.values[0];

                    if (selectedTag === currentTag) {
                        await tagInteraction.reply({
                            content: `⚠️ Tag "${selectedTag}" is already the current tag.`,
                            ephemeral: true,
                        });
                        return;
                    }

                    // Show updating message
                    await tagInteraction.update({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xffa500)
                                .setTitle("🔄 Updating Tag")
                                .setDescription(
                                    `Updating **${serviceName}** tag from \`${currentTag || "unknown"}\` to \`${selectedTag}\`...`
                                )
                                .setFooter({ text: "Powered by MENI" })
                                .setTimestamp(),
                        ],
                        components: [],
                    });

                    try {
                        // Get fresh YAML content
                        const freshYamlContent = await gitlabClient.getFileRawContent(
                            stackConfig.gitOpsRepoId,
                            stackConfig.gitOpsFilePath,
                            stackConfig.gitOpsBranch
                        );

                        // Update YAML with new tag
                        const updatedYamlContent = updateImageTagInYaml(
                            freshYamlContent,
                            serviceName,
                            selectedTag
                        );

                        // Generate commit message
                        const commitMessage = generateCommitMessage(
                            serviceName,
                            selectedTag,
                            currentTag || undefined
                        );

                        // Commit changes to GitLab
                        await gitlabClient.updateFile(
                            stackConfig.gitOpsRepoId,
                            stackConfig.gitOpsFilePath,
                            stackConfig.gitOpsBranch,
                            updatedYamlContent,
                            commitMessage
                        );

                        // Get commit info (we'll need to fetch the latest commit)
                        const fileInfo = await gitlabClient.getFile(
                            stackConfig.gitOpsRepoId,
                            stackConfig.gitOpsFilePath,
                            stackConfig.gitOpsBranch
                        );

                        // Success embed
                        const successEmbed = new EmbedBuilder()
                            .setColor(0x00ff00)
                            .setTitle("✅ Tag Switched Successfully")
                            .setDescription(
                                `Successfully updated **${serviceName}** image tag in GitLab YAML.`
                            )
                            .addFields(
                                {
                                    name: "Service",
                                    value: serviceName,
                                    inline: true,
                                },
                                {
                                    name: "Old Tag",
                                    value: currentTag || "Unknown",
                                    inline: true,
                                },
                                {
                                    name: "New Tag",
                                    value: selectedTag,
                                    inline: true,
                                },
                                {
                                    name: "Commit",
                                    value: `\`${fileInfo.commit_id.substring(0, 8)}\``,
                                    inline: true,
                                },
                                {
                                    name: "Stack",
                                    value: stackName,
                                    inline: true,
                                }
                            )
                            .setFooter({ text: "Powered by MENI" })
                            .setTimestamp();

                        await tagInteraction.editReply({ embeds: [successEmbed] });
                    } catch (error: any) {
                        console.error("Switch tag error:", error);

                        const errorEmbed = createErrorEmbed(
                            "❌ Failed to Switch Tag",
                            error.message ||
                                "An unknown error occurred while switching the tag"
                        );

                        await tagInteraction.editReply({ embeds: [errorEmbed] });
                    }
                });

                tagCollector?.on("end", (collected) => {
                    if (collected.size === 0) {
                        interaction.editReply({
                            embeds: [
                                createErrorEmbed(
                                    "⏰ Timeout",
                                    "Tag selection timed out."
                                ),
                            ],
                            components: [],
                        });
                    }
                });
            } catch (error: any) {
                console.error("Switch tag error:", error);

                const errorEmbed = createErrorEmbed(
                    "❌ Failed to Load Tags",
                    error.message ||
                        "An unknown error occurred while loading tags"
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
        console.error("Switch tag error:", error);

        const errorEmbed = createErrorEmbed(
            "❌ Failed to Initialize Tag Switch",
            error.message || "An unknown error occurred"
        );

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

