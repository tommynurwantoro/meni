import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
} from "discord.js";
import { getPortainerClient } from "../../utils/portainerClient";
import { checkDeployPermissions, createErrorEmbed } from "./utils";
import { handleListEndpoints } from "./handleListEndpoints";
import { handleListTags } from "./handleListTags";
import { handleCreateTag } from "./handleCreateTag";
import { handleSwitchTag } from "./handleSwitchTag";
import { handleApplyStack } from "./handleApplyStack";

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
        const hasPermission = await checkDeployPermissions(interaction);
        if (!hasPermission) {
            return;
        }

        const portainerClient = getPortainerClient();

        switch (subcommand) {
            case "list-endpoints":
                await handleListEndpoints(interaction);
                break;
            case "list-tags":
                await handleListTags(interaction);
                break;
            case "create-tag":
                await handleCreateTag(interaction);
                break;
            case "switch-tag":
                await handleSwitchTag(interaction);
                break;
            case "apply-stack":
                await handleApplyStack(interaction, portainerClient);
                break;
        }
    } catch (error: any) {
        console.error("Deploy command error:", error);

        const errorEmbed = createErrorEmbed(
            "❌ Deployment Error",
            error.message || "An unknown error occurred"
        );

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

