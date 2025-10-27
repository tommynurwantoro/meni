import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} from 'discord.js';
import { getPortainerClient, ImagePullProgress, Service } from '../utils/portainerClient';
import { getGitLabClient } from '../utils/gitlabClient';
import { readFileSync } from 'fs';
import { join } from 'path';

// Whitelist structure interfaces
interface ServiceMapping {
    gitlabProjectId: string;
    description: string;
}

interface WhitelistConfig {
    services: string[];
    serviceMapping: Record<string, ServiceMapping>;
    description?: string;
}

// Load whitelist configuration
function getWhitelistConfig(): WhitelistConfig | null {
    try {
        const whitelistPath = join(process.cwd(), 'whitelist_service.json');
        const whitelistData = readFileSync(whitelistPath, 'utf-8');
        const whitelist = JSON.parse(whitelistData);
        return whitelist;
    } catch (error) {
        console.warn('⚠️ Could not load whitelist_service.json, showing all services');
        return null;
    }
}

// Get list of whitelisted service names
function getWhitelistedServices(): string[] {
    const config = getWhitelistConfig();
    
    if (!config || !config.services) {
        return [];
    }
    
    return config.services;
}

// Filter services based on whitelist
function filterWhitelistedServices(services: Service[]): Service[] {
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
function getGitLabProjectId(serviceName: string): string | null {
    const config = getWhitelistConfig();
    
    if (!config || !config.serviceMapping || !config.serviceMapping[serviceName]) {
        return null;
    }
    
    return config.serviceMapping[serviceName].gitlabProjectId;
}

// Load whitelist endpoints
function getWhitelistedEndpoints(): number[] {
    try {
        const whitelistPath = join(process.cwd(), 'whitelist_endpoint.json');
        const whitelistData = readFileSync(whitelistPath, 'utf-8');
        const whitelist = JSON.parse(whitelistData);
        return whitelist.endpoints || [];
    } catch (error) {
        console.warn('⚠️ Could not load whitelist_endpoint.json, allowing all endpoints');
        return [];
    }
}

// Check if endpoint is whitelisted
function isEndpointWhitelisted(endpointId: number): boolean {
    const whitelist = getWhitelistedEndpoints();
    
    // If whitelist is empty or not loaded, allow all endpoints
    if (whitelist.length === 0) {
        return true;
    }
    
    // Check if endpoint is in the whitelist
    return whitelist.includes(endpointId);
}

export const data = new SlashCommandBuilder()
    .setName('deploy')
    .setDescription('Deploy services using Portainer API')
    .addSubcommand(subcommand =>
        subcommand
            .setName('service')
            .setDescription('Deploy a specific service interactively')
            .addIntegerOption(option =>
                option
                    .setName('endpoint')
                    .setDescription('Portainer endpoint ID')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('List all available services')
            .addIntegerOption(option =>
                option
                    .setName('endpoint')
                    .setDescription('Portainer endpoint ID')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('search')
                    .setDescription('Search services by name (optional)')
                    .setRequired(false)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('multi')
            .setDescription('Deploy multiple services interactively')
            .addIntegerOption(option =>
                option
                    .setName('endpoint')
                    .setDescription('Portainer endpoint ID')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('status')
            .setDescription('Check Portainer connection status')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('tags')
            .setDescription('Get latest 3 tags for a service from GitLab')
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    try {
        // Check if user has required role
        const allowedRoleId = process.env.DEPLOY_ROLE_ID;
        
        if (allowedRoleId) {
            // Check if interaction is from a guild (not DM)
            if (!interaction.guild) {
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Access Denied')
                    .setDescription('Deploy commands can only be used in a server.')
                    .setTimestamp();
                
                await interaction.reply({ embeds: [dmEmbed], ephemeral: true });
                return;
            }

            // Get member from guild
            const member = await interaction.guild.members.fetch(interaction.user.id);
            
            // Check if member has the required role
            if (!member.roles.cache.has(allowedRoleId)) {
                const noPermissionEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Access Denied')
                    .setDescription('You do not have permission to use deploy commands.')
                    .setFooter({ text: 'Required role is missing' })
                    .setTimestamp();
                
                await interaction.reply({ embeds: [noPermissionEmbed], ephemeral: true });
                return;
            }
        }

        const client = getPortainerClient();

        switch (subcommand) {
            case 'service':
                await handleServiceDeploy(interaction, client);
                break;
            case 'list':
                await handleListServices(interaction, client);
                break;
            case 'multi':
                await handleMultiDeploy(interaction, client);
                break;
            case 'tags':
                await handleGetTags(interaction);
                break;
            case 'status':
                await handleStatus(interaction, client);
                break;
        }
    } catch (error: any) {
        console.error('Deploy command error:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Deployment Error')
            .setDescription(error.message || 'An unknown error occurred')
            .setTimestamp();

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

async function handleServiceDeploy(interaction: ChatInputCommandInteraction, client: any) {
    const endpointId = interaction.options.getInteger('endpoint', true);

    await interaction.deferReply();

    // Validate endpoint is whitelisted
    if (!isEndpointWhitelisted(endpointId)) {
        const notAllowedEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Access Denied')
            .setDescription(`Endpoint ID \`${endpointId}\` is not whitelisted for deployment.`)
            .setFooter({ text: 'Contact admin to add this endpoint to the whitelist' })
            .setTimestamp();

        await interaction.editReply({ embeds: [notAllowedEmbed] });
        return;
    }

    try {
        const allServices = await client.getServices(endpointId);
        
        // Filter services based on whitelist
        const services = filterWhitelistedServices(allServices);

        if (services.length === 0) {
            const noServicesEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('📋 Service Deployment')
                .setDescription('No whitelisted services found in this endpoint.')
                .setFooter({ text: 'Powered by MENI' })
                .setTimestamp();

            await interaction.editReply({ embeds: [noServicesEmbed] });
            return;
        }

        // Sort services alphabetically by name
        const sortedServices = services.sort((a: Service, b: Service) => 
            a.Spec.Name.localeCompare(b.Spec.Name)
        );

        // Create select menu with up to 25 services (Discord limit)
        const options = sortedServices.slice(0, 25).map((service: Service) => ({
            label: service.Spec.Name,
            value: service.Spec.Name,
            description: service.Spec.TaskTemplate.ContainerSpec.Image.substring(0, 100)
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('service_select_single')
            .setPlaceholder('Select a service to deploy')
            .setMinValues(1)
            .setMaxValues(1) // Only allow selecting one service
            .addOptions(options);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📋 Service Deployment')
            .setDescription('Select a service to deploy. If the service is not showing, please contact admin to add it to the whitelist.')
            .setFooter({ text: 'Powered by MENI' })
            .setTimestamp();

        const message = await interaction.editReply({ 
            embeds: [embed], 
            components: [row] 
        });

        // Wait for selection
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000 // 1 minute
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: 'This menu is not for you!', ephemeral: true });
                return;
            }

            const serviceName = i.values[0];
            
            // Show starting embed
            const startEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🚀 Starting Deployment')
                .setDescription(`Deploying service: **${serviceName}**`)
                .addFields(
                    { name: 'Endpoint', value: `${endpointId}`, inline: true },
                    { name: 'Status', value: '⏳ In Progress...', inline: true }
                )
                .setFooter({ text: 'Powered by MENI' })
                .setTimestamp();

            await i.update({ 
                embeds: [startEmbed], 
                components: [] 
            });

            try {
                const result = await client.deployService(endpointId, serviceName);

                // Determine embed color based on health status
                let embedColor = 0x00FF00; // Green
                let title = '✅ Deployment Successful';
                
                if (result.health) {
                    if (!result.health.healthy) {
                        if (result.health.status === 'failed') {
                            embedColor = 0xFF0000; // Red
                            title = '❌ Deployment Failed';
                        } else if (result.health.status === 'timeout') {
                            embedColor = 0xFFA500; // Orange
                            title = '⚠️ Deployment Completed (Health Check Timeout)';
                        }
                    }
                }

                // Create success embed with pull results
                const successEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle(title)
                    .setDescription(result.message)
                    .addFields(
                        { name: 'Service', value: serviceName, inline: true },
                        { name: 'Endpoint', value: `${endpointId}`, inline: true }
                    )
                    .setFooter({ text: 'Powered by MENI' })
                    .setTimestamp();

                // Add health status
                if (result.health) {
                    let healthStatus = '';
                    if (result.health.healthy) {
                        healthStatus = `✅ **Healthy** (${result.health.runningTasks}/${result.health.desiredReplicas} replicas running)`;
                    } else if (result.health.status === 'failed') {
                        healthStatus = `❌ **Failed** (${result.health.runningTasks}/${result.health.desiredReplicas} replicas running)`;
                        
                        if (result.health.failedTasks.length > 0) {
                            healthStatus += '\n\n**Errors:**\n';
                            result.health.failedTasks.slice(0, 3).forEach((task: any) => {
                                healthStatus += `• ${task.error.substring(0, 100)}\n`;
                            });
                        }
                    } else if (result.health.status === 'timeout') {
                        healthStatus = `⏱️ **Timeout**\n${result.health.runningTasks}/${result.health.desiredReplicas} replicas running\n\nService is still starting up`;
                    }
                    
                    successEmbed.addFields({
                        name: '🏥 Service Health',
                        value: healthStatus.substring(0, 1024)
                    });
                }

                // Add node pull results with SHA digest
                if (result.pullResults && result.pullResults.length > 0) {
                    const successfulPulls = result.pullResults.filter((r: ImagePullProgress) => r.status === 'success');
                    const failedPulls = result.pullResults.filter((r: ImagePullProgress) => r.status === 'failed');
                    
                    let pullResultsText = '';
                    
                    // Show successful pulls with digest info
                    if (successfulPulls.length > 0) {
                        pullResultsText += '✅ Success:\n';
                        successfulPulls.forEach((r: ImagePullProgress, idx: number) => {
                            pullResultsText += `--- Node ${idx + 1} ---\n`;
                            const digest = r.digest ? `• Digest: \`${r.digest}\`` : '';
                            const imageIdInfo = r.imageId ? `• Image ID: \`${r.imageId.slice(-12)}\`` : '';
                            pullResultsText += `${digest}\n${imageIdInfo}\n`;
                        });
                    }
                    
                    // Show failed pulls
                    if (failedPulls.length > 0) {
                        pullResultsText += '❌ Failed:\n';
                        failedPulls.forEach((r: ImagePullProgress) => {
                            pullResultsText += `• Node: ${r.node}: ${r.error || 'Unknown error'}\n`;
                        });
                    }

                    if (pullResultsText) {
                        successEmbed.addFields({
                            name: '📦 Image Pull Results',
                            value: pullResultsText.length > 1024 ? pullResultsText.substring(0, 1021) + '...' : pullResultsText
                        });
                    }
                }

                await interaction.editReply({ embeds: [successEmbed] });
            } catch (error: any) {
                console.error('Service deploy error:', error);
                
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Deployment Error')
                    .setDescription(error.message || 'An unknown error occurred during deployment')
                    .setFooter({ text: 'Powered by MENI' })
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [errorEmbed] });
            }
        });

        collector.on('end', (collected) => {
            if (collected.size === 0) {
                interaction.editReply({ 
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('⏰ Timeout')
                        .setDescription('Service selection timed out.')
                        .setFooter({ text: 'Powered by MENI' })
                        .setTimestamp()], 
                    components: [] 
                });
            }
        });
    } catch (error: any) {
        throw error;
    }
}

async function handleListServices(interaction: ChatInputCommandInteraction, client: any) {
    const endpointId = interaction.options.getInteger('endpoint', true);
    const search = interaction.options.getString('search');

    await interaction.deferReply();

    // Validate endpoint is whitelisted
    if (!isEndpointWhitelisted(endpointId)) {
        const notAllowedEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Access Denied')
            .setDescription(`Endpoint ID \`${endpointId}\` is not whitelisted.`)
            .setFooter({ text: 'Contact admin to add this endpoint to the whitelist' })
            .setTimestamp();

        await interaction.editReply({ embeds: [notAllowedEmbed] });
        return;
    }

    try {
        const allServices = await client.getServices(endpointId);
        
        // Filter services based on whitelist first
        const whitelistedServices = filterWhitelistedServices(allServices);
        
        // Then filter by search term if provided
        const services = search 
            ? whitelistedServices.filter((service: Service) => service.Spec.Name.toLowerCase().includes(search.toLowerCase()))
            : whitelistedServices;

        if (services.length === 0) {
            const noServicesEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('📋 Services List')
                .setDescription(search 
                    ? `No whitelisted services found containing "${search}" in this endpoint.`
                    : 'No whitelisted services found in this endpoint.'
                )
                .setFooter({ text: 'Powered by MENI' })
                .setTimestamp();

            await interaction.editReply({ embeds: [noServicesEmbed] });
            return;
        }

        // Group services by first 10 for pagination
        const servicesPerPage = 10;
        const pages = Math.ceil(services.length / servicesPerPage);
        let currentPage = 0;

        const generateEmbed = (page: number) => {
            const start = page * servicesPerPage;
            const end = start + servicesPerPage;
            const pageServices = services.slice(start, end);

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📋 Available Services')
                .setDescription(
                    search 
                        ? `Showing ${start + 1}-${Math.min(end, services.length)} of ${services.length} services (search: "${search}")`
                        : `Showing ${start + 1}-${Math.min(end, services.length)} of ${services.length} services`
                )
                .setFooter({ text: `Page ${page + 1} of ${pages}` })
                .setFooter({ text: 'Powered by MENI' })
                .setTimestamp();

            pageServices.forEach((service: Service) => {
                const image = service.Spec.TaskTemplate.ContainerSpec.Image;
                embed.addFields({
                    name: service.Spec.Name,
                    value: `Image: \`${image}\``,
                    inline: false
                });
            });

            return embed;
        };

        const embed = generateEmbed(currentPage);
        const components = [];

        // Add pagination buttons if needed
        if (pages > 1) {
            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('previous')
                        .setLabel('◀ Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === pages - 1)
                );
            components.push(row);
        }

        const message = await interaction.editReply({ 
            embeds: [embed], 
            components: components as any
        });

        // Handle pagination
        if (pages > 1) {
            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000 // 5 minutes
            });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({ content: 'These buttons are not for you!', ephemeral: true });
                    return;
                }

                if (i.customId === 'next') {
                    currentPage++;
                } else if (i.customId === 'previous') {
                    currentPage--;
                }

                const newEmbed = generateEmbed(currentPage);
                const row = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('previous')
                            .setLabel('◀ Previous')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(currentPage === 0),
                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Next ▶')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(currentPage === pages - 1)
                    );

                await i.update({ embeds: [newEmbed], components: [row] });
            });
        }
    } catch (error: any) {
        throw error;
    }
}

