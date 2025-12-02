import {
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
    getGitLabProjectId,
    findStackForService,
    getAllServices,
} from "../../utils/deployConfigUtils";
import { getServiceSelectOptions, createErrorEmbed } from "./utils";

/**
 * Handle /deploy create-tag command - Create tag and update YAML without deploying
 */
export async function handleCreateTag(
    interaction: ChatInputCommandInteraction
): Promise<void> {
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

        // Create select menu with services
        const options = getServiceSelectOptions();

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

            const { stackName } = stackInfo;

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
        console.error("Create tag error:", error);

        const errorEmbed = createErrorEmbed(
            "❌ Failed to Initialize Tag Creation",
            error.message || "An unknown error occurred"
        );

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

