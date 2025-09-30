import { Client } from "discord.js";
import { ConfigManager } from "./config";
import { createMarketplaceUserPanel } from "../views/marketplace/marketplaceUserPanel";
import { getUserBalance, removePoints, logPointsTransaction } from "./pointsUtils";

export async function sendMarketplaceUserPanel(
  client: Client,
  guildId: string
) {
  const config = ConfigManager.getGuildConfig(guildId);
  const marketplaceChannel = config?.points?.marketplace?.channel;
  if (!marketplaceChannel) return;

  const channel = client.channels.cache.get(marketplaceChannel);
  if (!channel || !channel.isTextBased()) return;

  const panel = await createMarketplaceUserPanel(guildId);
  if (!panel) return;

  if ("send" in channel) {
    await channel.send({
      embeds: [panel.embed],
      components: panel.components as any[],
    });
  }
}

export interface PurchaseResult {
  success: boolean;
  message: string;
  itemName?: string;
  price?: number;
  newBalance?: number;
}

/**
 * Validate and process a marketplace purchase
 */
export async function processPurchase(
  userId: string,
  guildId: string,
  itemIndex: number,
  client: Client
): Promise<PurchaseResult> {
  try {
    // Get current config and item
    const config = ConfigManager.getGuildConfig(guildId);
    const stockItems = config?.points?.marketplace?.stock || [];
    const item = stockItems[itemIndex];

    // Validation: Item exists
    if (!item) {
      return {
        success: false,
        message: "❌ Item not found. Please try again.",
      };
    }

    // Validation: Item in stock
    if (item.quantity <= 0) {
      return {
        success: false,
        message: `❌ **${item.name}** is out of stock.`,
      };
    }

    // Get user balance
    const userBalance = await getUserBalance(userId, guildId);
    if (!userBalance) {
      return {
        success: false,
        message: "❌ Unable to retrieve your balance. Please try again.",
      };
    }

    // Validation: Sufficient funds
    if (userBalance.points < item.price) {
      return {
        success: false,
        message: `❌ Insufficient points. You need ${item.price} points but only have ${userBalance.points}.`,
      };
    }

    // Process the purchase - remove points
    await removePoints(
      userId,
      guildId,
      item.price,
      "marketplace_purchase",
      `Purchased ${item.name}`,
      `Purchased ${item.name} from marketplace`
    );

    // Update stock quantity
    const updatedStock = [...stockItems];
    updatedStock[itemIndex] = {
      ...item,
      quantity: item.quantity - 1,
    };

    // Update config
    ConfigManager.updateGuildConfig(guildId, {
      ...config,
      points: {
        ...config?.points,
        marketplace: {
          ...config?.points?.marketplace,
          stock: updatedStock,
        },
      },
    });

    // Log the transaction
    await logPointsTransaction(
      client,
      guildId,
      {
        from_user_id: userId,
        to_user_id: userId,
        guild_id: guildId,
        points: item.price,
        transaction_type: "marketplace_purchase",
        category: "marketplace",
        reason: `Purchased ${item.name}`,
        metadata: {},
      } as any
    );

    // Get new balance
    const newBalance = await getUserBalance(userId, guildId);

    return {
      success: true,
      message: `✅ Successfully purchased **${item.name}** for ${item.price} points!`,
      itemName: item.name,
      price: item.price,
      newBalance: newBalance?.points || 0,
    };
  } catch (error) {
    console.error("Error processing marketplace purchase:", error);
    return {
      success: false,
      message: "❌ Failed to process purchase. Please try again later.",
    };
  }
}
