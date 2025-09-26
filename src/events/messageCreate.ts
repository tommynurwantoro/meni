import { Events, Message } from 'discord.js';
import { ConfigManager } from '../utils/config';

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message) {
    // Ignore bot messages and DMs
    if (message.author.bot || !message.guildId) return;

    // Check if link protection is enabled
    const config = ConfigManager.getGuildConfig(message.guildId);
    if (!config?.moderation?.linkProtection) return;

    // Check if message contains links
    const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(discord\.gg\/[^\s]+)/i;
    if (!linkRegex.test(message.content)) return;

    // Check if any links are whitelisted
    const whitelistDomains = config?.moderation?.whitelistDomains || [];
    const messageLinks = message.content.match(linkRegex) || [];

    // Check if all links are whitelisted
    const allLinksWhitelisted = messageLinks.every(link => {
        try {
            const url = new URL(link.startsWith('http') ? link : `https://${link}`);
            const domain = url.hostname.toLowerCase();
            return whitelistDomains.some(whitelisted =>
                domain === whitelisted.toLowerCase() ||
                domain.endsWith(`.${whitelisted.toLowerCase()}`)
            );
        } catch {
            // If URL parsing fails, check if the link contains whitelisted domains
            return whitelistDomains.some(whitelisted =>
                link.toLowerCase().includes(whitelisted.toLowerCase())
            );
        }
    });

    // If all links are whitelisted, allow the message
    if (allLinksWhitelisted && whitelistDomains.length > 0) return;

    try {
        // Delete the message
        await message.delete();

        // Create warning embed
        const warningEmbed = {
            color: 0xff0000,
            title: '🔗 Link Protection Alert',
            description: `**Message from ${message.author} was removed due to link protection.**`,
            footer: {
                text: 'Powered by BULLSTER'
            },
            timestamp: new Date().toISOString()
        };

        // Send warning to the channel
        if ('send' in message.channel) {
            await message.channel.send({
                embeds: [warningEmbed]
            });
        }

        // Log the action to moderation channel
        const channelName = 'name' in message.channel ? message.channel.name : 'Unknown';
        console.log(`Link protection: Removed message from ${message.author.tag} in ${message.guild?.name}#${channelName}`);

        // Send log to moderation channel if configured
        if (config?.moderation?.logsChannel) {
            try {
                const logChannel = message.guild?.channels.cache.get(config.moderation.logsChannel);
                if (logChannel && 'send' in logChannel) {
                    const logEmbed = {
                        color: 0xff0000,
                        title: '🔗 Link Protection Action',
                        description: `**Message removed due to link protection**`,
                        fields: [
                            {
                                name: '👤 User',
                                value: `${message.author.tag} (<@${message.author.id}>)`,
                                inline: true
                            },
                            {
                                name: '📋 Channel',
                                value: `<#${message.channel.id}>`,
                                inline: true
                            },
                            {
                                name: '📝 Message Content',
                                value: message.content.length > 1024
                                    ? message.content.substring(0, 1021) + '...'
                                    : message.content,
                                inline: false
                            },
                            {
                                name: '⏰ Timestamp',
                                value: new Date().toISOString(),
                                inline: true
                            }
                        ],
                        footer: {
                            text: 'Powered by BULLSTER - Link Protection'
                        },
                        timestamp: new Date().toISOString()
                    };

                    await logChannel.send({ embeds: [logEmbed] });
                }
            } catch (logError) {
                console.error('Error sending log to moderation channel:', logError);
            }
        }

    } catch (error) {
        console.error('Error handling link protection:', error);

        // If we can't delete the message, at least send a warning
        try {
            if ('send' in message.channel) {
                await message.channel.send({
                    content: `⚠️ **Link Protection Warning**\n\n${message.author}, please do not post links in this channel. Your message has been flagged for moderation.`
                });
            }
        } catch (warningError) {
            console.error('Error sending link protection warning:', warningError);
        }
    }
}