async function handleMultiDeploy(interaction: ChatInputCommandInteraction, client: any) {
    const endpointId = interaction.options.getInteger('endpoint', true);

    await interaction.deferReply();

    // Validate endpoint is whitelisted
    if (!isEndpointWhitelisted(endpointId)) {
        const notAllowedEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Access Denied')
            .setDescription(`Endpoint ID \`${endpointId}\` is not whitelisted for deployment.`)
            .setFooter({ text: 'Contact admin to add this endpoint to the whitelist' })
            .setTimestamp();

        await interaction.editReply({ embeds: [notAllowedEmbed] });
        return;
    }

    try {
        const allServices = await client.getServices(endpointId);
        
        // Filter services based on whitelist
        const services = filterWhitelistedServices(allServices);

        if (services.length === 0) {
            const noServicesEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('📋 Multi-Service Deployment')
                .setDescription('No whitelisted services found in this endpoint.')
                .setFooter({ text: 'Powered by MENI' })
                .setTimestamp();

            await interaction.editReply({ embeds: [noServicesEmbed] });
            return;
        }

        // Sort services alphabetically by name
        const sortedServices = services.sort((a: Service, b: Service) => 
            a.Spec.Name.localeCompare(b.Spec.Name)
        );

        // Create select menu with up to 25 services (Discord limit)
        const options = sortedServices.slice(0, 25).map((service: Service) => ({
            label: service.Spec.Name,
            value: service.Spec.Name,
            description: service.Spec.TaskTemplate.ContainerSpec.Image.substring(0, 100)
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('service_select')
            .setPlaceholder('Select services to deploy')
            .setMinValues(1)
            .setMaxValues(Math.min(options.length, 25))
            .addOptions(options);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📋 Multi-Service Deployment')
            .setDescription('Select one or more services to deploy. If the service is not showing, please contact admin to add it to the whitelist.')
            .setFooter({ text: 'Powered by MENI' })
            .setTimestamp();

        const message = await interaction.editReply({ 
            embeds: [embed], 
            components: [row] 
        });

        // Wait for selection
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000 // 1 minute
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: 'This menu is not for you!', ephemeral: true });
                return;
            }

            const selectedServices = i.values;
            
            // Show starting embed with list of services
            const serviceList = selectedServices.map((s, idx) => `${idx + 1}. ${s}`).join('\n');
            await i.update({ 
                embeds: [new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('🚀 Starting Multi-Service Deployment')
                    .setDescription(`Deploying **${selectedServices.length}** service(s)...`)
                    .addFields({
                        name: '📋 Services',
                        value: serviceList.substring(0, 1024),
                        inline: false
                    })
                    .addFields({
                        name: 'Status',
                        value: '⏳ In Progress...',
                        inline: false
                    })
                    .setFooter({ text: 'Powered by MENI' })
                    .setTimestamp()], 
                components: [] 
            });

            try {
                const results = await client.deployMultipleServicesOptimized(endpointId, selectedServices);
                
                const successCount = results.results.filter((r: any) => r.success).length;
                const failCount = results.results.length - successCount;
                
                // Determine embed color based on results
                let embedColor = 0x00FF00; // Green for all success
                if (failCount > 0 && successCount > 0) {
                    embedColor = 0xFFA500; // Orange for partial success
                } else if (successCount === 0) {
                    embedColor = 0xFF0000; // Red for all failed
                }

                const resultEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle(successCount === selectedServices.length 
                        ? '✅ All Services Deployed Successfully' 
                        : failCount === selectedServices.length 
                        ? '❌ All Deployments Failed'
                        : '⚠️ Partial Deployment Success')
                    .setDescription(`**Successful:** ${successCount} / ${selectedServices.length} | **Failed:** ${failCount}`)
                    .setFooter({ text: 'Powered by MENI' })
                    .setTimestamp();

                // Group results by success/failure
                const successResults = results.results.filter((r: any) => r.success);
                const failedResults = results.results.filter((r: any) => !r.success);

                // Add successful deployments
                if (successResults.length > 0) {
                    let successText = '';
                    successResults.forEach((result: any) => {
                        const pullInfo = result.pullResults 
                            ? ` (${result.pullResults.filter((p: ImagePullProgress) => p.status === 'success').length}/${result.pullResults.length} nodes)`
                            : '';
                        
                        // Get health status icon
                        let healthIcon = '';
                        if (result.health) {
                            if (result.health.healthy) {
                                healthIcon = ' 🟢';
                            } else if (result.health.status === 'failed') {
                                healthIcon = ' 🔴';
                            } else if (result.health.status === 'timeout') {
                                healthIcon = ' 🟡';
                            }
                        }
                        
                        // Get image ID from successful pull results
                        let imageIdInfo = '';
                        let digestInfo = '';
                        if (result.pullResults) {
                            const successfulPull = result.pullResults.find((p: ImagePullProgress) => p.status === 'success' && p.imageId);
                            if (successfulPull && successfulPull.imageId) {
                                digestInfo = `\n└ Digest: \`${successfulPull.digest}\``;
                                imageIdInfo = `\n└ Image ID: \`${successfulPull.imageId.slice(-12)}\``;
                            }
                        }
                        
                        // Add health info
                        let healthInfo = '';
                        if (result.health) {
                            healthInfo = `\n└ Health: ${result.health.runningTasks}/${result.health.desiredReplicas} running`;
                        }
                        
                        successText += `✅ **${result.serviceName}**${healthIcon}${pullInfo}${digestInfo}${imageIdInfo}${healthInfo}\n`;
                    });
                    
                    resultEmbed.addFields({
                        name: `✅ Successful Deployments (${successResults.length})`,
                        value: successText.substring(0, 1024),
                        inline: false
                    });
                }

                // Add failed deployments
                if (failedResults.length > 0) {
                    let failText = '';
                    failedResults.forEach((result: any) => {
                        const errorMsg = result.message.replace(/^❌\s*/, '').split('\n')[0]; // Get first line without emoji
                        failText += `❌ **${result.serviceName}**\n└ ${errorMsg.substring(0, 100)}\n`;
                    });
                    
                    resultEmbed.addFields({
                        name: `❌ Failed Deployments (${failedResults.length})`,
                        value: failText.substring(0, 1024),
                        inline: false
                    });
                }

                await interaction.editReply({ embeds: [resultEmbed] });
            } catch (error: any) {
                console.error('Multi-deploy error:', error);
                
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Multi-Service Deployment Error')
                    .setDescription(error.message || 'An unknown error occurred during multi-service deployment')
                    .setFooter({ text: 'Powered by MENI' })
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [errorEmbed] });
            }
        });

        collector.on('end', (collected) => {
            if (collected.size === 0) {
                interaction.editReply({ 
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('⏰ Timeout')
                        .setDescription('Service selection timed out.')
                        .setTimestamp()], 
                    components: [] 
                });
            }
        });
    } catch (error: any) {
        throw error;
    }
}

