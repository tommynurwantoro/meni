import { EmbedBuilder, TextChannel } from "discord.js";

/**
 * Safely convert timestamp from embed data to Date or null
 */
export function safeTimestamp(timestamp: any): Date | null {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'number') return new Date(timestamp);
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Get emoji for pipeline status
 */
export function getPipelineStatusEmoji(status: string): string {
  switch (status) {
    case "success":
      return "✅";
    case "failed":
      return "❌";
    case "running":
      return "🔄";
    case "pending":
      return "⏳";
    case "canceled":
      return "🚫";
    case "skipped":
      return "⏭️";
    default:
      return "❓";
  }
}

/**
 * Get human-readable text for pipeline status
 */
export function getPipelineStatusText(status: string): string {
  switch (status) {
    case "success":
      return "Completed Successfully";
    case "failed":
      return "Failed";
    case "running":
      return "Running";
    case "pending":
      return "Pending";
    case "canceled":
      return "Canceled";
    case "skipped":
      return "Skipped";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

/**
 * Check if pipeline status indicates it's finished
 */
export function isPipelineFinished(status: string): boolean {
  return ["success", "failed", "canceled", "skipped"].includes(status);
}

/**
 * Copy embed fields excluding pipeline status fields
 */
function copyEmbedFieldsExcludingPipelineStatus(
  embed: EmbedBuilder,
  fields: any[]
): void {
  if (fields) {
    fields.forEach((field: any) => {
      const pipelineStatusFieldNames = [
        "⏳ Pipeline Status",
        "✅ Pipeline Status",
        "ℹ️ Pipeline Status",
        "⏰ Pipeline Status"
      ];
      if (!pipelineStatusFieldNames.includes(field.name)) {
        embed.addFields(field);
      }
    });
  }
}

/**
 * Create embed from existing embed data with pipeline status
 */
export function createEmbedWithPipelineStatus(
  originalEmbedData: any,
  pipelineStatusName: string,
  pipelineStatusValue: string,
  description?: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(originalEmbedData.color || 0x00FF00)
    .setTitle(originalEmbedData.title || "✅ Tag Created Successfully")
    .setDescription(description || originalEmbedData.description || "")
    .setFooter(originalEmbedData.footer || { text: "Powered by MENI" });
  
  const safeTs = safeTimestamp(originalEmbedData.timestamp);
  if (safeTs) {
    embed.setTimestamp(safeTs);
  }

  copyEmbedFieldsExcludingPipelineStatus(embed, originalEmbedData.fields || []);

  embed.addFields({
    name: pipelineStatusName,
    value: pipelineStatusValue,
    inline: false,
  });

  return embed;
}

/**
 * Send pipeline completion notification in the channel
 */
export async function sendPipelineNotification(
  channel: any,
  serviceName: string,
  tagName: string,
  pipeline: any,
  projectId: string,
  commitSha: string
): Promise<void> {
  if (!channel || !(channel instanceof TextChannel)) {
    return; // Can't send notification if channel is not available
  }

  const statusEmoji = getPipelineStatusEmoji(pipeline.status);
  const statusText = getPipelineStatusText(pipeline.status);
  const embedColor = pipeline.status === "success" ? 0x00ff00 : pipeline.status === "failed" ? 0xff0000 : 0xffa500;

  const gitlabUrl = process.env.GITLAB_URL || "";
  const pipelineUrl = gitlabUrl
    ? `${gitlabUrl.replace(/\/$/, "")}/${projectId}/-/pipelines/${pipeline.id}`
    : null;

  const notificationEmbed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`${statusEmoji} Pipeline ${statusText}`)
    .setDescription(
      `Pipeline for **${serviceName}** tag **${tagName}** has ${statusText.toLowerCase()}.`
    )
    .addFields(
      { name: "Service", value: serviceName, inline: true },
      { name: "Tag", value: tagName, inline: true },
      { name: "Pipeline ID", value: `\`${pipeline.id}\``, inline: true },
      { name: "Status", value: statusText, inline: true },
      { name: "Commit", value: `\`${commitSha.substring(0, 8)}\``, inline: true }
    )
    .setFooter({ text: "Powered by MENI" })
    .setTimestamp();

  if (pipelineUrl) {
    notificationEmbed.setURL(pipelineUrl);
    notificationEmbed.addFields({
      name: "🔗 Pipeline Link",
      value: `[View Pipeline](${pipelineUrl})`,
      inline: false,
    });
  }

  try {
    await channel.send({ embeds: [notificationEmbed] });
  } catch (error) {
    console.error("❌ Failed to send pipeline notification:", error);
  }
}

/**
 * Monitor pipeline status for a commit and send notification when it completes
 */
export async function monitorPipelineStatus(
  gitlabClient: any,
  projectId: string,
  commitSha: string,
  originalMessage: any,
  channel: any,
  serviceName: string,
  tagName: string
): Promise<void> {
  const maxWaitTime = 10 * 60 * 1000; // 10 minutes
  const pollInterval = 15 * 1000; // 15 seconds
  const initialWait = 5 * 1000; // Wait 5 seconds before first check
  const startTime = Date.now();

  // Wait a bit for pipeline to start
  await new Promise((resolve) => setTimeout(resolve, initialWait));

  let pipelineId: number | null = null;
  let lastStatus: string | null = null;

  // Update original message to show pipeline monitoring
  const originalEmbedData = originalMessage.embeds[0]?.data || {};
  const monitoringEmbed = createEmbedWithPipelineStatus(
    originalEmbedData,
    "⏳ Pipeline Status",
    "Waiting for pipeline to start...",
    `Tag **${tagName}** created and GitOps configuration updated.\n🔍 Monitoring pipeline status...`
  );

  try {
    await originalMessage.edit({ embeds: [monitoringEmbed] });
  } catch (error) {
    console.error("❌ Failed to update message:", error);
  }

  // Poll for pipeline status
  while (Date.now() - startTime < maxWaitTime) {
    console.log("🔍 Polling for pipeline status...");
    try {
      // Get pipelines for this commit
      const pipelines = await gitlabClient.getPipelinesForCommit(projectId, commitSha);

      if (pipelines.length > 0) {
        // Use the most recent pipeline
        const pipeline = pipelines[0];
        pipelineId = pipeline.id;
        const status = pipeline.status;

        // If status changed, update the message
        if (status !== lastStatus) {
          lastStatus = status;

          const statusEmoji = getPipelineStatusEmoji(status);
          const statusText = getPipelineStatusText(status);

          const currentEmbedData = originalMessage.embeds[0]?.data || {};
          const updatedEmbed = createEmbedWithPipelineStatus(
            currentEmbedData,
            "⏳ Pipeline Status",
            `${statusEmoji} ${statusText}\nPipeline ID: \`${pipelineId}\``
          );

          try {
            await originalMessage.edit({ embeds: [updatedEmbed] });
          } catch (error) {
            console.error("❌ Failed to update message:", error);
          }
        }

        // Check if pipeline is finished
        if (isPipelineFinished(status)) {
          // Send notification in channel
          await sendPipelineNotification(
            channel,
            serviceName,
            tagName,
            pipeline,
            projectId,
            commitSha
          );

          // Update original message with final status
          const currentEmbedData = originalMessage.embeds[0]?.data || {};
          const finalEmoji = getPipelineStatusEmoji(status);
          const finalText = getPipelineStatusText(status);
          const finalEmbed = createEmbedWithPipelineStatus(
            currentEmbedData,
            "✅ Pipeline Status",
            `${finalEmoji} ${finalText}\nPipeline ID: \`${pipelineId}\``,
            `Tag **${tagName}** created and GitOps configuration updated. Pipeline ${finalText.toLowerCase()}.`
          );

          try {
            await originalMessage.edit({ embeds: [finalEmbed] });
          } catch (error) {
            console.error("❌ Failed to update message:", error);
          }

          return; // Pipeline finished, stop monitoring
        }
      } else if (Date.now() - startTime > 30 * 1000) {
        // If no pipeline found after 30 seconds, might not have CI/CD configured
        const currentEmbedData = originalMessage.embeds[0]?.data || {};
        const updatedEmbed = createEmbedWithPipelineStatus(
          currentEmbedData,
          "ℹ️ Pipeline Status",
          "No pipeline found for this commit. CI/CD may not be configured.",
          `Tag **${tagName}** created and GitOps configuration updated. Ready for deployment via \`/deploy stack\`.`
        );

        try {
          await originalMessage.edit({ embeds: [updatedEmbed] });
        } catch (error) {
          console.error("❌ Failed to update message:", error);
        }
        return;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (error: any) {
      console.error("❌ Error checking pipeline status:", error);
      // Continue polling despite errors
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  // Timeout reached
  if (pipelineId && lastStatus && !isPipelineFinished(lastStatus)) {
    const currentEmbedData = originalMessage.embeds[0]?.data || {};
    const timeoutEmbed = createEmbedWithPipelineStatus(
      currentEmbedData,
      "⏰ Pipeline Status",
      `⏳ Still running (monitoring timeout)\nPipeline ID: \`${pipelineId}\`\nStatus: ${getPipelineStatusText(lastStatus)}`
    );
    timeoutEmbed.setColor(0xFFA500);

    try {
      await originalMessage.edit({ embeds: [timeoutEmbed] });
    } catch (error) {
      console.error("❌ Failed to update message:", error);
    }
  }
}

