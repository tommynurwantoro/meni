import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export function createLinkProtectionModal(messageId: string) {
    const modal = new ModalBuilder()
        .setCustomId(`link_protection_whitelist_modal:${messageId}`)
        .setTitle('🔗 Configure Link Protection Whitelist');

    const whitelistInput = new TextInputBuilder()
        .setCustomId('whitelist_domains')
        .setLabel('Whitelist Domains')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Enter domains separated by commas (e.g., discord.com, github.com, example.org)')
        .setRequired(false)
        .setMaxLength(1000);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('whitelist_description')
        .setLabel('Description (Optional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Why are these domains whitelisted?')
        .setRequired(false)
        .setMaxLength(100);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(whitelistInput);
    const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);

    modal.addComponents(firstActionRow, secondActionRow);

    return modal;
}
