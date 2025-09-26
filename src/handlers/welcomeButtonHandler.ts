import { ButtonInteraction, MessageFlags } from 'discord.js';
import { showWelcomeChannelPanel } from '../views/welcome/welcomeChannelPanel';
import { ConfigManager } from '../utils/config';
import { createWelcomeConfigPanel } from '../views/welcome/welcomeConfigPanel';
import { showWelcomeMessageUpdateModal } from '../views/welcome/welcomeMessageUpdateModal';

export async function handleWelcomeButton(interaction: ButtonInteraction) {
    const customId = interaction.customId;

    switch (customId) {
        case 'welcome_enable':
            await handleWelcomeEnable(interaction);
            break;
        case 'welcome_disable':
            await handleWelcomeDisable(interaction);
            break;
        case 'welcome_message_update':
            await handleWelcomeMessageUpdate(interaction);
            break;
        case 'welcome_test':
            await handleWelcomeTest(interaction);
            break;
        default:
            await interaction.reply({
                content: '❌ Unknown welcome option',
                flags: MessageFlags.Ephemeral
            });
    }
}

async function handleWelcomeEnable(interaction: ButtonInteraction) {
    await showWelcomeChannelPanel(interaction);
}

async function handleWelcomeDisable(interaction: ButtonInteraction) {
    if (!interaction.guildId) return;
    try {
        // Update the configuration with the selected moderation logs channel
        const currentConfig = ConfigManager.getGuildConfig(interaction.guildId) || {};
        const welcomeConfig = currentConfig.welcome || {};

        ConfigManager.updateGuildConfig(interaction.guildId, {
            ...currentConfig,
            welcome: {
                ...welcomeConfig,
                channel: undefined,
                message: undefined,
            }
        });

        const channel = interaction.channel;
        if (channel && channel.isTextBased()) {
            const message = await channel.messages.fetch(interaction.message.id);
            if (message) {
                const panel = createWelcomeConfigPanel(interaction.guildId);

                await message.edit({
                    embeds: [panel.embed],
                    components: [panel.components[0] as any, panel.components[1] as any]
                });

                await interaction.reply({
                    content: '✅ Welcome system disabled.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    } catch (error) {
        console.error('Error disabling welcome system:', error);
        await interaction.reply({
            content: '❌ Failed to disable welcome system. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

async function handleWelcomeMessageUpdate(interaction: ButtonInteraction) {
    await showWelcomeMessageUpdateModal(interaction);
}

async function handleWelcomeTest(interaction: ButtonInteraction) {
    const { ConfigManager } = await import('../utils/config');

    const guildId = interaction.guildId;
    if (!guildId) return;
    const config = ConfigManager.getGuildConfig(guildId);

    // Check if welcome system is configured
    if (!config?.welcome?.channel || !config?.welcome?.message) {
        await interaction.reply({
            content: '⚠️ Welcome system not configured. Please configure it first.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    try {
        // Get the configured welcome channel
        const channel = interaction.guild?.channels.cache.get(config.welcome.channel);
        if (!channel || !('send' in channel)) {
            await interaction.reply({
                content: '❌ Welcome channel not found. Please reconfigure the welcome system.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        // Create a test welcome embed
        const { EmbedBuilder } = await import('discord.js');
        const testWelcomeEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎉 Welcome! (TEST)')
            .setDescription(config.welcome.message)
            .setThumbnail(interaction.user.displayAvatarURL())
            .addFields(
                { name: '👋 Member', value: `${interaction.user}`, inline: true },
                { name: '📅 Joined Discord', value: `<t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '🎯 Server Member Count', value: `${interaction.guild?.memberCount}`, inline: true },
                { name: '🧪 Test Mode', value: 'This is a test welcome message', inline: false }
            )
            .setFooter({ text: `Powered by BULLSTER - Test by ${interaction.user.tag}` })
            .setTimestamp();

        // Send the test welcome message to the configured channel
        await channel.send({ embeds: [testWelcomeEmbed] });

        // Show simple success message
        await interaction.reply({
            content: `✅ Test welcome message sent successfully to <#${config.welcome.channel}>!`,
            flags: MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Error testing welcome message:', error);

        await interaction.reply({
            content: '❌ Failed to send test welcome message. Please check bot permissions and try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}
