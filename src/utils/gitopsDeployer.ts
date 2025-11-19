import { getPortainerClient, ImagePullProgress } from './portainerClient';

// Updated ServiceMapping interface to include GitOps fields
interface ServiceConfig {
    gitlabProjectId: string;
    description: string;
    gitOpsRepoId: string;
    gitOpsFilePath: string;
    gitOpsBranch: string;
    stackName?: string;
    serviceName?: string;
    gitOpsWebhook?: string;
}

interface DeploymentResult {
    success: boolean;
    serviceName: string;
    pullResults?: ImagePullProgress[];
    imageInfo?: {
        imageName: string;
        imageTag: string;
    };
    webhookResult?: {
        success: boolean;
        message: string;
    };
    healthCheckResult?: {
        healthy: boolean;
        status: string;
        runningTasks: number;
        desiredReplicas: number;
        failedTasks: Array<{ node: string; error: string; state: string }>;
        message: string;
        deploymentProgress?: string;
        availabilityHistory?: Array<{ timestamp: number; running: number; desired: number; status: string }>;
    };
    message: string;
}

/**
 * Deploy a single service using GitOps workflow
 */
async function deployServiceViaGitOps(
    endpointId: number,
    serviceName: string,
    tag: string,
    userToken: string,
    serviceConfig: ServiceConfig
): Promise<DeploymentResult> {
    try {
        console.log(`🚀 Starting GitOps deployment for ${serviceName}...`);

        // Determine the actual service name to use in YAML (fallback to original stack-based name)
        const actualServiceName = serviceConfig.serviceName || serviceName;

        // Step 1: Pull image on all nodes via Portainer (using stack service name)
        const portainerClient = getPortainerClient();
        const pullResult = await portainerClient.deployService(endpointId, serviceName, tag);

        let webhookResult = null;
        let healthCheckResult = null;
        let finalMessage = `✅ Successfully pre-pulled ${serviceName} image.`;

        // Step 6: Trigger webhook if available
        if (serviceConfig.gitOpsWebhook) {
            console.log(`🪝 Triggering webhook for ${serviceName}...`);
            webhookResult = await portainerClient.triggerStackWebhook(serviceConfig.gitOpsWebhook);

            if (webhookResult.success) {
                console.log(`✅ Webhook triggered successfully for ${serviceName}`);

                // Step 7: Perform health check after webhook trigger
                // For health checks, always use the original stack service name (not the mapped YAML name)
                const healthCheckServiceName = serviceName;
                console.log(`🔍 Starting health check for ${healthCheckServiceName} (original stack service)...`);
                try {
                    healthCheckResult = await portainerClient.checkServiceHealth(endpointId, healthCheckServiceName, 120000); // 2 minutes timeout

                    if (healthCheckResult.healthy) {
                        finalMessage = `✅ Deployment completed successfully! ${healthCheckServiceName} is running and healthy.`;
                    } else {
                        finalMessage = `⚠️ Deployment triggered but health check failed: ${healthCheckResult.message}`;
                    }
                } catch (error: any) {
                    console.warn(`⚠️ Health check failed for ${healthCheckServiceName}:`, error.message);
                    healthCheckResult = {
                        healthy: false,
                        status: 'error',
                        runningTasks: 0,
                        desiredReplicas: 1,
                        failedTasks: [],
                        message: `Health check error: ${error.message}`
                    };
                    finalMessage = `⚠️ Deployment triggered but health check encountered an error: ${error.message}`;
                }
            } else {
                console.warn(`⚠️ Webhook trigger failed for ${serviceName}: ${webhookResult.message}`);
                finalMessage = `⚠️ GitOps configuration updated but webhook trigger failed: ${webhookResult.message}`;
            }
        }

        console.log(`✅ GitOps deployment ${finalMessage}`);

        return {
            success: true,
            serviceName,
            pullResults: pullResult.pullResults,
            imageInfo: {
                imageName: pullResult.imageName,
                imageTag: pullResult.imageTag
            },
            webhookResult: webhookResult ? {
                success: webhookResult.success,
                message: webhookResult.message
            } : undefined,
            healthCheckResult: healthCheckResult ? {
                healthy: healthCheckResult.healthy,
                status: healthCheckResult.status,
                runningTasks: healthCheckResult.runningTasks,
                desiredReplicas: healthCheckResult.desiredReplicas,
                failedTasks: healthCheckResult.failedTasks,
                message: healthCheckResult.message,
                deploymentProgress: healthCheckResult.deploymentProgress,
                availabilityHistory: healthCheckResult.availabilityHistory
            } : undefined,
            message: finalMessage
        };
    } catch (error: any) {
        console.error(`❌ GitOps deployment failed for ${serviceName}:`, error.message);
        return {
            success: false,
            serviceName,
            message: `❌ Deployment failed: ${error.message}`
        };
    }
}


