import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
} from "discord.js";
import { PortainerClient } from "../../utils/portainerClient";
import {
    getStacksForEndpoint,
    getStackConfig,
} from "../../utils/deployConfigUtils";
import { createErrorEmbed } from "./utils";

/**
 * Handle /deploy apply-stack command - Trigger webhook for selected stack
 */
export async function handleApplyStack(
    interaction: ChatInputCommandInteraction,
    portainerClient: PortainerClient
): Promise<void> {
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
                const errorEmbed = createErrorEmbed(
                    "❌ Stack Not Found",
                    `Stack "${stackName}" configuration not found.`
                );

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
                    webhookResult = await portainerClient.triggerStackWebhook(
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

                const errorEmbed = createErrorEmbed(
                    "❌ Stack Deployment Error",
                    error.message ||
                        "An unknown error occurred during stack deployment"
                );

                await i.editReply({ embeds: [errorEmbed] });
            }
        });

        collector.on("end", (collected) => {
            if (collected.size === 0) {
                interaction.editReply({
                    embeds: [
                        createErrorEmbed(
                            "⏰ Timeout",
                            "Stack selection timed out."
                        ),
                    ],
                    components: [],
                });
            }
        });
    } catch (error: any) {
        throw error;
    }
}

