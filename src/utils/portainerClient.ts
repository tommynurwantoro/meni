import axios, { AxiosInstance } from 'axios';
import { ECRClient, GetAuthorizationTokenCommand } from '@aws-sdk/client-ecr';

interface PortainerConfig {
    url: string;
    apiKey?: string;
    username?: string;
    password?: string;
    ecrConfig?: {
        region: string;
        registryId?: string;
    };
}

interface SwarmNode {
    ID: string;
    Hostname: string;
    Status: {
        State: string;
    };
    Spec: {
        Role: string;
    };
}

interface Service {
    ID: string;
    Version: {
        Index: number;
    };
    Spec: {
        Name: string;
        TaskTemplate: {
            ContainerSpec: {
                Image: string;
            };
        };
    };
}

interface ImagePullProgress {
    node: string;
    status: string;
    error?: string;
    digest?: string;
    imageId?: string;
}

class PortainerClient {
    private client: AxiosInstance;
    private config: PortainerConfig;
    private authToken?: string;
    private ecrClient?: ECRClient;
    private ecrAuthToken?: string;
    private ecrAuthExpiration?: Date;

    constructor(config: PortainerConfig) {
        this.config = config;
        this.client = axios.create({
            baseURL: config.url,
            timeout: 300000, // 5 minutes for long operations like image pulls
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Initialize ECR client if config is provided
        if (this.config.ecrConfig) {
            this.ecrClient = new ECRClient({ region: this.config.ecrConfig.region });
        }

        // Add request interceptor for authentication
        this.client.interceptors.request.use(async (config) => {
            if (this.config.apiKey) {
                config.headers['X-API-Key'] = this.config.apiKey;
            } else if (this.authToken) {
                config.headers['Authorization'] = `Bearer ${this.authToken}`;
            }
            return config;
        });
    }

    /**
     * Authenticate with username/password if API key is not provided
     */
    async authenticate(): Promise<void> {
        if (this.config.apiKey) {
            return; // No need to authenticate with API key
        }

        if (!this.config.username || !this.config.password) {
            throw new Error('Either API key or username/password must be provided');
        }

        try {
            const response = await axios.post(`${this.config.url}/api/auth`, {
                username: this.config.username,
                password: this.config.password,
            });

            this.authToken = response.data.jwt;
        } catch (error: any) {
            throw new Error(`Authentication failed: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get ECR authorization token
     * Token is cached until expiration
     */
    async getEcrAuthToken(): Promise<string> {
        // Check if we have a valid cached token
        if (this.ecrAuthToken && this.ecrAuthExpiration && new Date() < this.ecrAuthExpiration) {
            return this.ecrAuthToken;
        }

        if (!this.ecrClient) {
            throw new Error('ECR client not initialized. Please provide ecrConfig in PortainerConfig');
        }

        try {
            console.log('🔑 Fetching ECR authorization token...');
            const command = new GetAuthorizationTokenCommand({
                registryIds: this.config.ecrConfig?.registryId ? [this.config.ecrConfig.registryId] : undefined,
            });
            
            const response = await this.ecrClient.send(command);
            
            if (!response.authorizationData || response.authorizationData.length === 0) {
                throw new Error('No authorization data returned from ECR');
            }

            const authData = response.authorizationData[0];
            const token = authData.authorizationToken;
            const expiresAt = authData.expiresAt;

            if (!token) {
                throw new Error('No authorization token returned from ECR');
            }

            // Decode the token to get username and password
            const decodedToken = Buffer.from(token, 'base64').toString('utf-8');
            const [username, password] = decodedToken.split(':');

            // Create the registry auth object for Docker
            const registryAuth = {
                username,
                password,
                serveraddress: authData.proxyEndpoint || `${this.config.ecrConfig?.registryId}.dkr.ecr.${this.config.ecrConfig?.region}.amazonaws.com`,
            };

            // Encode to base64 for X-Registry-Auth header
            this.ecrAuthToken = Buffer.from(JSON.stringify(registryAuth)).toString('base64');
            this.ecrAuthExpiration = expiresAt || new Date(Date.now() + 12 * 60 * 60 * 1000); // Default to 12 hours

            console.log(`✅ ECR token obtained (expires: ${this.ecrAuthExpiration.toISOString()})`);
            return this.ecrAuthToken;
        } catch (error: any) {
            console.error('❌ Failed to get ECR token:', error.message);
            throw new Error(`Failed to get ECR authorization token: ${error.message}`);
        }
    }

    /**
     * Get all endpoints (Docker environments)
     */
    async getEndpoints() {
        try {
            const response = await this.client.get('/api/endpoints');
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to get endpoints: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get swarm nodes for a specific endpoint
     */
    async getSwarmNodes(endpointId: number): Promise<SwarmNode[]> {
        try {
            const response = await this.client.get(`/api/endpoints/${endpointId}/docker/nodes`);
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to get swarm nodes: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Pull image on a specific node using Portainer's Docker proxy
     */
    async pullImageOnNode(endpointId: number, nodeId: string, imageName: string, tag: string): Promise<{ digest?: string; imageId?: string }> {
        try {
                // Get ECR auth token dynamically
                const ecrAuthToken = await this.getEcrAuthToken();
                
                // Pull the fresh image (remove digest to force pull latest)
                const imageWithoutDigest = imageName.split('@')[0];
                
                await this.client.post(
                    `/api/endpoints/${endpointId}/docker/images/create`,
                    null,
                    {
                        params: {
                            fromImage: imageWithoutDigest,
                            tag: tag,
                        },
                        headers: {
                            'X-Registry-Auth': ecrAuthToken,
                        },
                        timeout: 600000, // 10 minutes for image pull
                    }
                );

                // Verify the new image was pulled
                try {
                    const imagesResponse = await this.client.get(`/api/endpoints/${endpointId}/docker/images/json`);
                    const matchingImages = imagesResponse.data.filter((img: any) => 
                        img.RepoTags && img.RepoTags.some((tag: string) => tag.includes(imageWithoutDigest.split(':')[0]))
                    );
                    
                    if (matchingImages.length > 0) {
                        const latestImage = matchingImages[0];
                        return {
                            digest: latestImage.RepoDigests?.[0]?.split('@')[1] || latestImage.Id,
                            imageId: latestImage.Id
                        };
                    }
                    return {};
                } catch (inspectError: any) {
                    console.warn('⚠️ Could not verify image pull:', inspectError.message);
                    return {};
                }
        } catch (error: any) {
            console.error(`❌ Failed to pull image on node ${nodeId}:`, error.response?.data?.message || error.message);
            throw new Error(`Failed to pull image on node ${nodeId}: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Pull image across all swarm nodes
     */
    async pullImageOnAllNodes(endpointId: number, imageName: string, tag: string): Promise<ImagePullProgress[]> {
        const nodes = await this.getSwarmNodes(endpointId);
        const results: ImagePullProgress[] = [];

        // Filter only ready nodes
        const readyNodes = nodes.filter(node => 
            node.Status.State.toLowerCase() === 'ready'
        );

        console.log(`📦 Pulling image on ${readyNodes.length} node(s)...`);

        // Pull image on all nodes in parallel
        const pullPromises = readyNodes.map(async (node) => {
            try {
                const pullResult = await this.pullImageOnNode(endpointId, node.ID, imageName, tag);
                const result: ImagePullProgress = {
                    node: node.Hostname || node.ID,
                    status: 'success',
                    digest: pullResult.digest,
                    imageId: pullResult.imageId,
                };
                results.push(result);
                console.log(`✅ Image pulled: ${node.Hostname || node.ID}`);
                return result;
            } catch (error: any) {
                const result: ImagePullProgress = {
                    node: node.Hostname || node.ID,
                    status: 'failed',
                    error: error.message,
                };
                results.push(result);
                return result;
            }
        });

        await Promise.allSettled(pullPromises);
        
        const successCount = results.filter(r => r.status === 'success').length;
        console.log(`📊 Pull results: ${successCount}/${readyNodes.length} succeeded`);
        
        return results;
    }

    /**
     * Get all services in the swarm
     */
    async getServices(endpointId: number): Promise<Service[]> {
        try {
            const response = await this.client.get(`/api/endpoints/${endpointId}/docker/services`);
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to get services: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get a specific service by name
     */
    async getServiceByName(endpointId: number, serviceName: string): Promise<Service | null> {
        try {
            const services = await this.getServices(endpointId);
            const service = services.find(s => s.Spec.Name === serviceName);
            return service || null;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update service to force redeployment with latest image
     */
    async updateService(endpointId: number, serviceId: string, service: Service): Promise<void> {
        try {
            // Get the image name without digest to ensure we use the latest version
            const imageWithoutDigest = service.Spec.TaskTemplate.ContainerSpec.Image.split('@')[0];
            
            console.log(`🔄 Updating service: ${service.Spec.Name}`);
            
            // Force service to pull latest image by updating with registryAuthFrom=spec
            // and incrementing the version
            const updateSpec = {
                ...service.Spec,
                TaskTemplate: {
                    ...service.Spec.TaskTemplate,
                    ContainerSpec: {
                        ...service.Spec.TaskTemplate.ContainerSpec,
                        Image: imageWithoutDigest,
                    },
                    ForceUpdate: (service.Spec.TaskTemplate as any).ForceUpdate 
                        ? (service.Spec.TaskTemplate as any).ForceUpdate + 1 
                        : 1,
                },
            };

            await this.client.post(
                `/api/endpoints/${endpointId}/docker/services/${serviceId}/update`,
                updateSpec,
                {
                    params: {
                        version: service.Version.Index,
                        registryAuthFrom: 'spec',
                    },
                }
            );

            console.log(`✅ Service updated: ${service.Spec.Name}`);
        } catch (error: any) {
            console.error(`❌ Failed to update service ${service.Spec.Name}:`, error.response?.data?.message || error.message);
            throw new Error(`Failed to update service: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Get tasks for a specific service
     */
    async getServiceTasks(endpointId: number, serviceId: string): Promise<any[]> {
        try {
            const response = await this.client.get(`/api/endpoints/${endpointId}/docker/tasks`, {
                params: {
                    filters: JSON.stringify({
                        service: [serviceId]
                    })
                }
            });
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to get service tasks: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Advanced health check with retry logic and preparation state handling
     * Returns detailed status of service deployment progress
     */
    async checkServiceHealth(endpointId: number, serviceName: string, timeoutMs: number = 60000): Promise<{
        healthy: boolean;
        status: string;
        runningTasks: number;
        desiredReplicas: number;
        failedTasks: Array<{ node: string; error: string; state: string }>;
        message: string;
        deploymentProgress?: string;
        availabilityHistory?: Array<{ timestamp: number; running: number; desired: number; status: string }>;
    }> {
        const startTime = Date.now();
        const pollInterval = 3000; // Check every 3 seconds
        const availabilityHistory: Array<{ timestamp: number; running: number; desired: number; status: string }> = [];

        console.log(`🔍 Starting advanced health check for service: ${serviceName} (timeout: ${timeoutMs / 1000}s)`);

        try {
            const service = await this.getServiceByName(endpointId, serviceName);
            if (!service) {
                throw new Error(`Service "${serviceName}" not found`);
            }

            const desiredReplicas = (service.Spec as any).Mode?.Replicated?.Replicas || 1;
            let consecutiveHealthyChecks = 0;
            let maxRunningSeen = 0;
            let preparationStartTime = 0;
            let steadyStateThreshold = 0.7; // 70% of desired replicas considered "substantial progress"

            console.log(`📊 Target: ${desiredReplicas} replica(s) for service "${serviceName}"`);

            // Poll until timeout or service is healthy
            while (Date.now() - startTime < timeoutMs) {
                const tasks = await this.getServiceTasks(endpointId, service.ID);
                const currentTime = Date.now();
                
                // Get task states with detailed information
                const runningTasks = tasks.filter((task: any) => task.Status.State === 'running');
                const failedTasks = tasks.filter((task: any) => 
                    task.Status.State === 'failed' || task.Status.State === 'rejected'
                );
                const preparingTasks = tasks.filter((task: any) => 
                    task.Status.State === 'preparing' || 
                    task.Status.State === 'starting' ||
                    task.Status.State === 'assigned' ||
                    task.Status.State === 'new'
                );

                // Track maximum running tasks seen
                maxRunningSeen = Math.max(maxRunningSeen, runningTasks.length);

                // Record availability history
                availabilityHistory.push({
                    timestamp: currentTime,
                    running: runningTasks.length,
                    desired: desiredReplicas,
                    status: runningTasks.length >= desiredReplicas ? 'healthy' : 'preparing'
                });

                // Calculate deployment progress
                const progressPercent = Math.round((runningTasks.length / desiredReplicas) * 100);
                const deploymentProgress = `${runningTasks.length}/${desiredReplicas} (${progressPercent}%)`;

                console.log(`📊 Service status: ${deploymentProgress} running, ${preparingTasks.length} preparing, ${failedTasks.length} failed | Total Tasks: ${tasks.length}`);

                // Check if service is healthy (all replicas running and stable)
                if (runningTasks.length === desiredReplicas && preparingTasks.length === 0) {
                    consecutiveHealthyChecks++;
                    
                    // Require 2 consecutive healthy checks for stability
                    if (consecutiveHealthyChecks >= 2) {
                        console.log(`✅ Service "${serviceName}" confirmed healthy after ${consecutiveHealthyChecks} stable checks`);
                        return {
                            healthy: true,
                            status: 'running',
                            runningTasks: runningTasks.length,
                            desiredReplicas,
                            failedTasks: [],
                            message: `✅ Service is healthy and stable. All ${desiredReplicas} replica(s) running successfully.`,
                            deploymentProgress: deploymentProgress,
                            availabilityHistory
                        };
                    }
                } else {
                    consecutiveHealthyChecks = 0; // Reset stability counter
                }

                // Enhanced failure detection
                if (failedTasks.length > 0) {
                    const latestRunningTask = runningTasks.length > 0 
                        ? runningTasks.sort((a: any, b: any) => new Date(b.Status.Timestamp).getTime() - new Date(a.Status.Timestamp).getTime())[0]
                        : null;

                    const newFailedTasks = latestRunningTask 
                        ? failedTasks.filter((task: any) => new Date(task.Status.Timestamp).getTime() > new Date(latestRunningTask.Status.Timestamp).getTime())
                        : failedTasks;

                    if (newFailedTasks.length > 0) {
                        const failedTaskDetails = newFailedTasks.map((task: any) => ({
                            node: task.NodeID || 'unknown',
                            error: task.Status.Err || task.Status.Message || 'Unknown error',
                            state: task.Status.State
                        }));

                        // More intelligent failure assessment
                        if (runningTasks.length === 0 && preparingTasks.length === 0) {
                            return {
                                healthy: false,
                                status: 'failed',
                                runningTasks: runningTasks.length,
                                desiredReplicas,
                                failedTasks: failedTaskDetails,
                                message: `❌ Service deployment failed completely. 0/${desiredReplicas} running, ${newFailedTasks.length} failed.`,
                                deploymentProgress,
                                availabilityHistory
                            };
                        } else if (runningTasks.length < steadyStateThreshold * desiredReplicas) {
                            return {
                                healthy: false,
                                status: 'degraded',
                                runningTasks: runningTasks.length,
                                desiredReplicas,
                                failedTasks: failedTaskDetails,
                                message: `⚠️ Service deployment degraded. ${runningTasks.length}/${desiredReplicas} running, insufficient for healthy state.`,
                                deploymentProgress,
                                availabilityHistory
                            };
                        }
                    }
                }

                // Handle preparation state with progressive timeouts
                if (preparingTasks.length > 0) {
                    if (preparationStartTime === 0) {
                        preparationStartTime = currentTime;
                        console.log(`🔄 Service "${serviceName}" entered preparation state`);
                    }

                    const preparationDuration = currentTime - preparationStartTime;
                    const maxPreparationTime = 60000; // 1 minute max for preparation
                    
                    // Progressive timeout based on progress
                    const hasSubstantialProgress = maxRunningSeen >= steadyStateThreshold * desiredReplicas;
                    const effectiveTimeout = hasSubstantialProgress ? maxPreparationTime * 2 : maxPreparationTime;

                    if (preparationDuration > effectiveTimeout) {
                        console.warn(`⏱️ Preparation timeout: ${preparationDuration / 1000}s, max seen: ${maxRunningSeen}/${desiredReplicas}`);
                    }
                }

                // Wait before next check
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }

            // Timeout reached - provide detailed analysis
            const finalTasks = await this.getServiceTasks(endpointId, service.ID);
            const finalRunningTasks = finalTasks.filter((task: any) => task.Status.State === 'running');
            const finalFailedTasks = finalTasks.filter((task: any) => 
                task.Status.State === 'failed' || task.Status.State === 'rejected'
            );

            const failedTaskDetails = finalFailedTasks.map((task: any) => ({
                node: task.NodeID || 'unknown',
                error: task.Status.Err || task.Status.Message || 'Unknown error',
                state: task.Status.State
            }));

            const finalProgress = Math.round((finalRunningTasks.length / desiredReplicas) * 100);
            
            // More intelligent timeout assessment
            let timeoutMessage = `⏱️ Health check timeout after ${timeoutMs / 1000}s.`;
            if (finalRunningTasks.length >= steadyStateThreshold * desiredReplicas) {
                timeoutMessage += ` ${finalRunningTasks.length}/${desiredReplicas} running (${finalProgress}%). Service partially deployed - may need more time.`;
            } else if (finalRunningTasks.length > 0) {
                timeoutMessage += ` ${finalRunningTasks.length}/${desiredReplicas} running (${finalProgress}%). Service partially deployed but insufficient.`;
            } else {
                timeoutMessage += ` 0/${desiredReplicas} running. Deployment appears to have failed.`;
            }

            return {
                healthy: false,
                status: 'timeout',
                runningTasks: finalRunningTasks.length,
                desiredReplicas,
                failedTasks: failedTaskDetails,
                message: timeoutMessage,
                deploymentProgress: `${finalRunningTasks.length}/${desiredReplicas} (${finalProgress}%)`,
                availabilityHistory
            };

        } catch (error: any) {
            console.error(`❌ Health check failed:`, error.message);
            throw error;
        }
    }

    /**
     * Pre-pull image on all nodes for GitOps deployment workflow
     */
    async deployService(endpointId: number, serviceName: string, tag?: string): Promise<{
        pullResults: ImagePullProgress[];
        imageName: string;
        imageTag: string;
        message: string;
    }> {
        try {
            // Get the service
            const service = await this.getServiceByName(endpointId, serviceName);
            if (!service) {
                throw new Error(`Service "${serviceName}" not found`);
            }

            let imageName = service.Spec.TaskTemplate.ContainerSpec.Image;
            
            // If tag is provided, replace the tag in the image name
            if (tag) {
                // Remove existing tag/digest if present
                const imageWithoutTag = imageName.split(':')[0].split('@')[0];
                imageName = `${imageWithoutTag}:${tag}`;
                console.log(`🚀 Pre-pulling: ${serviceName} with tag: ${tag}`);
                console.log(`📦 Image: ${imageName}`);
            } else {
                console.log(`🚀 Pre-pulling: ${serviceName}`);
            }

            // Pull image on all nodes
            const pullResults = await this.pullImageOnAllNodes(endpointId, imageName, tag || 'dev');

            // Check if at least one node succeeded
            const successCount = pullResults.filter(r => r.status === 'success').length;
            if (successCount === 0) {
                throw new Error('Failed to pull image on any node');
            }

            console.log(`✅ Pre-pull complete: ${serviceName}. Image pulled on ${successCount}/${pullResults.length} nodes.`);

            return {
                pullResults,
                imageName,
                imageTag: tag || 'dev',
                message: `✅ Pre-pulled ${serviceName}. Image pulled on ${successCount}/${pullResults.length} nodes. GitOps will handle deployment.`,
            };
        } catch (error: any) {
            console.error(`❌ Pre-pull failed for ${serviceName}:`, error.message);
            throw new Error(`Pre-pull failed: ${error.message}`);
        }
    }

    /**
     * Trigger a stack webhook to initiate deployment
     */
    async triggerStackWebhook(webhookId: string): Promise<{
        success: boolean;
        status: string;
        message: string;
    }> {
        try {
            console.log(`🪝 Triggering webhook: ${webhookId}`);
            
            const response = await this.client.post(
                `/api/stacks/webhooks/${webhookId}`,
                null,
                {
                    timeout: 120000, // 120 seconds timeout
                }
            );

            console.log(`✅ Webhook triggered successfully: ${webhookId}`);
            return {
                success: true,
                status: 'triggered',
                message: 'Webhook triggered successfully'
            };
        } catch (error: any) {
            console.error(`❌ Failed to trigger webhook ${webhookId}:`, error.response?.data?.message || error.message);
            return {
                success: false,
                status: 'failed',
                message: `Webhook trigger failed: ${error.response?.data?.message || error.message}`
            };
        }
    }
}

// Singleton instance
let portainerClient: PortainerClient | null = null;

/**
 * Initialize Portainer client
 */
export function initializePortainerClient(config: PortainerConfig): PortainerClient {
    portainerClient = new PortainerClient(config);
    return portainerClient;
}

/**
 * Get Portainer client instance
 */
export function getPortainerClient(): PortainerClient {
    if (!portainerClient) {
        throw new Error('Portainer client not initialized. Call initializePortainerClient first.');
    }
    return portainerClient;
}

export { PortainerClient, PortainerConfig, SwarmNode, Service, ImagePullProgress };

