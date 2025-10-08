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

    try {
        const services = await client.getServices(endpointId);

        if (services.length === 0) {
            const noServicesEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('📋 Service Deployment')
                .setDescription('No services found in this endpoint.')
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
            .setDescription('Select a service to deploy:')
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

                // Create success embed with pull results
                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Deployment Successful')
                    .setDescription(result.message)
                    .addFields(
                        { name: 'Service', value: serviceName, inline: true },
                        { name: 'Endpoint', value: `${endpointId}`, inline: true }
                    )
                    .setFooter({ text: 'Powered by MENI' })
                    .setTimestamp();

                // Add node pull results with SHA digest
                if (result.pullResults && result.pullResults.length > 0) {
                    const successfulPulls = result.pullResults.filter((r: ImagePullProgress) => r.status === 'success');
                    const failedPulls = result.pullResults.filter((r: ImagePullProgress) => r.status === 'failed');
                    
                    let pullResultsText = '';
                    
                    // Show successful pulls with digest info
                    if (successfulPulls.length > 0) {
                        pullResultsText += '✅ Success:\n';
                        successfulPulls.forEach((r: ImagePullProgress) => {
                            const imageIdInfo = r.imageId ? `• Image ID: \`${r.imageId.slice(-12)}\`` : '';
                            pullResultsText += `${imageIdInfo}\n`;
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

    try {
        const allServices = await client.getServices(endpointId);
        
        // Filter services by search term if provided
        const services = search 
            ? allServices.filter((service: Service) => service.Spec.Name.toLowerCase().includes(search.toLowerCase()))
            : allServices;

        if (services.length === 0) {
            const noServicesEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('📋 Services List')
                .setDescription(search 
                    ? `No services found containing "${search}" in this endpoint.`
                    : 'No services found in this endpoint.'
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

    try {
        const services = await client.getServices(endpointId);

        if (services.length === 0) {
            const noServicesEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('📋 Multi-Service Deployment')
                .setDescription('No services found in this endpoint.')
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
            .setDescription('Select one or more services to deploy:')
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
                const results = await client.deployMultipleServices(endpointId, selectedServices);
                
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
                        
                        // Get image ID from successful pull results
                        let imageIdInfo = '';
                        if (result.pullResults) {
                            const successfulPull = result.pullResults.find((p: ImagePullProgress) => p.status === 'success' && p.imageId);
                            if (successfulPull && successfulPull.imageId) {
                                imageIdInfo = `\n└ Image ID: \`${successfulPull.imageId.slice(-12)}\``;
                            }
                        }
                        
                        successText += `✅ **${result.serviceName}**${pullInfo}${imageIdInfo}\n`;
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
        const endpoints = await client.getEndpoints();

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

            embed.addFields({
                name: `📡 Available Endpoints (${endpoints.length})`,
                value: endpointsList.length > 1024 ? endpointsList.substring(0, 1021) + '...' : endpointsList
            });
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
        throw error;
    }
}

