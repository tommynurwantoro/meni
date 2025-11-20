import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} from 'discord.js';
import { GitLabToken } from '../models/GitLabToken';
import { encrypt, decrypt } from '../utils/encryption';

export const data = new SlashCommandBuilder()
    .setName('gitlab')
    .setDescription('Manage your GitLab personal access token')
    .addSubcommand(subcommand =>
        subcommand
            .setName('token')
            .setDescription('Set your GitLab personal access token (encrypted)')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('remove')
            .setDescription('Remove your stored GitLab token')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('status')
            .setDescription('Check if you have a GitLab token configured')
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'token':
            await handleSetToken(interaction);
            break;
        case 'remove':
            await handleRemoveToken(interaction);
            break;
        case 'status':
            await handleCheckStatus(interaction);
            break;
        default:
            await interaction.reply({ content: 'Unknown subcommand', ephemeral: true });
    }
}

/**
 * Handle /gitlab token command - Show modal to set token
 */
async function handleSetToken(interaction: ChatInputCommandInteraction) {
    try {
        // Create modal for token input
        const modal = new ModalBuilder()
            .setCustomId(`gitlab_token_modal_${interaction.user.id}`)
            .setTitle('Set GitLab Personal Access Token');
        
        // Token input
        const tokenInput = new TextInputBuilder()
            .setCustomId('gitlab_token')
            .setLabel('GitLab Personal Access Token')
            .setPlaceholder('xxxxxxxxxxxxxxxxxxxx')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(20)
            .setMaxLength(100);
        
        // Add input to action row
        const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(tokenInput);
        
        modal.addComponents(actionRow);
        
        // Show the modal
        await interaction.showModal(modal);
    } catch (error: any) {
        console.error('Set GitLab token error:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Failed to Open Token Form')
            .setDescription(error.message || 'An unknown error occurred')
            .setFooter({ text: 'Powered by MENI' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

/**
 * Handle /gitlab remove command
 */
async function handleRemoveToken(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const userId = interaction.user.id;
        
        // Find existing token
        const existingToken = await GitLabToken.findOne({
            where: { discord_id: userId }
        });
        
        if (!existingToken) {
            const noTokenEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('ℹ️ No Token Found')
                .setDescription('You don\'t have a GitLab token stored.')
                .setFooter({ text: 'Powered by MENI' })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [noTokenEmbed] });
            return;
        }
        
        // Delete the token
        await existingToken.destroy();
        
        const successEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Token Removed')
            .setDescription('Your GitLab token has been removed successfully.')
            .setFooter({ text: 'Powered by MENI' })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [successEmbed] });
    } catch (error: any) {
        console.error('Remove GitLab token error:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Failed to Remove Token')
            .setDescription(error.message || 'An unknown error occurred')
            .setFooter({ text: 'Powered by MENI' })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

/**
 * Handle /gitlab status command
 */
async function handleCheckStatus(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const userId = interaction.user.id;
        
        // Find existing token
        const existingToken = await GitLabToken.findOne({
            where: { discord_id: userId }
        });
        
        if (!existingToken) {
            const noTokenEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('ℹ️ No Token Configured')
                .setDescription('You don\'t have a GitLab token stored.\n\nUse `/gitlab token` to set your token and access GitLab features.')
                .addFields(
                    { name: 'Required For', value: '• Creating tags\n• Viewing tags', inline: false }
                )
                .setFooter({ text: 'Powered by MENI' })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [noTokenEmbed] });
            return;
        }
        
        const statusEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Token Configured')
            .setDescription('You have a GitLab token stored securely.')
            .addFields(
                { name: 'Configured On', value: existingToken.created_at.toLocaleString('id-ID'), inline: true },
                { name: 'Last Updated', value: existingToken.updated_at.toLocaleString('id-ID'), inline: true }
            )
            .setFooter({ text: 'Powered by MENI' })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [statusEmbed] });
    } catch (error: any) {
        console.error('Check GitLab token status error:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Failed to Check Status')
            .setDescription(error.message || 'An unknown error occurred')
            .setFooter({ text: 'Powered by MENI' })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

/**
 * Save GitLab token (called from modal handler)
 */
export async function saveGitLabToken(userId: string, token: string): Promise<void> {
    // Encrypt the token
    const encryptedToken = encrypt(token);
    
    // Save or update in database
    const [gitlabToken, created] = await GitLabToken.upsert({
        discord_id: userId,
        encrypted_token: encryptedToken,
    });
    
    console.log(`✅ GitLab token ${created ? 'created' : 'updated'} for user ${userId}`);
}

/**
 * Get GitLab token for a user
 */
export async function getGitLabToken(userId: string): Promise<string | null> {
    try {
        const tokenRecord = await GitLabToken.findOne({
            where: { discord_id: userId }
        });
        
        if (!tokenRecord) {
            return null;
        }
        
        // Decrypt and return the token
        return decrypt(tokenRecord.encrypted_token);
    } catch (error) {
        console.error('Error retrieving GitLab token:', error);
        return null;
    }
}

/**
 * Check if user has a GitLab token configured
 */
export async function hasGitLabToken(userId: string): Promise<boolean> {
    const tokenRecord = await GitLabToken.findOne({
        where: { discord_id: userId }
    });
    
    return tokenRecord !== null;
}

