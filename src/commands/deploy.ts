import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from "discord.js";
import {
    getPortainerClient,
} from "../utils/portainerClient";
import { GitLabClient } from "../utils/gitlabClient";
import {
    extractCurrentImageTag,
    updateImageTagInYaml,
    generateCommitMessage,
} from "../utils/gitopsUtils";
import {
    getWhitelistConfig,
    getWhitelistedEndpoints,
    getStackConfig,
    getServiceConfig,
    getStacksForEndpoint,
    getGitLabProjectId,
    getAllServices,
    findStackForService,
} from "../utils/deployConfigUtils";

export const data = new SlashCommandBuilder()
    .setName("deploy")
    .setDescription("Deploy services using Portainer API")
    .addSubcommand((subcommand) =>
        subcommand
            .setName("list-endpoints")
            .setDescription("List all available endpoints and stacks to deploy")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("list-tags")
            .setDescription("Get latest 3 tags for a service from GitLab")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("create-tag")
            .setDescription("Create a new tag for a service in GitLab")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("switch-tag")
            .setDescription("Switch image tag for a service in GitLab YAML")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("apply-stack")
            .setDescription("Trigger webhook for selected stack to deploy")
            .addIntegerOption((option) =>
                option
                    .setName("endpoint")
                    .setDescription("Portainer endpoint ID")
                    .setRequired(true)
            )
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    try {
        // Check if user has required role
        const allowedRoleId = process.env.DEPLOY_ROLE_ID;

        if (allowedRoleId) {
            // Check if interaction is from a guild (not DM)
            if (!interaction.guild) {
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("❌ Access Denied")
                    .setDescription(
                        "Deploy commands can only be used in a server."
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [dmEmbed], ephemeral: true });
                return;
            }

            // Get member from guild
            const member = await interaction.guild.members.fetch(
                interaction.user.id
            );

            // Check if member has the required role
            if (!member.roles.cache.has(allowedRoleId)) {
                const noPermissionEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("❌ Access Denied")
                    .setDescription(
                        "You do not have permission to use deploy commands."
                    )
                    .setFooter({ text: "Required role is missing" })
                    .setTimestamp();

                await interaction.reply({
                    embeds: [noPermissionEmbed],
                    ephemeral: true,
                });
                return;
            }
        }

        const client = getPortainerClient();

        switch (subcommand) {
            case "list-endpoints":
                await handleList(interaction);
                break;
            case "list-tags":
                await handleGetTags(interaction);
                break;
            case "create-tag":
                await handleCreateTag(interaction);
                break;
            case "switch-tag":
                await handleSwitchTag(interaction);
                break;
            case "apply-stack":
                await handleStackDeploy(interaction, client);
                break;
        }
    } catch (error: any) {
        console.error("Deploy command error:", error);

        const errorEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle("❌ Deployment Error")
            .setDescription(error.message || "An unknown error occurred")
            .setTimestamp();

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

/**
 * Handle /deploy list command - Show all endpoints with their stacks
 */
async function handleList(interaction: ChatInputCommandInteraction) {
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

/**
 * Handle /deploy tags command - Show top 3 tags for selected service
 */
async function handleGetTags(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
        // Check if user has GitLab token configured
        const { hasGitLabToken } = await import("./gitlab");
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

        // Sort services alphabetically
        const sortedServices = services.sort((a, b) => a.localeCompare(b));

        // Create select menu with services (up to 25 - Discord limit)
        const options = sortedServices.slice(0, 25).map((service) => {
            const serviceConfig = getServiceConfig(service);
            const description = serviceConfig?.description || "No description";

            return {
                label: service,
                value: service,
                description: description.substring(0, 100),
            };
        });

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
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle("❌ Service Not Configured")
                        .setDescription(
                            `Service "${serviceName}" doesn't have a GitLab project ID mapping.`
                        )
                        .addFields({
                            name: "Service",
                            value: serviceName,
                            inline: true,
                        })
                        .setFooter({
                            text: "Contact admin to add GitLab project ID mapping",
                        })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [errorEmbed] });
                    return;
                }

                // Get user's GitLab token
                const { getGitLabToken } = await import("./gitlab");
                const userToken = await getGitLabToken(interaction.user.id);

                if (!userToken) {
                    const noTokenEmbed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle("🔐 GitLab Token Not Found")
                        .setDescription(
                            "Your GitLab token could not be retrieved. Please set it again using `/gitlab token`."
                        )
                        .setFooter({ text: "Powered by MENI" })
                        .setTimestamp();

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

                const errorEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("❌ Failed to Fetch Tags")
                    .setDescription(
                        error.message ||
                            "An unknown error occurred while fetching tags from GitLab"
                    )
                    .setFooter({ text: "Powered by MENI" })
                    .setTimestamp();

                await interaction.editReply({ embeds: [errorEmbed] });
            }
        });

        collector.on("end", (collected) => {
            if (collected.size === 0) {
                interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xff0000)
                            .setTitle("⏰ Timeout")
                            .setDescription("Service selection timed out.")
                            .setFooter({ text: "Powered by MENI" })
                            .setTimestamp(),
                    ],
                    components: [],
                });
            }
        });
    } catch (error: any) {
        console.error("Get tags error:", error);

        const errorEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle("❌ Failed to Load Services")
            .setDescription(
                error.message ||
                    "An unknown error occurred while loading services"
            )
            .setFooter({ text: "Powered by MENI" })
            .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

/**
 * Handle /deploy create-tag command - Create tag and update YAML without deploying
 */
async function handleCreateTag(interaction: ChatInputCommandInteraction) {
    try {
        // Check if user has GitLab token configured
        const { hasGitLabToken } = await import("./gitlab");
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
                        value: "Your personal token ensures you are recorded as the tag author in GitLab.",
                        inline: false,
                    }
                )
                .setFooter({ text: "Powered by MENI" })
                .setTimestamp();

            await interaction.reply({
                embeds: [noTokenEmbed],
                ephemeral: true,
            });
            return;
        }

        // Get all services from config
        const services = getAllServices();

        if (services.length === 0) {
            const noServicesEmbed = new EmbedBuilder()
                .setColor(0xffa500)
                .setTitle("📝 Create Tag")
                .setDescription("No services found in whitelist configuration.")
                .setFooter({ text: "Contact admin to configure services" })
                .setTimestamp();

            await interaction.reply({
                embeds: [noServicesEmbed],
                ephemeral: true,
            });
            return;
        }

        // Sort services alphabetically
        const sortedServices = services.sort((a, b) => a.localeCompare(b));

        // Create select menu with services (up to 25 - Discord limit)
        const options = sortedServices.slice(0, 25).map((service) => {
            const serviceConfig = getServiceConfig(service);
            const description = serviceConfig?.description || "No description";

            return {
                label: service,
                value: service,
                description: description.substring(0, 100),
            };
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("create_tag_service_select")
            .setPlaceholder("Select a service to create a tag for")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options);

        const row =
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                selectMenu
            );

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("📝 Create New Tag in GitLab")
            .setDescription("Select a service to create a new tag for.")
            .setFooter({ text: "Powered by MENI" })
            .setTimestamp();

        const message = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true,
        });

        // Wait for selection
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: (i) => i.customId === "create_tag_service_select",
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
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("❌ Service Not Configured")
                    .setDescription(
                        `Service "${serviceName}" doesn't have a GitLab project ID mapping.`
                    )
                    .addFields({
                        name: "Service",
                        value: serviceName,
                        inline: true,
                    })
                    .setFooter({
                        text: "Contact admin to add GitLab project ID mapping",
                    })
                    .setTimestamp();

                await i.update({ embeds: [errorEmbed], components: [] });
                return;
            }

            // Find which stack contains this service to get GitOps config
            const stackInfo = findStackForService(serviceName);

            if (!stackInfo) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("❌ Stack Not Found")
                    .setDescription(
                        `Service "${serviceName}" is not associated with any stack in the configuration.`
                    )
                    .setFooter({
                        text: "Contact admin to configure stack mapping",
                    })
                    .setTimestamp();

                await i.update({ embeds: [errorEmbed], components: [] });
                return;
            }

            const { stackName, stackConfig } = stackInfo;

            // Create modal for tag details
            const modal = new ModalBuilder()
                .setCustomId(`create_tag_modal_${serviceName}_${projectId}_${stackName}`)
                .setTitle(`Create Tag for ${serviceName}`);

            // Tag name input
            const tagNameInput = new TextInputBuilder()
                .setCustomId("tag_name")
                .setLabel("Tag Name")
                .setPlaceholder("e.g., v1.0.0")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100);

            // Tag message input
            const tagMessageInput = new TextInputBuilder()
                .setCustomId("tag_message")
                .setLabel("Tag Message")
                .setPlaceholder("e.g., Release version 1.0.0 with new features")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000);

            // Add inputs to action rows
            const firstActionRow =
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    tagNameInput
                );
            const secondActionRow =
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    tagMessageInput
                );

            modal.addComponents(firstActionRow, secondActionRow);

            // Show the modal
            await i.showModal(modal);
        });

        collector.on("end", (collected) => {
            if (collected.size === 0) {
                interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xff0000)
                            .setTitle("⏰ Timeout")
                            .setDescription("Service selection timed out.")
                            .setFooter({ text: "Powered by MENI" })
                            .setTimestamp(),
                    ],
                    components: [],
                });
            }
        });
    } catch (error: any) {
        console.error("Create tag error:", error);

        const errorEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle("❌ Failed to Initialize Tag Creation")
            .setDescription(error.message || "An unknown error occurred")
            .setFooter({ text: "Powered by MENI" })
            .setTimestamp();

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({
                embeds: [errorEmbed],
                components: [],
            });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

/**
 * Handle /deploy switch-tag command - Switch image tag for a service in GitLab YAML
 */
async function handleSwitchTag(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
        // Check if user has GitLab token configured
        const { hasGitLabToken } = await import("./gitlab");
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

        // Sort services alphabetically
        const sortedServices = services.sort((a, b) => a.localeCompare(b));

        // Create select menu with services (up to 25 - Discord limit)
        const options = sortedServices.slice(0, 25).map((service) => {
            const serviceConfig = getServiceConfig(service);
            const description = serviceConfig?.description || "No description";

            return {
                label: service,
                value: service,
                description: description.substring(0, 100),
            };
        });

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
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("❌ Service Not Configured")
                    .setDescription(
                        `Service "${serviceName}" doesn't have a GitLab project ID mapping.`
                    )
                    .addFields({
                        name: "Service",
                        value: serviceName,
                        inline: true,
                    })
                    .setFooter({
                        text: "Contact admin to add GitLab project ID mapping",
                    })
                    .setTimestamp();

                await i.update({ embeds: [errorEmbed], components: [] });
                return;
            }

            // Find which stack contains this service to get GitOps config
            const stackInfo = findStackForService(serviceName);

            if (!stackInfo) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("❌ Stack Not Found")
                    .setDescription(
                        `Service "${serviceName}" is not associated with any stack in the configuration.`
                    )
                    .setFooter({
                        text: "Contact admin to configure stack mapping",
                    })
                    .setTimestamp();

                await i.update({ embeds: [errorEmbed], components: [] });
                return;
            }

            const { stackName, stackConfig } = stackInfo;

            // Get user's GitLab token
            const { getGitLabToken } = await import("./gitlab");
            const userToken = await getGitLabToken(interaction.user.id);

            if (!userToken) {
                const noTokenEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("🔐 GitLab Token Not Found")
                    .setDescription(
                        "Your GitLab token could not be retrieved. Please set it again using `/gitlab token`."
                    )
                    .setFooter({ text: "Powered by MENI" })
                    .setTimestamp();

                await i.update({ embeds: [noTokenEmbed], components: [] });
                return;
            }

            // Get GitLab client
            const gitlabUrl = process.env.GITLAB_URL;
            if (!gitlabUrl) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("❌ Configuration Error")
                    .setDescription("GitLab URL is not configured.")
                    .setFooter({ text: "Contact admin" })
                    .setTimestamp();

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

                        const errorEmbed = new EmbedBuilder()
                            .setColor(0xff0000)
                            .setTitle("❌ Failed to Switch Tag")
                            .setDescription(
                                error.message ||
                                    "An unknown error occurred while switching the tag"
                            )
                            .setFooter({ text: "Powered by MENI" })
                            .setTimestamp();

                        await tagInteraction.editReply({ embeds: [errorEmbed] });
                    }
                });

                tagCollector?.on("end", (collected) => {
                    if (collected.size === 0) {
                        interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(0xff0000)
                                    .setTitle("⏰ Timeout")
                                    .setDescription("Tag selection timed out.")
                                    .setFooter({ text: "Powered by MENI" })
                                    .setTimestamp(),
                            ],
                            components: [],
                        });
                    }
                });
            } catch (error: any) {
                console.error("Switch tag error:", error);

                const errorEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("❌ Failed to Load Tags")
                    .setDescription(
                        error.message ||
                            "An unknown error occurred while loading tags"
                    )
                    .setFooter({ text: "Powered by MENI" })
                    .setTimestamp();

                await interaction.editReply({ embeds: [errorEmbed] });
            }
        });

        collector.on("end", (collected) => {
            if (collected.size === 0) {
                interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xff0000)
                            .setTitle("⏰ Timeout")
                            .setDescription("Service selection timed out.")
                            .setFooter({ text: "Powered by MENI" })
                            .setTimestamp(),
                    ],
                    components: [],
                });
            }
        });
    } catch (error: any) {
        console.error("Switch tag error:", error);

        const errorEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle("❌ Failed to Initialize Tag Switch")
            .setDescription(error.message || "An unknown error occurred")
            .setFooter({ text: "Powered by MENI" })
            .setTimestamp();

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

/**
 * Handle /deploy stack command - Trigger webhook for selected stack
 */
async function handleStackDeploy(
    interaction: ChatInputCommandInteraction,
    client: any
) {
    const endpointId = interaction.options.getInteger("endpoint", true);

    await interaction.deferReply();

    try {
        // Get stacks available for this endpoint
        const stacks = getStacksForEndpoint(endpointId);

        if (stacks.length === 0) {
            const noStacksEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("❌ No Stacks Available")
                .setDescription(
                    `Endpoint ID \`${endpointId}\` has no stacks configured.`
                )
                .setFooter({
                    text: "Contact admin to configure stacks for this endpoint",
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [noStacksEmbed] });
            return;
        }

        // Create select menu for stacks
        const options = stacks.map((stackName) => {
            const stackConfig = getStackConfig(stackName);
            const serviceCount = stackConfig?.services.length || 0;
            return {
                label: stackName,
                value: stackName,
                description: `${serviceCount} service${serviceCount !== 1 ? "s" : ""}`,
            };
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("stack_select")
            .setPlaceholder("Select a stack to deploy")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options);

        const row =
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                selectMenu
            );

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("📦 Stack Deployment")
            .setDescription(
                `Select a stack to deploy on endpoint \`${endpointId}\`. This will trigger the webhook to deploy the stack.`
            )
            .setFooter({ text: "Powered by MENI" })
            .setTimestamp();

        const message = await interaction.editReply({
            embeds: [embed],
            components: [row],
        });

        // Wait for stack selection
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: (i) => i.customId === "stack_select",
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

            const stackName = i.values[0];
            const stackConfig = getStackConfig(stackName);

            if (!stackConfig) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("❌ Stack Not Found")
                    .setDescription(`Stack "${stackName}" configuration not found.`)
                    .setTimestamp();

                await i.update({ embeds: [errorEmbed], components: [] });
                return;
            }

            // Check if webhook is configured
            if (!stackConfig.gitOpsWebhook) {
                const noWebhookEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("❌ Webhook Not Configured")
                    .setDescription(
                        `Stack "${stackName}" does not have a webhook configured.`
                    )
                    .setFooter({
                        text: "Contact admin to configure webhook for this stack",
                    })
                    .setTimestamp();

                await i.update({ embeds: [noWebhookEmbed], components: [] });
                return;
            }

            // Show triggering embed
            const triggeringEmbed = new EmbedBuilder()
                .setColor(0xffa500)
                .setTitle("🚀 Triggering Stack Deployment")
                .setDescription(
                    `Triggering webhook for stack **${stackName}** on endpoint \`${endpointId}\``
                )
                .addFields({
                    name: "Status",
                    value: "⏳ Triggering webhook...",
                    inline: false,
                })
                .setFooter({ text: "Powered by MENI" })
                .setTimestamp();

            await i.update({ embeds: [triggeringEmbed], components: [] });

            try {
                // Trigger webhook
                let webhookResult = null;
                try {
                    webhookResult = await client.triggerStackWebhook(
                        stackConfig.gitOpsWebhook
                    );
                } catch (error: any) {
                    console.error(
                        `❌ Failed to trigger webhook:`,
                        error.message
                    );
                    webhookResult = {
                        success: false,
                        message: error.message,
                    };
                }

                // Build results embed
                const embedColor = webhookResult?.success !== false
                    ? 0x00ff00
                    : 0xff0000;

                const resultEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle(
                        webhookResult?.success !== false
                            ? "✅ Webhook Triggered Successfully"
                            : "❌ Webhook Trigger Failed"
                    )
                    .setDescription(
                        webhookResult?.success !== false
                            ? `Webhook triggered for stack **${stackName}**`
                            : `Failed to trigger webhook for stack **${stackName}**`
                    )
                    .addFields(
                        {
                            name: "Stack",
                            value: stackName,
                            inline: true,
                        },
                        {
                            name: "Endpoint",
                            value: `${endpointId}`,
                            inline: true,
                        }
                    )
                    .setFooter({ text: "Powered by MENI" })
                    .setTimestamp();

                // Add webhook result
                if (webhookResult) {
                    const webhookStatus = webhookResult.success ? "✅" : "❌";
                    resultEmbed.addFields({
                        name: "🪝 Webhook Status",
                        value: `${webhookStatus} ${webhookResult.message || "Triggered"}`,
                    });
                }

                await i.editReply({ embeds: [resultEmbed] });
            } catch (error: any) {
                console.error("Stack deploy error:", error);

                const errorEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("❌ Stack Deployment Error")
                    .setDescription(
                        error.message ||
                            "An unknown error occurred during stack deployment"
                    )
                    .setFooter({ text: "Powered by MENI" })
                    .setTimestamp();

                await i.editReply({ embeds: [errorEmbed] });
            }
        });

        collector.on("end", (collected) => {
            if (collected.size === 0) {
                interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xff0000)
                            .setTitle("⏰ Timeout")
                            .setDescription("Stack selection timed out.")
                            .setFooter({ text: "Powered by MENI" })
                            .setTimestamp(),
                    ],
                    components: [],
                });
            }
        });
    } catch (error: any) {
        throw error;
    }
}
