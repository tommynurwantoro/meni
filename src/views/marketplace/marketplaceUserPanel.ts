import { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import { ConfigManager } from '../../utils/config';

export function createMarketplaceUserPanel(guildId: string) {
  const config = ConfigManager.getGuildConfig(guildId);
  const stockItems = config?.points?.marketplace?.stock || [];
  const marketplaceEnabled = config?.points?.marketplace?.enabled || false;

  if (!marketplaceEnabled) {
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🏪 Marketplace')
      .setDescription('❌ The marketplace is currently disabled.')
      .setFooter({ text: 'Powered by MENI' });

    return {
      embed,
      components: []
    };
  }

  // Create item list display
  let itemsDisplay = '';
  if (stockItems.length === 0) {
    itemsDisplay = '📭 No items available at the moment.\nCheck back later!';
  } else {
    itemsDisplay = stockItems.map((item, index) => {
      const stockStatus = item.quantity > 0 ? `${item.quantity} in stock` : '❌ Out of stock';
      return `**${index + 1}. ${item.name}**` +
             `${item.description}\n` +
             `💰 **${item.price}** points\n` +
             `📦 ${stockStatus}\n`;
    }).join('\n');
  }

  const embed = new EmbedBuilder()
    .setColor('#0000ff')
    .setTitle('Marketplace')
    .setDescription('Welcome to the marketplace! Browse available items and spend your points.\n\n🛍️ Available Items:\n'+itemsDisplay)
    .setFooter({ text: 'Powered by MENI' })
    .setTimestamp();

  // Create components
  const components = [];

  // Add item selection dropdown if there are items in stock
  const availableItems = stockItems.filter(item => item.quantity > 0);
  if (availableItems.length > 0) {
    const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('marketplace_item_select')
        .setPlaceholder('Select an item to purchase...')
        .addOptions(
          availableItems.map((item, index) => 
            new StringSelectMenuOptionBuilder()
              .setLabel(`${item.name} - ${item.price} points`)
              .setDescription(`${item.description} (${item.quantity} available)`)
              .setValue(index.toString())
              .setEmoji('🛒')
          )
        )
    );
    components.push(selectMenu);
  }

  // Add action buttons
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('marketplace_refresh')
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄'),
    new ButtonBuilder()
      .setCustomId('points_check_balance')
      .setLabel('Check Balance')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('💰')
  );
  components.push(buttonRow);

  return {
    embed,
    components
  };
}

export function createItemPurchaseConfirmation(guildId: string, itemIndex: number, userPoints: number) {
  const config = ConfigManager.getGuildConfig(guildId);
  const stockItems = config?.points?.marketplace?.stock || [];
  const item = stockItems[itemIndex];

  if (!item) {
    return null;
  }

  const canAfford = userPoints >= item.price;
  const inStock = item.quantity > 0;

  const embed = new EmbedBuilder()
    .setColor(canAfford && inStock ? '#00ff00' : '#ff0000')
    .setTitle('🛒 Purchase Confirmation')
    .setDescription(`Do you want to purchase this item?`)
    .addFields(
      {
        name: '📦 Item',
        value: item.name,
        inline: true
      },
      {
        name: '📝 Description',
        value: item.description,
        inline: true
      },
      {
        name: '💰 Price',
        value: `${item.price} points`,
        inline: true
      },
      {
        name: '💎 Your Balance',
        value: `${userPoints} points`,
        inline: true
      },
      {
        name: '📊 Stock',
        value: `${item.quantity} available`,
        inline: true
      },
      {
        name: '💸 After Purchase',
        value: `${userPoints - item.price} points`,
        inline: true
      }
    )
    .setFooter({ text: 'Powered by MENI' })
    .setTimestamp();

  const components = [];

  if (canAfford && inStock) {
    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`marketplace_purchase_confirm:${itemIndex}`)
        .setLabel('Confirm Purchase')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId('marketplace_purchase_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );
    components.push(confirmRow);
  } else {
    let reason = '';
    if (!canAfford) reason += '❌ Insufficient points\n';
    if (!inStock) reason += '❌ Item out of stock\n';
    
    embed.addFields({
      name: '⚠️ Cannot Purchase',
      value: reason.trim(),
      inline: false
    });

    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('marketplace_back')
        .setLabel('Back to Marketplace')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️')
    );
    components.push(backRow);
  }

  return {
    embed,
    components
  };
}
