import { GitLabClient } from './gitlabClient';
import { getPortainerClient, ImagePullProgress } from './portainerClient';
import { 
    updateImageTagInYaml, 
    extractCurrentImageTag,
    validateServiceExists,
    generateCommitMessage,
    validateYamlContent
} from './gitopsUtils';

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
    gitLabCommit?: {
        commitId: string;
        branch: string;
        filePath: string;
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

        // Step 2: Get current YAML from GitLab
        const gitlabClient = new GitLabClient({
            baseUrl: process.env.GITLAB_URL || 'https://gitlab.com',
            token: userToken
        });

        let yamlContent: string;
        try {
            yamlContent = await gitlabClient.getFile(
                serviceConfig.gitOpsRepoId,
                serviceConfig.gitOpsFilePath,
                serviceConfig.gitOpsBranch
            );
        } catch (error: any) {
            throw new Error(`Failed to fetch GitOps configuration: ${error.message}`);
        }

        // Step 3: Validate service exists in YAML
        if (!validateServiceExists(yamlContent, actualServiceName)) {
            throw new Error(`Service "${actualServiceName}" not found in GitOps configuration file`);
        }

        // Step 4: Extract current tag and update YAML
        const currentTag = extractCurrentImageTag(yamlContent, actualServiceName);
        let updatedYamlContent = updateImageTagInYaml(yamlContent, actualServiceName, tag);

        // Step 5: Validate and commit changes back to GitLab
        const commitMessage = generateCommitMessage(actualServiceName, tag, currentTag || undefined);
        
        // Validate and clean YAML content before upload
        try {
            updatedYamlContent = validateYamlContent(updatedYamlContent);
        } catch (error: any) {
            throw new Error(`Invalid YAML content before GitOps commit: ${error.message}`);
        }
        
        let gitLabCommit;
        try {
            gitLabCommit = await gitlabClient.updateFile(
                serviceConfig.gitOpsRepoId,
                serviceConfig.gitOpsFilePath,
                serviceConfig.gitOpsBranch,
                updatedYamlContent,
                commitMessage
            );
        } catch (error: any) {
            throw new Error(`Failed to commit GitOps configuration: ${error.message}`);
        }

        let webhookResult = null;
        let healthCheckResult = null;
        let finalMessage = `✅ Successfully pre-pulled ${serviceName} image and updated GitOps configuration. GitOps will deploy automatically.`;

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
            gitLabCommit: {
                commitId: gitLabCommit.commit_id,
                branch: gitLabCommit.branch,
                filePath: gitLabCommit.file_path
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

export {
    deployServiceViaGitOps,
    type ServiceConfig,
    type DeploymentResult
};
