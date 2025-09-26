import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction, ChannelSelectMenuInteraction } from 'discord.js';
import { ConfigManager } from '../../utils/config';

export function createWelcomeConfigPanel(guildId: string) {
    const config = ConfigManager.getGuildConfig(guildId);
    const embed = new EmbedBuilder()
        .setColor(config?.welcome?.channel ? '#00ff00' : '#ff0000')
        .setTitle('🎯 Welcome System Configuration')
        .setDescription('Click the buttons below to configure the welcome system')
        .setFooter({ text: 'Powered by BULLSTER' });

    const row = new ActionRowBuilder()
        .addComponents(
            !config?.welcome?.channel ? new ButtonBuilder()
                .setCustomId(`welcome_enable`)
                .setLabel('Enable Welcome System')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅') : new ButtonBuilder()
                    .setCustomId(`welcome_disable`)
                    .setLabel('Disable Welcome System')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌'),
            new ButtonBuilder()
                .setCustomId('welcome_message_update')
                .setLabel('Update Welcome Message')
                .setStyle(config?.welcome?.channel ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('🔄')
                .setDisabled(!config?.welcome?.channel),
            new ButtonBuilder()
                .setCustomId('welcome_test')
                .setLabel('Test Welcome')
                .setStyle(config?.welcome?.channel ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('🧪')
                .setDisabled(!config?.welcome?.channel)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('main_back')
                .setLabel('Back to Configuration Panel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
        );
    return {
        embed,
        components: [row, row2]
    };
}

export async function showWelcomeConfigPanel(interaction: ButtonInteraction | ChannelSelectMenuInteraction, additionalMessage?: string) {
    if (!interaction.guildId) return;
    const panel = createWelcomeConfigPanel(interaction.guildId);
    await interaction.update({
        content: additionalMessage || '',
        embeds: [panel.embed],
        components: [panel.components[0] as any, panel.components[1] as any]
    });
}