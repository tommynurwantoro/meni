import { readFileSync } from "fs";
import { join } from "path";
import { Service } from "./portainerClient";
import { ServiceConfig } from "./gitopsDeployer";

// Whitelist structure interfaces
export interface ServiceMapping {
    gitlabProjectId: string;
    description: string;
    gitOpsRepoId?: string;
    gitOpsFilePath?: string;
    gitOpsBranch?: string;
    stackName?: string;
    serviceName?: string;
    gitOpsWebhook?: string;
}

export interface WhitelistConfig {
    services: string[];
    serviceMapping: Record<string, ServiceMapping>;
    description?: string;
}

// Load whitelist configuration
export function getWhitelistConfig(): WhitelistConfig | null {
    try {
        const whitelistPath = join(process.cwd(), "whitelist_service.json");
        const whitelistData = readFileSync(whitelistPath, "utf-8");
        const whitelist = JSON.parse(whitelistData);
        return whitelist;
    } catch (error) {
        console.warn(
            "⚠️ Could not load whitelist_service.json, showing all services"
        );
        return null;
    }
}

// Get list of whitelisted service names
export function getWhitelistedServices(): string[] {
    const config = getWhitelistConfig();

    if (!config || !config.services) {
        return [];
    }

    return config.services;
}

// Filter services based on whitelist
export function filterWhitelistedServices(services: Service[]): Service[] {
    const whitelist = getWhitelistedServices();

    // If whitelist is empty or not loaded, return all services
    if (whitelist.length === 0) {
        return services;
    }

    // Filter services that are in the whitelist
    return services.filter((service: Service) =>
        whitelist.includes(service.Spec.Name)
    );
}

// Get GitLab project ID for a service
export function getGitLabProjectId(serviceName: string): string | null {
    const config = getWhitelistConfig();

    if (
        !config ||
        !config.serviceMapping ||
        !config.serviceMapping[serviceName]
    ) {
        return null;
    }

    return config.serviceMapping[serviceName].gitlabProjectId;
}

// Get full service configuration for GitOps deployment
export function getServiceConfig(serviceName: string): ServiceConfig | null {
    const config = getWhitelistConfig();

    if (
        !config ||
        !config.serviceMapping ||
        !config.serviceMapping[serviceName]
    ) {
        return null;
    }

    const mapping = config.serviceMapping[serviceName];

    // Check if required GitOps fields are present
    if (
        !mapping.gitOpsRepoId ||
        !mapping.gitOpsFilePath ||
        !mapping.gitOpsBranch
    ) {
        return null;
    }

    return {
        gitlabProjectId: mapping.gitlabProjectId,
        description: mapping.description,
        gitOpsRepoId: mapping.gitOpsRepoId,
        gitOpsFilePath: mapping.gitOpsFilePath,
        gitOpsBranch: mapping.gitOpsBranch,
        stackName: mapping.stackName,
        serviceName: mapping.serviceName,
        gitOpsWebhook: mapping.gitOpsWebhook,
    };
}

// Load whitelist endpoints
export function getWhitelistedEndpoints(): number[] {
    try {
        const whitelistPath = join(process.cwd(), "whitelist_endpoint.json");
        const whitelistData = readFileSync(whitelistPath, "utf-8");
        const whitelist = JSON.parse(whitelistData);
        return whitelist.endpoints || [];
    } catch (error) {
        console.warn(
            "⚠️ Could not load whitelist_endpoint.json, allowing all endpoints"
        );
        return [];
    }
}

// Check if endpoint is whitelisted
export function isEndpointWhitelisted(endpointId: number): boolean {
    const whitelist = getWhitelistedEndpoints();

    // If whitelist is empty or not loaded, allow all endpoints
    if (whitelist.length === 0) {
        return true;
    }

    // Check if endpoint is in the whitelist
    return whitelist.includes(endpointId);
}

// Get list of unique stack names
export function getStacks(): string[] {
    const config = getWhitelistConfig();
    if (!config || !config.serviceMapping) {
        return [];
    }

    const stacks = new Set<string>();
    Object.values(config.serviceMapping).forEach((mapping) => {
        if (mapping.stackName) {
            stacks.add(mapping.stackName);
        }
    });

    return Array.from(stacks).sort();
}

// Get services belonging to a stack
export function getServicesByStack(stackName: string): string[] {
    const config = getWhitelistConfig();
    if (!config || !config.serviceMapping) {
        return [];
    }

    const services: string[] = [];
    Object.entries(config.serviceMapping).forEach(([serviceName, mapping]) => {
        if (mapping.stackName === stackName) {
            services.push(serviceName);
        }
    });

    return services.sort();
}

// Get stack configuration (webhook, etc.)
// Assumes all services in stack share the same webhook
export function getStackConfig(stackName: string): { gitOpsWebhook?: string } | null {
    const services = getServicesByStack(stackName);
    if (services.length === 0) return null;

    // Get config from the first service in the stack
    const serviceConfig = getServiceConfig(services[0]);
    return serviceConfig ? { gitOpsWebhook: serviceConfig.gitOpsWebhook } : null;
}
