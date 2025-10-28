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
    message: string;
}

interface MultiDeploymentResult {
    results: DeploymentResult[];
    groupedByRepo: Map<string, {
        success: boolean;
        services: string[];
        commitId?: string;
        branch: string;
        filePath: string;
        message: string;
    }>;
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

        console.log(`✅ GitOps deployment queued for ${serviceName} (commit: ${gitLabCommit.commit_id})`);

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
            message: `✅ Successfully pre-pulled ${serviceName} image and updated GitOps configuration. GitOps will deploy automatically.`
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
 * Deploy multiple services using GitOps workflow with batch commits
 */
async function deployMultipleServicesViaGitOps(
    endpointId: number,
    serviceNames: string[],
    tags: Map<string, string>,
    userToken: string,
    serviceConfigs: Map<string, ServiceConfig>
): Promise<MultiDeploymentResult> {
    const results: DeploymentResult[] = [];
    const groupedByRepo = new Map<string, {
        success: boolean;
        services: string[];
        commitId?: string;
        branch: string;
        filePath: string;
        message: string;
    }>();

    try {
        // Step 1: Pull images for all services via Portainer
        console.log(`📦 Starting pre-pull for ${serviceNames.length} services...`);
        const portainerClient = getPortainerClient();
        const pullResult = await portainerClient.deployMultipleServicesOptimized(endpointId, serviceNames, tags);

        // Track image information per service
        const imageInfoByService = new Map<string, { imageName: string; imageTag: string }>();
        
        // Extract image information from pull results
        pullResult.results.forEach(result => {
            if (result.success && result.imageName && result.imageTag) {
                imageInfoByService.set(result.serviceName, {
                    imageName: result.imageName,
                    imageTag: result.imageTag
                });
            }
        });

        // Step 2: Group services by GitOps repository for batch processing
        const servicesByRepo = new Map<string, Array<{
            serviceName: string;
            tag: string;
            config: ServiceConfig;
        }>>();

        serviceNames.forEach(serviceName => {
            const config = serviceConfigs.get(serviceName);
            if (!config) {
                results.push({
                    success: false,
                    serviceName,
                    message: `❌ Service configuration not found`
                });
                return;
            }

            const repoKey = `${config.gitOpsRepoId}:${config.gitOpsFilePath}:${config.gitOpsBranch}`;
            if (!servicesByRepo.has(repoKey)) {
                servicesByRepo.set(repoKey, []);
            }
            servicesByRepo.get(repoKey)!.push({
                serviceName,
                tag: tags.get(serviceName) || 'dev',
                config
            });
        });

        // Step 3: Process each repository
        const gitlabClient = new GitLabClient({
            baseUrl: process.env.GITLAB_URL || 'https://gitlab.com',
            token: userToken
        });

        for (const [repoKey, servicesInRepo] of servicesByRepo.entries()) {
            const [repoId, filePath, branch] = repoKey.split(':');
            const repoConfig = servicesInRepo[0].config;

            try {
                // Get current YAML from GitLab
                let yamlContent: string;
                try {
                    yamlContent = await gitlabClient.getFile(repoId, filePath, branch);
                } catch (error: any) {
                    throw new Error(`Failed to fetch GitOps configuration: ${error.message}`);
                }

                // Validate all services exist in YAML
                for (const { serviceName, config } of servicesInRepo) {
                    const actualServiceName = config.serviceName || serviceName;
                    if (!validateServiceExists(yamlContent, actualServiceName)) {
                        throw new Error(`Service "${actualServiceName}" not found in GitOps configuration file`);
                    }
                }

                // Update YAML content for all services in this repo
                let updatedYamlContent = yamlContent;
                const serviceUpdates: Array<{ serviceName: string; actualServiceName: string; oldTag: string | null; newTag: string }> = [];

                for (const { serviceName, tag, config } of servicesInRepo) {
                    const actualServiceName = config.serviceName || serviceName;
                    const currentTag = extractCurrentImageTag(updatedYamlContent, actualServiceName);
                    updatedYamlContent = updateImageTagInYaml(updatedYamlContent, actualServiceName, tag);
                    serviceUpdates.push({ serviceName, actualServiceName, oldTag: currentTag, newTag: tag });
                }

                // Create commit message for batch update
                const actualServiceNamesList = serviceUpdates.map(u => u.actualServiceName).join(', ');
                const commitMessage = `Batch update: ${actualServiceNamesList}`;

                // Validate and clean YAML content before upload
                try {
                    updatedYamlContent = validateYamlContent(updatedYamlContent);
                } catch (error: any) {
                    throw new Error(`Invalid YAML content before GitOps batch commit: ${error.message}`);
                }

                // Commit changes to GitLab
                let gitLabCommit;
                try {
                    gitLabCommit = await gitlabClient.updateFile(
                        repoId,
                        filePath,
                        branch,
                        updatedYamlContent,
                        commitMessage
                    );
                } catch (error: any) {
                    throw new Error(`Failed to commit GitOps configuration: ${error.message}`);
                }

                // Create successful result for each service
                servicesInRepo.forEach(({ serviceName, tag }) => {
                    const imageInfo = imageInfoByService.get(serviceName);
                    results.push({
                        success: true,
                        serviceName,
                        pullResults: pullResult.imagePullResults.get(serviceName) || [],
                        imageInfo,
                        gitLabCommit: {
                            commitId: gitLabCommit.commit_id,
                            branch: gitLabCommit.branch,
                            filePath: gitLabCommit.file_path
                        },
                        message: `✅ Successfully pre-pulled ${serviceName} image and updated GitOps configuration. GitOps will deploy automatically.`
                    });
                });

                // Track repo summary
                groupedByRepo.set(repoKey, {
                    success: true,
                    services: servicesInRepo.map(s => s.serviceName),
                    commitId: gitLabCommit.commit_id,
                    branch,
                    filePath,
                    message: `✅ Batch update committed for ${servicesInRepo.map(s => s.serviceName).join(', ')}`
                });

                console.log(`✅ Batch GitOps update queued for ${servicesInRepo.map(s => s.serviceName).join(', ')} (commit: ${gitLabCommit.commit_id})`);

            } catch (error: any) {
                // Create failed result for all services in this repo
                servicesInRepo.forEach(({ serviceName }) => {
                    const pullResults = pullResult.results.find(r => r.serviceName === serviceName)?.pullResults;
                    results.push({
                        success: false,
                        serviceName,
                        pullResults,
                        message: `❌ GitOps update failed: ${error.message}`
                    });
                });

                // Track repo failure
                groupedByRepo.set(repoKey, {
                    success: false,
                    services: servicesInRepo.map(s => s.serviceName),
                    branch,
                    filePath,
                    message: `❌ Batch update failed: ${error.message}`
                });

                console.error(`❌ Batch GitOps update failed for ${servicesInRepo.map(s => s.serviceName).join(', ')}:`, error.message);
            }
        }

        return { results, groupedByRepo };
    } catch (error: any) {
        console.error(`❌ Multi-service GitOps deployment failed:`, error.message);
        throw new Error(`Multi-service deployment failed: ${error.message}`);
    }
}

export {
    deployServiceViaGitOps,
    deployMultipleServicesViaGitOps,
    type ServiceConfig,
    type DeploymentResult,
    type MultiDeploymentResult
};
