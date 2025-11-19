
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ModalSubmitInteraction,
    AutocompleteInteraction,
} from "discord.js";
import {
    getPortainerClient,
    ImagePullProgress,
    Service,
} from "../utils/portainerClient";
import {
    deployServiceViaGitOps,
    deployStack,
    type ServiceConfig,
} from "../utils/gitopsDeployer";
import {
    getWhitelistConfig,
    getWhitelistedServices,
    filterWhitelistedServices,
    getGitLabProjectId,
    getServiceConfig,
    getWhitelistedEndpoints,
    isEndpointWhitelisted,
    getStacks,
    getServicesByStack,
    getStackConfig
} from "../utils/deploymentConfig";
import { join } from "path";



export const data = new SlashCommandBuilder()
    .setName("deploy")
    .setDescription("Deploy services using Portainer API")
    .addSubcommand((subcommand) =>
        subcommand
            .setName("service")
            .setDescription("Deploy a specific service interactively")
            .addIntegerOption((option) =>
                option
                    .setName("endpoint")
                    .setDescription("Portainer endpoint ID")
                    .setRequired(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("list")
            .setDescription("List all available services")
            .addIntegerOption((option) =>
                option
                    .setName("endpoint")
                    .setDescription("Portainer endpoint ID")
                    .setRequired(true)
            )
            .addStringOption((option) =>
                option
                    .setName("search")
                    .setDescription("Search services by name (optional)")
                    .setRequired(false)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("status")
            .setDescription("Check Portainer connection status")
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
            .addStringOption((option) =>
                option
                    .setName("service")
                    .setDescription("The service to tag")
                    .setRequired(false)
                    .setAutocomplete(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("stack")
            .setDescription("Deploy a stack of services")
            .addStringOption((option) =>
                option
                    .setName("name")
                    .setDescription("The name of the stack to deploy")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addIntegerOption((option) =>
                option
                    .setName("endpoint")
                    .setDescription("The endpoint ID to deploy to")
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
            case "tags":
                await handleGetTags(interaction);
                break;
            case "create-tag":
                await handleCreateTag(interaction);
                break;
            case "status":
                await handleStatus(interaction, client);
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

async function handleAutocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === "service") {
        const services = getWhitelistedServices();
        const filtered = services.filter((choice) =>
            choice.toLowerCase().includes(focusedOption.value.toLowerCase())
        );
        await interaction.respond(
            filtered
                .slice(0, 25)
                .map((choice) => ({ name: choice, value: choice }))
        );
    } else if (focusedOption.name === "name") { // Stack name autocomplete
        const stacks = getStacks();
        const filtered = stacks.filter((choice) =>
            choice.toLowerCase().includes(focusedOption.value.toLowerCase())
        );
        await interaction.respond(
            filtered
                .slice(0, 25)
                .map((choice) => ({ name: choice, value: choice }))
        );
    }
}




async function handleStatus(
    interaction: ChatInputCommandInteraction,
    client: any
) {
    await interaction.deferReply();

    try {
        const allEndpoints = await client.getEndpoints();
        const whitelist = getWhitelistedEndpoints();

        // Filter endpoints based on whitelist
        const endpoints =
            whitelist.length > 0
                ? allEndpoints.filter((ep: any) => whitelist.includes(ep.Id))
                : allEndpoints;

        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle("✅ Portainer Connection Status")
            .setDescription("Connected to Portainer API")
            .setFooter({ text: "Powered by MENI" })
            .setTimestamp();

        if (endpoints && endpoints.length > 0) {
            const endpointsList = endpoints
                .map(
                    (ep: any) =>
                        `**${ep.Name}** (ID: ${ep.Id}) - ${ep.Type === 2 ? "Docker Swarm" : "Docker"
                        }`
                )
                .join("\n");

            const fieldTitle =
                whitelist.length > 0
                    ? `📡 Whitelisted Endpoints (${endpoints.length}/${allEndpoints.length})`
                    : `📡 Available Endpoints (${endpoints.length})`;

            embed.addFields({
                name: fieldTitle,
                value:
                    endpointsList.length > 1024
                        ? endpointsList.substring(0, 1021) + "..."
                        : endpointsList,
            });
        } else if (whitelist.length > 0 && endpoints.length === 0) {
            embed.addFields({
                name: "⚠️ No Whitelisted Endpoints Found",
                value: "None of the whitelisted endpoint IDs exist in Portainer.",
            });
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
        throw error;
    }
}

/**
 * Handle /deploy tags command
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

        // Get whitelisted services
        const services = getWhitelistedServices();

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
            const config = getWhitelistConfig();
            const description =
                config?.serviceMapping?.[service]?.description ||
                "No description";

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
                "Select a service to view its latest 5 tags from GitLab."
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
                const { GitLabClient } = await import("../utils/gitlabClient");
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
                tags.forEach((tag, index) => {
                    const commitDate = new Date(
                        tag.commit.committed_date
                    ).toLocaleString("en-US", {
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

async function handleStackDeploy(
    interaction: ChatInputCommandInteraction,
    client: any
) {
    const stackName = interaction.options.getString("name", true);
    const endpointId = interaction.options.getInteger("endpoint", true);

    await interaction.deferReply();

    // Validate endpoint
    if (!isEndpointWhitelisted(endpointId)) {
        const notAllowedEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle("❌ Access Denied")
            .setDescription(`Endpoint ID \`${endpointId}\` is not whitelisted.`)
            .setFooter({ text: "Contact admin to add this endpoint to the whitelist" })
            .setTimestamp();
        await interaction.editReply({ embeds: [notAllowedEmbed] });
        return;
    }

    // Get services for stack
    const services = getServicesByStack(stackName);
    if (services.length === 0) {
        const notFoundEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle("❌ Stack Not Found")
            .setDescription(`Stack **${stackName}** not found or has no services.`)
            .setFooter({ text: "Powered by MENI" })
            .setTimestamp();
        await interaction.editReply({ embeds: [notFoundEmbed] });
        return;
    }

    // Get stack config (webhook)
    const stackConfig = getStackConfig(stackName);
    const webhookUrl = stackConfig?.gitOpsWebhook;

    try {
        const progressEmbed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle(`🚀 Deploying Stack: ${stackName}`)
            .setDescription(`Pulling images for ${services.length} services...\n\n${services.map(s => `⏳ ${s}`).join('\n')}`)
            .setFooter({ text: "Powered by MENI" })
            .setTimestamp();

        await interaction.editReply({ embeds: [progressEmbed] });

        // Execute deployment
        const result = await deployStack(endpointId, stackName, services, webhookUrl);

        // Build result embed
        const resultEmbed = new EmbedBuilder()
            .setColor(result.success ? 0x00FF00 : 0xFFA500)
            .setTitle(result.success ? "✅ Stack Deployment Successful" : "⚠️ Stack Deployment Completed with Issues")
            .setDescription(result.message)
            .addFields(
                { name: "Stack", value: stackName, inline: true },
                { name: "Endpoint", value: endpointId.toString(), inline: true },
                { name: "Webhook Triggered", value: webhookUrl ? (result.success ? "Yes" : "Skipped/Failed") : "No Webhook", inline: true }
            )
            .setFooter({ text: "Powered by MENI" })
            .setTimestamp();

        // Add details for each service
        let details = "";
        result.results.forEach(r => {
            const icon = r.success ? "✅" : "❌";
            details += `${icon} **${r.serviceName}**: ${r.message}\n`;
        });

        if (details) {
            resultEmbed.addFields({ name: "Service Details", value: details.substring(0, 1024) });
        }

        await interaction.editReply({ embeds: [resultEmbed] });

    } catch (error: any) {
        console.error("Stack deploy error:", error);
        const errorEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle("❌ Stack Deployment Failed")
            .setDescription(error.message || "An unknown error occurred.")
            .setFooter({ text: "Powered by MENI" })
            .setTimestamp();
        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

/**
 * Handle /deploy create-tag command
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

        // Get whitelisted services
        const services = getWhitelistedServices();

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
            const config = getWhitelistConfig();
            const description =
                config?.serviceMapping?.[service]?.description ||
                "No description";

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

            // Create modal for tag details
            const modal = new ModalBuilder()
                .setCustomId(`create_tag_modal_${serviceName}_${projectId}`)
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


