import { ModalSubmitInteraction, MessageFlags, EmbedBuilder } from "discord.js";

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
      .setTitle("🔄 Creating Tag")
      .setDescription(`Creating tag **${tagName}** for **${serviceName}** in GitLab...`)
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

    // Create the tag (from main branch)
    const tag = await gitlabClient.createTag(projectId, tagName, "main", tagMessage);

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
        { name: "Created On", value: new Date().toLocaleString("id-ID"), inline: true },
        { 
          name: "📝 Next Step", 
          value: `Use \`/deploy switch-tag\` to update the GitOps YAML with this new tag.`, 
          inline: false 
        }
      )
      .setFooter({ text: "Powered by MENI" })
      .setTimestamp();

    // Edit the original message with success
    await originalMessage.edit({ embeds: [successEmbed], components: [] });
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

