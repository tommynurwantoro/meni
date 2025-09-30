import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction, RoleSelectMenuBuilder } from 'discord.js';

export function createPresensiRolePanel() {
    const embed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle('🎯 Select Presensi Role')
        .setDescription('Choose a role to get presensi reminders notification:')
        .addFields(
            {
                name: '⚠️ Important',
                value: 'This role will receive the presensi reminders notification.',
                inline: false
            }
        )
        .setFooter({ text: 'Powered by MENI' });

    const roleRow = new ActionRowBuilder()
        .addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId(`presensi_role_select`)
                .setPlaceholder('Select role for presensi reminders notification')
                .setMinValues(1)
                .setMaxValues(1)
        );

    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('presensi_back')
                .setLabel('Back to Presensi Config')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
        );

    return {
        embed,
        components: [roleRow, buttonRow]
    };
}

export async function showPresensiRolePanel(interaction: ButtonInteraction, additionalMessage?: string) {
    if (!interaction.guildId) return;
    const panel = createPresensiRolePanel();
    await interaction.update({
        content: additionalMessage || '',
        embeds: [panel.embed],
        components: [panel.components[0] as any, panel.components[1] as any]
    });
}