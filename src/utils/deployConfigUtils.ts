import { readFileSync } from "fs";
import { join } from "path";

// Whitelist structure interfaces matching whitelist_deploy.json
export interface EndpointConfig {
    id: number;
    stacks: string[];
}

export interface StackConfig {
    services: string[];
    gitOpsRepoId: string;
    gitOpsFilePath: string;
    gitOpsBranch: string;
    gitOpsWebhook: string;
}

export interface ServiceConfig {
    gitlabProjectId: string;
    description: string;
}

export interface WhitelistDeployConfig {
    endpoints: EndpointConfig[];
    stacks: Record<string, StackConfig>;
    services: Record<string, ServiceConfig>;
    description?: string;
}

// Cache for whitelist config to avoid repeated file reads
let cachedConfig: WhitelistDeployConfig | null = null;
let configCacheTime: number = 0;
const CACHE_TTL = 60 * 1000; // 1 minute cache

/**
 * Load whitelist configuration from whitelist_deploy.json
 */
export function getWhitelistConfig(): WhitelistDeployConfig | null {
    try {
        // Use cache if still valid
        const now = Date.now();
        if (cachedConfig && (now - configCacheTime) < CACHE_TTL) {
            return cachedConfig;
        }

        const whitelistPath = join(process.cwd(), "whitelist_deploy.json");
        const whitelistData = readFileSync(whitelistPath, "utf-8");
        const whitelist = JSON.parse(whitelistData);
        
        cachedConfig = whitelist;
        configCacheTime = now;
        return whitelist;
    } catch (error) {
        console.warn(
            "⚠️ Could not load whitelist_deploy.json, deployment features disabled"
        );
        return null;
    }
}

/**
 * Get all whitelisted endpoints
 */
export function getWhitelistedEndpoints(): EndpointConfig[] {
    const config = getWhitelistConfig();
    if (!config || !config.endpoints) {
        return [];
    }
    return config.endpoints;
}

/**
 * Get stack config for a stack name
 */
export function getStackConfig(stackName: string): StackConfig | null {
    const config = getWhitelistConfig();
    if (!config || !config.stacks || !config.stacks[stackName]) {
        return null;
    }
    return config.stacks[stackName];
}

/**
 * Get service config (gitlabProjectId, description)
 */
export function getServiceConfig(serviceName: string): ServiceConfig | null {
    const config = getWhitelistConfig();
    if (
        !config ||
        !config.services ||
        !config.services[serviceName]
    ) {
        return null;
    }
    return config.services[serviceName];
}

/**
 * Get stacks for an endpoint
 */
export function getStacksForEndpoint(endpointId: number): string[] {
    const endpoints = getWhitelistedEndpoints();
    const endpoint = endpoints.find((ep) => ep.id === endpointId);
    return endpoint?.stacks || [];
}

/**
 * Get GitLab project ID for a service
 */
export function getGitLabProjectId(serviceName: string): string | null {
    const serviceConfig = getServiceConfig(serviceName);
    return serviceConfig?.gitlabProjectId || null;
}

/**
 * Get all services from all stacks
 */
export function getAllServices(): string[] {
    const config = getWhitelistConfig();
    if (!config || !config.services) {
        return [];
    }
    return Object.keys(config.services);
}

/**
 * Find which stack contains a given service
 */
export function findStackForService(serviceName: string): { stackName: string; stackConfig: StackConfig } | null {
    const config = getWhitelistConfig();
    if (!config) {
        return null;
    }

    for (const [stackName, stack] of Object.entries(config.stacks)) {
        if (stack.services.includes(serviceName)) {
            return { stackName, stackConfig: stack };
        }
    }

    return null;
}

