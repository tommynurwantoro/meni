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
    ImagePullProgress,
} from "../utils/portainerClient";
import { GitLabClient } from "../utils/gitlabClient";
import {
    extractCurrentImageTag,
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
            .setName("list")
            .setDescription("List all available endpoints and stacks to deploy")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("tags")
            .setDescription("Get latest 3 tags for a service from GitLab")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("create-tag")
            .setDescription("Create a new tag for a service in GitLab")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("stack")
            .setDescription("Deploy a stack by pulling images and triggering webhook")
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
            case "list":
                await handleList(interaction);
                break;
            case "tags":
                await handleGetTags(interaction);
                break;
            case "create-tag":
                await handleCreateTag(interaction);
                break;
            case "stack":
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
 * Handle /deploy stack command - Pull images for all services and trigger webhook
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
                `Select a stack to deploy on endpoint \`${endpointId}\`. This will pull images for all services and trigger the webhook.`
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

            // Check if user has GitLab token
            const { hasGitLabToken, getGitLabToken } = await import("./gitlab");
            const hasToken = await hasGitLabToken(i.user.id);

            if (!hasToken) {
                const noTokenEmbed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("🔐 GitLab Token Required")
                    .setDescription(
                        "You need to configure your GitLab personal access token to deploy stacks."
                    )
                    .addFields({
                        name: "How to Set Token",
                        value: "Use `/gitlab token` to set your token",
                        inline: false,
                    })
                    .setFooter({ text: "Powered by MENI" })
                    .setTimestamp();

                await i.update({ embeds: [noTokenEmbed], components: [] });
                return;
            }

            const userToken = await getGitLabToken(i.user.id);
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

            // Show deploying embed
            const deployingEmbed = new EmbedBuilder()
                .setColor(0xffa500)
                .setTitle("🚀 Starting Stack Deployment")
                .setDescription(
                    `Deploying stack **${stackName}** on endpoint \`${endpointId}\``
                )
                .addFields({
                    name: "Status",
                    value: "⏳ Pulling images for all services...",
                    inline: false,
                })
                .setFooter({ text: "Powered by MENI" })
                .setTimestamp();

            await i.update({ embeds: [deployingEmbed], components: [] });

            try {
                // Get GitLab client
                const gitlabUrl = process.env.GITLAB_URL;
                if (!gitlabUrl) {
                    throw new Error("GitLab URL is not configured");
                }

                const gitlabClient = new GitLabClient({
                    baseUrl: gitlabUrl,
                    token: userToken,
                });

                // Get YAML file to read current tags
                let yamlContent: string;
                try {
                    yamlContent = await gitlabClient.getFileRawContent(
                        stackConfig.gitOpsRepoId,
                        stackConfig.gitOpsFilePath,
                        stackConfig.gitOpsBranch
                    );
                } catch (error: any) {
                    throw new Error(
                        `Failed to fetch GitOps configuration: ${error.message}`
                    );
                }

                // Get all services in the stack
                const services = stackConfig.services;
                const pullResults: Array<{
                    serviceName: string;
                    success: boolean;
                    pullResults: ImagePullProgress[];
                    error?: string;
                }> = [];

                // Pull images for each service
                for (const serviceName of services) {
                    try {
                        // Get current tag from YAML (service name in YAML is just the service name)
                        const currentTag = extractCurrentImageTag(
                            yamlContent,
                            serviceName
                        );

                        if (!currentTag) {
                            console.warn(
                                `⚠️ Could not find current tag for service ${serviceName} in YAML, skipping pull`
                            );
                            pullResults.push({
                                serviceName,
                                success: false,
                                pullResults: [],
                                error: "Tag not found in YAML",
                            });
                            continue;
                        }

                        // Construct Portainer service name (Docker Swarm format: stack_service)
                        const portainerServiceName = `${stackName}_${serviceName}`;

                        // Pull image on all nodes
                        const pullResult = await client.deployService(
                            endpointId,
                            portainerServiceName,
                            currentTag
                        );

                        pullResults.push({
                            serviceName,
                            success: true,
                            pullResults: pullResult.pullResults,
                        });
                    } catch (error: any) {
                        console.error(
                            `❌ Failed to pull image for ${serviceName}:`,
                            error.message
                        );
                        pullResults.push({
                            serviceName,
                            success: false,
                            pullResults: [],
                            error: error.message,
                        });
                    }
                }

                // Trigger webhook
                let webhookResult = null;
                if (stackConfig.gitOpsWebhook) {
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
                }

                // Build results embed
                const successCount = pullResults.filter((r) => r.success).length;
                const failedCount = pullResults.filter((r) => !r.success).length;
                const embedColor =
                    failedCount === 0 && webhookResult?.success !== false
                        ? 0x00ff00
                        : 0xffa500;

                const resultEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle(
                        failedCount === 0 && webhookResult?.success !== false
                            ? "✅ Stack Deployment Initiated"
                            : "⚠️ Stack Deployment Partially Completed"
                    )
                    .setDescription(
                        `Deployment initiated for stack **${stackName}**`
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
                        },
                        {
                            name: "Services",
                            value: `${successCount}/${services.length} pulled successfully`,
                            inline: true,
                        }
                    )
                    .setFooter({ text: "Powered by MENI" })
                    .setTimestamp();

                // Add pull results
                let pullResultsText = "";
                pullResults.forEach((result) => {
                    if (result.success) {
                        const successfulPulls = result.pullResults.filter(
                            (r) => r.status === "success"
                        ).length;
                        pullResultsText += `✅ **${result.serviceName}**: ${successfulPulls}/${result.pullResults.length} nodes\n`;
                    } else {
                        pullResultsText += `❌ **${result.serviceName}**: ${result.error || "Failed"}\n`;
                    }
                });

                if (pullResultsText) {
                    resultEmbed.addFields({
                        name: "📦 Image Pull Results",
                        value:
                            pullResultsText.length > 1024
                                ? pullResultsText.substring(0, 1021) + "..."
                                : pullResultsText,
                    });
                }

                // Add webhook result
                if (webhookResult) {
                    const webhookStatus = webhookResult.success ? "✅" : "❌";
                    resultEmbed.addFields({
                        name: "🪝 Webhook Trigger",
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
