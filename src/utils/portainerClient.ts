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
     * Check service health after deployment
     * Returns status of running tasks and any failures
     */
    async checkServiceHealth(endpointId: number, serviceName: string, timeoutMs: number = 60000): Promise<{
        healthy: boolean;
        status: string;
        runningTasks: number;
        desiredReplicas: number;
        failedTasks: Array<{ node: string; error: string; state: string }>;
        message: string;
    }> {
        const startTime = Date.now();
        const pollInterval = 3000; // Check every 3 seconds

        console.log(`🔍 Checking health for service: ${serviceName}`);

        try {
            const service = await this.getServiceByName(endpointId, serviceName);
            if (!service) {
                throw new Error(`Service "${serviceName}" not found`);
            }

            const desiredReplicas = (service.Spec as any).Mode?.Replicated?.Replicas || 1;

            // Poll until timeout or service is healthy
            while (Date.now() - startTime < timeoutMs) {
                const tasks = await this.getServiceTasks(endpointId, service.ID);
                
                // Filter for the latest tasks (ignore old/shutdown tasks)
                const runningTasks = tasks.filter((task: any) => task.Status.State === 'running');
                const failedTasks = tasks.filter((task: any) => 
                    task.Status.State === 'failed' || 
                    task.Status.State === 'rejected'
                );
                const preparingTasks = tasks.filter((task: any) => 
                    task.Status.State === 'preparing' || 
                    task.Status.State === 'starting' ||
                    task.Status.State === 'assigned'
                );

                console.log(`📊 Service status: ${runningTasks.length}/${desiredReplicas} running, ${preparingTasks.length} starting, ${failedTasks.length} failed`);

                // Check if service is healthy (all replicas running)
                if (runningTasks.length === desiredReplicas && preparingTasks.length === 0) {
                    return {
                        healthy: true,
                        status: 'running',
                        runningTasks: runningTasks.length,
                        desiredReplicas,
                        failedTasks: [],
                        message: `✅ Service is healthy. All ${desiredReplicas} replica(s) are running.`
                    };
                }

                // check if failed task is greater than 0 and timestamp is more than latest running task
                const latestRunningTask = runningTasks.sort((a: any, b: any) => new Date(b.Status.Timestamp).getTime() - new Date(a.Status.Timestamp).getTime())[0];
                const newFailedTasks = failedTasks.filter((task: any) => new Date(task.Status.Timestamp).getTime() > new Date(latestRunningTask.Status.Timestamp).getTime());
                // Check for failed tasks
                if (newFailedTasks.length > 0) {
                    const failedTaskDetails = newFailedTasks.map((task: any) => ({
                        node: task.NodeID || 'unknown',
                        error: task.Status.Err || task.Status.Message || 'Unknown error',
                        state: task.Status.State
                    }));

                    // If there are failed tasks but also running ones, it might still be deploying
                    if (runningTasks.length < desiredReplicas && preparingTasks.length === 0) {
                        return {
                            healthy: false,
                            status: 'failed',
                            runningTasks: runningTasks.length,
                            desiredReplicas,
                            failedTasks: failedTaskDetails,
                            message: `❌ Service deployment failed. ${runningTasks.length}/${desiredReplicas} running, ${failedTasks.length} failed.`
                        };
                    }
                }

                // Wait before next check
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }

            // Timeout reached
            const tasks = await this.getServiceTasks(endpointId, service.ID);
            const runningTasks = tasks.filter((task: any) => task.Status.State === 'running');
            const failedTasks = tasks.filter((task: any) => 
                task.Status.State === 'failed' || 
                task.Status.State === 'rejected'
            );

            const failedTaskDetails = failedTasks.map((task: any) => ({
                node: task.NodeID || 'unknown',
                error: task.Status.Err || task.Status.Message || 'Unknown error',
                state: task.Status.State
            }));

            return {
                healthy: false,
                status: 'timeout',
                runningTasks: runningTasks.length,
                desiredReplicas,
                failedTasks: failedTaskDetails,
                message: `⏱️ Health check timeout. ${runningTasks.length}/${desiredReplicas} running after ${timeoutMs / 1000}s.`
            };

        } catch (error: any) {
            console.error(`❌ Health check failed:`, error.message);
            throw error;
        }
    }

    /**
     * Main deployment workflow: pull image on all nodes, update service, and check health
     */
    async deployService(endpointId: number, serviceName: string, tag?: string, checkHealth: boolean = true): Promise<{
        pullResults: ImagePullProgress[];
        serviceUpdated: boolean;
        health?: {
            healthy: boolean;
            status: string;
            runningTasks: number;
            desiredReplicas: number;
            failedTasks: Array<{ node: string; error: string; state: string }>;
            message: string;
        };
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
                console.log(`🚀 Deploying: ${serviceName} with tag: ${tag}`);
                console.log(`📦 Image: ${imageName}`);
            } else {
                console.log(`🚀 Deploying: ${serviceName}`);
            }

            // Step 1: Pull image on all nodes
            const pullResults = await this.pullImageOnAllNodes(endpointId, imageName, tag || 'dev');

            // Check if at least one node succeeded
            const successCount = pullResults.filter(r => r.status === 'success').length;
            if (successCount === 0) {
                throw new Error('Failed to pull image on any node');
            }

            // Step 2: Update the service with new image
            if (tag) {
                // Update the service spec with the new image
                service.Spec.TaskTemplate.ContainerSpec.Image = imageName;
            }
            await this.updateService(endpointId, service.ID, service);

            // Step 3: Check service health (optional)
            let health;
            if (checkHealth) {
                health = await this.checkServiceHealth(endpointId, serviceName, 60000); // 60 second timeout
            }

            console.log(`🎉 Deployment complete: ${serviceName}`);

            return {
                pullResults,
                serviceUpdated: true,
                health,
                message: health?.healthy 
                    ? `✅ Successfully deployed ${serviceName}. Service is running healthy.`
                    : health?.status === 'failed'
                    ? `⚠️ Deployment completed but service failed to start properly.`
                    : health?.status === 'timeout'
                    ? `⚠️ Deployment completed but health check timed out.`
                    : `✅ Successfully deployed ${serviceName}. Image pulled on ${successCount}/${pullResults.length} nodes.`,
            };
        } catch (error: any) {
            console.error(`❌ Deployment failed for ${serviceName}:`, error.message);
            throw new Error(`Deployment failed: ${error.message}`);
        }
    }

    /**
     * Optimized deployment for multiple services:
     * 1. Pull unique images once
     * 2. Update all services that use those images
     */
    async deployMultipleServicesOptimized(endpointId: number, serviceNames: string[], tags?: Map<string, string>, checkHealth: boolean = true): Promise<{
        results: Array<{
            serviceName: string;
            success: boolean;
            message: string;
            pullResults?: ImagePullProgress[];
            health?: {
                healthy: boolean;
                status: string;
                runningTasks: number;
                desiredReplicas: number;
                failedTasks: Array<{ node: string; error: string; state: string }>;
                message: string;
            };
        }>;
        imagePullResults: Map<string, ImagePullProgress[]>;
    }> {
        const results: Array<{
            serviceName: string;
            success: boolean;
            message: string;
            pullResults?: ImagePullProgress[];
            health?: {
                healthy: boolean;
                status: string;
                runningTasks: number;
                desiredReplicas: number;
                failedTasks: Array<{ node: string; error: string; state: string }>;
                message: string;
            };
        }> = [];
        const imagePullResults = new Map<string, ImagePullProgress[]>();

        try {
            // Step 1: Get all services
            console.log(`📋 Fetching ${serviceNames.length} service(s)...`);
            const services = await Promise.all(
                serviceNames.map(name => this.getServiceByName(endpointId, name))
            );

            // Check for missing services
            const missingServices = serviceNames.filter((name, idx) => !services[idx]);
            if (missingServices.length > 0) {
                missingServices.forEach(name => {
                    results.push({
                        serviceName: name,
                        success: false,
                        message: `❌ Service "${name}" not found`,
                    });
                });
            }

            const validServices = services.filter((s): s is Service => s !== null);
            if (validServices.length === 0) {
                return { results, imagePullResults };
            }

            // Step 2: Group services by final image (including tag)
            const servicesByImage = new Map<string, { services: Service[], tag?: string }>();
            validServices.forEach(service => {
                const baseImage = service.Spec.TaskTemplate.ContainerSpec.Image;
                const serviceTag = tags?.get(service.Spec.Name);
                let finalImage: string;
                let tag: string | undefined;

                if (serviceTag) {
                    // Remove existing tag/digest if present and add the new tag
                    const imageWithoutTag = baseImage.split(':')[0].split('@')[0];
                    finalImage = `${imageWithoutTag}:${serviceTag}`;
                    tag = serviceTag;
                } else {
                    finalImage = baseImage;
                }

                if (!servicesByImage.has(finalImage)) {
                    servicesByImage.set(finalImage, { services: [], tag });
                }
                servicesByImage.get(finalImage)!.services.push(service);
            });

            console.log(`📦 Found ${servicesByImage.size} unique image(s) to pull`);

            // Step 3: Pull each unique image once
            for (const [image, imageData] of servicesByImage.entries()) {
                const { services: servicesUsingImage, tag } = imageData;
                console.log(`🔄 Pulling image for ${servicesUsingImage.length} service(s)...`);
                try {
                    const pullResults = await this.pullImageOnAllNodes(endpointId, image, tag || 'dev');
                    imagePullResults.set(image, pullResults);

                    // Check if pull was successful
                    const successCount = pullResults.filter(r => r.status === 'success').length;
                    if (successCount === 0) {
                        // If image pull failed, mark all services using this image as failed
                        servicesUsingImage.forEach(service => {
                            results.push({
                                serviceName: service.Spec.Name,
                                success: false,
                                message: `❌ Failed to pull image on any node`,
                                pullResults,
                            });
                        });
                        continue;
                    }

                    // Step 4: Update all services that use this image
                    for (const service of servicesUsingImage) {
                        try {
                            // Update service spec with the final image if tag was specified
                            if (tag) {
                                service.Spec.TaskTemplate.ContainerSpec.Image = image;
                            }
                            await this.updateService(endpointId, service.ID, service);
                            
                            // Step 5: Check health if enabled
                            let health;
                            if (checkHealth) {
                                try {
                                    health = await this.checkServiceHealth(endpointId, service.Spec.Name, 60000);
                                } catch (error: any) {
                                    console.warn(`⚠️ Health check failed for ${service.Spec.Name}:`, error.message);
                                }
                            }
                            
                            results.push({
                                serviceName: service.Spec.Name,
                                success: true,
                                message: health?.healthy 
                                    ? `✅ Successfully deployed and running healthy.`
                                    : health?.status === 'failed'
                                    ? `⚠️ Deployed but service failed to start.`
                                    : health?.status === 'timeout'
                                    ? `⚠️ Deployed but health check timed out.`
                                    : `✅ Successfully deployed. Image pulled on ${successCount}/${pullResults.length} nodes.`,
                                pullResults,
                                health,
                            });
                        } catch (error: any) {
                            results.push({
                                serviceName: service.Spec.Name,
                                success: false,
                                message: `❌ ${error.message}`,
                                pullResults,
                            });
                        }
                    }
                } catch (error: any) {
                    // If pull fails, mark all services as failed
                    servicesUsingImage.forEach(service => {
                        results.push({
                            serviceName: service.Spec.Name,
                            success: false,
                            message: `❌ Failed to pull image: ${error.message}`,
                        });
                    });
                }
            }

            return { results, imagePullResults };
        } catch (error: any) {
            throw new Error(`Multi-deployment failed: ${error.message}`);
        }
    }

    /**
     * Deploy multiple services
     */
    async deployMultipleServices(endpointId: number, serviceNames: string[]): Promise<{
        results: Array<{
            serviceName: string;
            success: boolean;
            message: string;
            pullResults?: ImagePullProgress[];
        }>;
    }> {
        const results = [];

        for (const serviceName of serviceNames) {
            try {
                const result = await this.deployService(endpointId, serviceName);
                results.push({
                    serviceName,
                    success: true,
                    message: result.message,
                    pullResults: result.pullResults,
                });
            } catch (error: any) {
                results.push({
                    serviceName,
                    success: false,
                    message: `❌ ${error.message}`,
                });
            }
        }

        return { results };
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

