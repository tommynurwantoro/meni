import { ModalSubmitInteraction, MessageFlags, EmbedBuilder } from "discord.js";
import { validateServiceExists, extractCurrentImageTag, updateImageTagInYaml, generateCommitMessage, validateYamlContent } from "../../utils/gitopsUtils";
import { monitorPipelineStatus } from "../../utils/pipelineUtils";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Handle GitLab token modal submission
 */
export async function handleGitLabTokenModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const token = interaction.fields.getTextInputValue("gitlab_token").trim();

    // Save the token
    const { saveGitLabToken } = await import("../../commands/gitlab");
    await saveGitLabToken(interaction.user.id, token);

    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle("✅ Token Saved Successfully")
      .setDescription(
        "Your GitLab personal access token has been encrypted and stored securely.\n\n" +
          "You can now use GitLab features like:\n" +
          "• `/deploy tags` - View repository tags\n" +
          "• `/deploy create-tag` - Create new tags"
      )
      .addFields({
        name: "Security",
        value:
          "🔒 Your token is encrypted using AES-256-GCM encryption and stored securely in the database.",
        inline: false,
      })
      .setFooter({ text: "Powered by MENI" })
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error: any) {
    console.error("Save GitLab token modal error:", error);

    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle("❌ Failed to Save Token")
      .setDescription(
        error.message || "An unknown error occurred while saving your token"
      )
      .setFooter({ text: "Powered by MENI" })
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

/**
 * Handle create tag modal submission
 */
export async function handleCreateTagModal(interaction: ModalSubmitInteraction): Promise<void> {
  try {
    // Parse custom ID to get service name, project ID, and stack name
    // Format: create_tag_modal_serviceName_projectId_stackName
    const customIdParts = interaction.customId.split("_");
    const stackName = customIdParts.pop(); // Last part is stack name
    const projectId = customIdParts.pop(); // Second to last is project ID
    customIdParts.shift(); // Remove "create"
    customIdParts.shift(); // Remove "tag"
    customIdParts.shift(); // Remove "modal"
    const serviceName = customIdParts.join("_"); // Rest is service name

    if (!projectId || !serviceName || !stackName) {
      await interaction.reply({
        content: "❌ Invalid modal data.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Get form values
    const tagName = interaction.fields.getTextInputValue("tag_name").trim();
    const tagMessage = interaction.fields.getTextInputValue("tag_message").trim();

    // Get the original message that triggered this modal
    const originalMessage = interaction.message;
    if (!originalMessage) {
      await interaction.reply({
        content: "❌ Could not find original message.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Acknowledge the modal submission
    await interaction.deferUpdate();

    // Update the original message to show loading state
    const loadingEmbed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle("🔄 Creating Tag and Updating YAML")
      .setDescription(`Creating tag **${tagName}** for **${serviceName}** and updating GitOps configuration...`)
      .setFooter({ text: "Powered by MENI" })
      .setTimestamp();

    await originalMessage.edit({ embeds: [loadingEmbed], components: [] });

    // Get user's GitLab token
    const { getGitLabToken } = await import("../../commands/gitlab");
    const userToken = await getGitLabToken(interaction.user.id);
    
    if (!userToken) {
      const noTokenEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle("🔐 GitLab Token Not Found")
        .setDescription("Your GitLab token could not be retrieved. Please set it again using `/gitlab token`.")
        .setFooter({ text: "Powered by MENI" })
        .setTimestamp();
      
      await originalMessage.edit({ embeds: [noTokenEmbed], components: [] });
      return;
    }

    // Import GitLab client and create instance with user's token
    const { GitLabClient } = await import("../../utils/gitlabClient");
    const gitlabUrl = process.env.GITLAB_URL;
    
    if (!gitlabUrl) {
      throw new Error("GitLab URL is not configured");
    }
    
    const gitlabClient = new GitLabClient({ baseUrl: gitlabUrl, token: userToken });

    // Load stack config to get GitOps info
    const whitelistPath = join(process.cwd(), "whitelist_deploy.json");
    const whitelistData = readFileSync(whitelistPath, "utf-8");
    const whitelist = JSON.parse(whitelistData);
    const stackConfig = whitelist.stacks?.[stackName];

    if (!stackConfig) {
      throw new Error(`Stack "${stackName}" configuration not found`);
    }

    // Create the tag (from main branch)
    const tag = await gitlabClient.createTag(projectId, tagName, "main", tagMessage);

    // Update YAML file with new tag
    let yamlUpdated = false;
    let yamlCommitInfo = null;
    
    try {
      // Get current YAML content
      const yamlContent = await gitlabClient.getFileRawContent(
        stackConfig.gitOpsRepoId,
        stackConfig.gitOpsFilePath,
        stackConfig.gitOpsBranch
      );

      if (!validateServiceExists(yamlContent, serviceName)) {
        throw new Error(`Service "${serviceName}" not found in GitOps configuration file`);
      }

      // Extract current tag and update YAML
      const currentTag = extractCurrentImageTag(yamlContent, serviceName);
      let updatedYamlContent = updateImageTagInYaml(yamlContent, serviceName, tagName);

      // Validate and commit changes back to GitLab
      const commitMessage = generateCommitMessage(serviceName, tagName, currentTag || undefined);
      
      // Validate and clean YAML content before upload
      updatedYamlContent = validateYamlContent(updatedYamlContent);
      
      await gitlabClient.updateFile(
        stackConfig.gitOpsRepoId,
        stackConfig.gitOpsFilePath,
        stackConfig.gitOpsBranch,
        updatedYamlContent,
        commitMessage
      );

      yamlUpdated = true;
    } catch (error: any) {
      console.error(`⚠️ Failed to update YAML file: ${error.message}`);
      // Continue - tag was created successfully, YAML update failed
    }

    // Success embed with user info
    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle("✅ Tag Created Successfully")
      .setDescription(`Tag **${tagName}** has been created for **${serviceName}** in GitLab by <@${interaction.user.id}>`)
      .addFields(
        { name: "Tag Name", value: tagName, inline: true },
        { name: "Project ID", value: projectId, inline: true },
        { name: "Branch", value: "main", inline: true },
        { name: "Commit", value: tag.commit.short_id, inline: true },
        { name: "Commit Author", value: tag.commit.author_name, inline: true },
        { name: "Created At", value: new Date(tag.commit.created_at).toLocaleString("id-ID"), inline: true },
        { name: "Tag Message", value: tagMessage, inline: false },
        { name: "Created By", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Created On", value: new Date().toLocaleString("id-ID"), inline: true }
      )
      .setFooter({ text: "Powered by MENI" })
      .setTimestamp();

    // Add YAML update info if successful
    if (yamlUpdated && yamlCommitInfo) {
      successEmbed.addFields({
        name: "📝 GitOps YAML Updated",
        value: `✅ Updated \`${stackConfig.gitOpsFilePath}\``,
        inline: false,
      });
      successEmbed.setDescription(
        `Tag **${tagName}** created and GitOps configuration updated. Monitoring pipeline status...`
      );
    } else if (!yamlUpdated) {
      successEmbed.addFields({
        name: "⚠️ YAML Update Failed",
        value: "Tag was created but YAML file could not be updated. Please update manually.",
        inline: false,
      });
    }

    // Edit the original message with success
    await originalMessage.edit({ embeds: [successEmbed], components: [] });

    // Check and monitor pipeline status if YAML was updated
    if (yamlUpdated) {
      const commitSha = tag?.commit?.id;
      
      if (commitSha) {
        console.log(`🔍 Starting pipeline monitoring for commit: ${commitSha.substring(0, 8)}`);
        // Start pipeline monitoring in background
        monitorPipelineStatus(
          gitlabClient,
          projectId,
          commitSha,
          originalMessage,
          interaction.channel,
          serviceName,
          tagName
        ).catch((error) => {
          console.error("❌ Pipeline monitoring error:", error);
        });
      } else {
        console.warn("❌ No commit SHA available for pipeline monitoring.");
      }
    }
  } catch (error: any) {
    console.error("❌ Create tag modal error:", error);

    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle("❌ Failed to Create Tag")
      .setDescription(error.message || "An unknown error occurred while creating the tag")
      .addFields(
        { name: "Attempted By", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Time", value: new Date().toLocaleString("id-ID"), inline: true }
      )
      .setFooter({ text: "Powered by MENI" })
      .setTimestamp();

    // Try to edit the original message, fallback to reply if not available
    const originalMessage = interaction.message;
    if (originalMessage) {
      await originalMessage.edit({ embeds: [errorEmbed], components: [] });
    } else if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [errorEmbed], components: [] });
    } else {
      await interaction.reply({
        embeds: [errorEmbed],
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

