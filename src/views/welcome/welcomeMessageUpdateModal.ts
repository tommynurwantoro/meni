import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonInteraction } from 'discord.js';

export function createWelcomeMessageUpdateModal() {
    const modal = new ModalBuilder()
        .setCustomId('welcome_message_modal')
        .setTitle('🔗 Update Welcome Message');

    const whitelistInput = new TextInputBuilder()
        .setCustomId('welcome_message_input')
        .setLabel('Welcome Message')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Enter the welcome message')
        .setRequired(true)
        .setMaxLength(1000);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(whitelistInput);

    modal.addComponents(firstActionRow);

    return modal;
}

export async function showWelcomeMessageUpdateModal(interaction: ButtonInteraction) {
    const modal = createWelcomeMessageUpdateModal();
    await interaction.showModal(modal);
}