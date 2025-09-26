import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export function createStockAddModal(messageId: string) {
    const modal = new ModalBuilder()
        .setCustomId(`stock_add_modal:${messageId}`)
        .setTitle('📦 Add New Stock Item');

    const nameInput = new TextInputBuilder()
        .setCustomId('stock_name')
        .setLabel('Item Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter item name (e.g., Custom Role, VIP Pass)')
        .setRequired(true)
        .setMaxLength(100);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('stock_description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Describe what this item provides')
        .setRequired(true)
        .setMaxLength(500);

    const priceInput = new TextInputBuilder()
        .setCustomId('stock_price')
        .setLabel('Price (Points)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter price in points (e.g., 1000)')
        .setRequired(true)
        .setMaxLength(10);

    const quantityInput = new TextInputBuilder()
        .setCustomId('stock_quantity')
        .setLabel('Quantity Available')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter available quantity (e.g., 10)')
        .setRequired(true)
        .setMaxLength(5);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
    const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
    const thirdActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(priceInput);
    const fourthActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(quantityInput);

    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);

    return modal;
}

export function createStockUpdateModal(messageId: string) {
    const modal = new ModalBuilder()
        .setCustomId(`stock_update_modal:${messageId}`)
        .setTitle('🔄 Update Stock Item');

    const nameInput = new TextInputBuilder()
        .setCustomId('stock_name')
        .setLabel('Item Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter new item name')
        .setRequired(true)
        .setMaxLength(100);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('stock_description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Enter new description')
        .setRequired(false)
        .setMaxLength(500);

    const priceInput = new TextInputBuilder()
        .setCustomId('stock_price')
        .setLabel('Price (Points)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter new price in points')
        .setRequired(false)
        .setMaxLength(10);

    const quantityInput = new TextInputBuilder()
        .setCustomId('stock_quantity')
        .setLabel('Quantity Available')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter new quantity')
        .setRequired(false)
        .setMaxLength(5);

    const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
    const thirdActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
    const fourthActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(priceInput);
    const fifthActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(quantityInput);

    modal.addComponents(secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);

    return modal;
}

export function createStockRemoveModal(messageId: string) {
    const modal = new ModalBuilder()
        .setCustomId(`stock_remove_modal:${messageId}`)
        .setTitle('🗑️ Remove Stock Item');

    const nameInput = new TextInputBuilder()
        .setCustomId('stock_name')
        .setLabel('Item Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter item name to remove')
        .setRequired(true)
        .setMaxLength(100);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
    modal.addComponents(firstActionRow);

    return modal;
}