async function handleStatus(interaction: ChatInputCommandInteraction, client: any) {
    await interaction.deferReply();

    try {
        const allEndpoints = await client.getEndpoints();
        const whitelist = getWhitelistedEndpoints();

        // Filter endpoints based on whitelist
        const endpoints = whitelist.length > 0
            ? allEndpoints.filter((ep: any) => whitelist.includes(ep.Id))
            : allEndpoints;

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Portainer Connection Status')
            .setDescription('Connected to Portainer API')
            .setFooter({ text: 'Powered by MENI' })
            .setTimestamp();

        if (endpoints && endpoints.length > 0) {
            const endpointsList = endpoints
                .map((ep: any) => `**${ep.Name}** (ID: ${ep.Id}) - ${ep.Type === 2 ? 'Docker Swarm' : 'Docker'}`)
                .join('\n');

            const fieldTitle = whitelist.length > 0 
                ? `📡 Whitelisted Endpoints (${endpoints.length}/${allEndpoints.length})`
                : `📡 Available Endpoints (${endpoints.length})`;

            embed.addFields({
                name: fieldTitle,
                value: endpointsList.length > 1024 ? endpointsList.substring(0, 1021) + '...' : endpointsList
            });
        } else if (whitelist.length > 0 && endpoints.length === 0) {
            embed.addFields({
                name: '⚠️ No Whitelisted Endpoints Found',
                value: 'None of the whitelisted endpoint IDs exist in Portainer.'
            });
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
        throw error;
    }
}

/**
 * Handle /deploy tags command
 */
async function handleGetTags(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    
    try {
        // Get whitelisted services
        const services = getWhitelistedServices();
        
        if (services.length === 0) {
            const noServicesEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('📋 Get Service Tags')
                .setDescription('No services found in whitelist configuration.')
                .setFooter({ text: 'Contact admin to configure services' })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [noServicesEmbed] });
            return;
        }
        
        // Sort services alphabetically
        const sortedServices = services.sort((a, b) => a.localeCompare(b));
        
        // Create select menu with services (up to 25 - Discord limit)
        const options = sortedServices.slice(0, 25).map((service) => {
            const config = getWhitelistConfig();
            const description = config?.serviceMapping?.[service]?.description || 'No description';
            
            return {
                label: service,
                value: service,
                description: description.substring(0, 100)
            };
        });
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('tags_service_select')
            .setPlaceholder('Select a service to view tags')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(options);
        
        const row = new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(selectMenu);
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📋 Get Service Tags from GitLab')
            .setDescription('Select a service to view its latest 5 tags from GitLab.')
            .setFooter({ text: 'Powered by MENI' })
            .setTimestamp();
        
        const message = await interaction.editReply({ 
            embeds: [embed], 
            components: [row] 
        });
        
        // Wait for selection
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000 // 1 minute
        });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: 'This menu is not for you!', ephemeral: true });
                return;
            }
            
            const serviceName = i.values[0];
            
            // Show loading message
            await i.update({ 
                embeds: [new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('🔄 Fetching Tags')
                    .setDescription(`Fetching latest tags for **${serviceName}** from GitLab...`)
                    .setFooter({ text: 'Powered by MENI' })
                    .setTimestamp()], 
                components: [] 
            });
            
            try {
                // Get GitLab project ID for the service
                const projectId = getGitLabProjectId(serviceName);
                if (!projectId) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Service Not Configured')
                        .setDescription(`Service "${serviceName}" doesn't have a GitLab project ID mapping.`)
                        .addFields(
                            { name: 'Service', value: serviceName, inline: true }
                        )
                        .setFooter({ text: 'Contact admin to add GitLab project ID mapping' })
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [errorEmbed] });
                    return;
                }
                
                // Fetch tags from GitLab
                const gitlabClient = getGitLabClient();
                const tags = await gitlabClient.getProjectTags(projectId, 3);
                
                if (tags.length === 0) {
                    const noTagsEmbed = new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setTitle('📋 No Tags Found')
                        .setDescription(`No tags found for service "${serviceName}".`)
                        .addFields(
                            { name: 'Service', value: serviceName, inline: true },
                            { name: 'GitLab Project ID', value: projectId, inline: true }
                        )
                        .setFooter({ text: 'Powered by MENI' })
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [noTagsEmbed] });
                    return;
                }
                
                // Create embed with tags
                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`📋 Latest Tags for ${serviceName}`)
                    .setDescription(`Showing ${tags.length} most recent tag(s) from GitLab`)
                    .addFields(
                        { name: 'Service', value: serviceName, inline: true },
                        { name: 'Project ID', value: projectId, inline: true }
                    )
                    .setFooter({ text: 'Powered by MENI' })
                    .setTimestamp();
                
                // Add each tag as a field
                tags.forEach((tag, index) => {
                    const commitDate = new Date(tag.commit.committed_date).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    let tagInfo = `**Commit:** \`${tag.commit.short_id}\`\n`;
                    tagInfo += `**Date:** ${commitDate}\n`;
                    tagInfo += `**Author:** ${tag.commit.author_name}\n`;
                    
                    if (tag.commit.title) {
                        tagInfo += `**Message:** ${tag.commit.title.substring(0, 100)}${tag.commit.title.length > 100 ? '...' : ''}`;
                    }
                    
                    embed.addFields({
                        name: `${tag.name}`,
                        value: tagInfo,
                        inline: false
                    });
                });
                
                await interaction.editReply({ embeds: [embed] });
            } catch (error: any) {
                console.error('Get tags error:', error);
                
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Failed to Fetch Tags')
                    .setDescription(error.message || 'An unknown error occurred while fetching tags from GitLab')
                    .setFooter({ text: 'Powered by MENI' })
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [errorEmbed] });
            }
        });
        
        collector.on('end', (collected) => {
            if (collected.size === 0) {
                interaction.editReply({ 
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('⏰ Timeout')
                        .setDescription('Service selection timed out.')
                        .setFooter({ text: 'Powered by MENI' })
                        .setTimestamp()], 
                    components: [] 
                });
            }
        });
    } catch (error: any) {
        console.error('Get tags error:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Failed to Load Services')
            .setDescription(error.message || 'An unknown error occurred while loading services')
            .setFooter({ text: 'Powered by MENI' })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [errorEmbed] });
    }
}