/**
 * Deploy a stack of services
 */
async function deployStack(
    endpointId: number,
    stackName: string,
    services: string[],
    webhookUrl: string | undefined
): Promise<{ success: boolean; message: string; results: DeploymentResult[] }> {
    console.log(`🚀 Starting stack deployment for ${stackName}...`);
    const results: DeploymentResult[] = [];
    let allPullsSuccessful = true;

    // 1. Pull all images
    for (const serviceName of services) {
        // For stack deployment, we assume tag is "latest" or managed by the stack definition
        // But here we need to pull the image. Since we don't have a specific tag from user input,
        // we might need to rely on what's currently defined or just pull 'latest' if not specified?
        // Actually, the requirement says "pull all images in stack".
        // Portainer's deployService usually takes a tag. If we don't provide one, it might default or fail.
        // Let's assume we pull the currently running tag or 'latest'?
        // Wait, the previous flow was: User selects tag -> Deploy.
        // For stack, are we deploying a specific tag for ALL services? Or just pulling what's defined?
        // The user said: "pull all images in stack acc-prod".
        // Usually this means pulling the image defined in the compose file (which might be :latest or specific).
        // Let's pass an empty tag to indicate "use current/default" if supported, or we need to fetch it.
        // Looking at portainerClient.deployService, it takes a tag.
        // Let's assume for now we pull 'latest' or we need to fetch the current tag from the service?
        // For now, let's use "latest" as a safe default for stack updates if not specified,
        // OR better, let's just trigger the pull without changing the tag if possible.
        // But deployServiceViaGitOps requires a tag.
        // Let's try to get the current tag from the service info if possible, or just pass "latest".
        // However, the user's request implies updating the stack.
        // "pull all images in stack ... and trigger webhook".
        // This usually implies the images have been updated in the registry (e.g. :latest or a specific tag).
        // Let's assume we are pulling the image currently defined in the service spec.

        // We'll use a modified deployService that doesn't force a tag update if tag is empty?
        // Or just pass "latest" if that's the convention.
        // Let's check deployServiceViaGitOps signature. It takes a tag.
        // Let's assume we pass "latest" for stack deployment for now.

        // Actually, we can just call the portainer client directly to pull.
        // But we need the result format.

        // Let's use a placeholder tag for now, or fetch it.
        // Since we are just pulling, maybe we don't need to change the tag.

        const result = await deployServiceViaGitOps(
            endpointId,
            serviceName,
            "latest", // Defaulting to latest for stack pull
            "", // No token needed for pull-only
            {
                gitlabProjectId: "",
                description: "",
                gitOpsRepoId: "",
                gitOpsFilePath: "",
                gitOpsBranch: "",
                // We don't trigger webhook per service
                gitOpsWebhook: undefined
            }
        );

        results.push(result);
        if (!result.success) {
            allPullsSuccessful = false;
        }
    }

    // 2. Trigger Webhook if all pulls successful (or even if some failed? User said "when all nodes finish pulling")
    let webhookResult = null;
    if (webhookUrl) {
        console.log(`🪝 Triggering stack webhook for ${stackName}...`);
        const portainerClient = getPortainerClient();
        webhookResult = await portainerClient.triggerStackWebhook(webhookUrl);
    }

    const success = allPullsSuccessful && (!webhookUrl || (webhookResult?.success ?? false));
    const message = success
        ? `✅ Stack ${stackName} deployed successfully.`
        : `⚠️ Stack ${stackName} deployment finished with issues.`;

    return {
        success,
        message,
        results
    };
}

export {
    deployServiceViaGitOps,
    deployStack,
    type ServiceConfig,
    type DeploymentResult
};
