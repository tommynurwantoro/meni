import { Events, GuildMember, EmbedBuilder } from 'discord.js';
import { ConfigManager } from '../utils/config';

export const name = Events.GuildMemberAdd;
export const once = false;

export async function execute(member: GuildMember) {
    // Get configured welcome message
    const config = ConfigManager.getGuildConfig(member.guild.id);
    const welcomeMessage = config?.welcome?.message || 'Welcome to our amazing community! 🎉';

    const welcomeEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎉 Welcome!')
        .setDescription(welcomeMessage)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
            { name: '👋 Member', value: `${member}`, inline: true },
            { name: '📅 Joined Discord', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
            { name: '🎯 Server Member Count', value: `${member.guild.memberCount}`, inline: true }
        )
        .setFooter({ text: `Powered by MENI` })
        .setTimestamp();

    // Send to configured welcome channel
    if (config?.welcome?.channel) {
        const channel = member.guild.channels.cache.get(config.welcome.channel);
        if (channel && 'send' in channel) {
            await channel.send({ embeds: [welcomeEmbed] });
        }
    }
}