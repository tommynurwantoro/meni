import { MessageFlags, UserSelectMenuInteraction, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { redisManager } from "../utils/redis";


export async function handleUserSelect(interaction: UserSelectMenuInteraction) {
  const customId = interaction.customId;

  switch (customId) {
    case "thanks_user_select":
      await handleThanksUserSelect(interaction);
      break;
  }
}

async function handleThanksUserSelect(
    interaction: UserSelectMenuInteraction
  ) {
    console.log("Handling thanks user select");
    const guildId = interaction.guildId;
    if (!guildId) return;
  
    const selectedUser = interaction.users.first();
    if (!selectedUser) {
      await interaction.reply({
        content: "❌ No user selected.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  
    // Check if user is trying to thank themselves
    if (selectedUser.id === interaction.user.id) {
      await interaction.reply({
        content: "❌ You cannot thank yourself!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  
    // Store selected user data in Redis
    await redisManager.storeThanksData(interaction.user.id, guildId, {
      selectedUserId: selectedUser.id,
      selectedUserName: selectedUser.displayName,
      timestamp: new Date().toISOString()
    });

    // Show category selection
    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setTitle("🙏 Select Thanks Category")
      .setDescription(`You're giving thanks to **${selectedUser.displayName}**\n\nPlease select a category for this thanks:`)
      .setFooter({ text: "Powered by MENI" })
      .setTimestamp();

    const categorySelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("thanks_category_select")
        .setPlaceholder("Choose a category...")
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel("Run")
            .setDescription("Faster than the speed of light")
            .setValue("RUN")
            .setEmoji("🏃"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Unity")
            .setDescription("Helped the community grow")
            .setValue("UNITY")
            .setEmoji("🤝"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Bravery")
            .setDescription("Showed courage in the face of danger")
            .setValue("BRAVERY")
            .setEmoji("💪"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Integrity")
            .setDescription("Kept your promises and stood by your word")
            .setValue("INTEGRITY")
            .setEmoji("💚"),
          new StringSelectMenuOptionBuilder()
            .setLabel("Customer Oriented")
            .setDescription("Always put the customer first")
            .setValue("CUSTOMER_ORIENTED")
            .setEmoji("👥"),
        )
    );

    await interaction.update({
      embeds: [embed],
      components: [categorySelect],
    });
  }