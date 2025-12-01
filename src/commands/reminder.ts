import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    AutocompleteInteraction,
} from 'discord.js';
import { ConfigManager, Reminder } from '../utils/config';

export const data = new SlashCommandBuilder()
    .setName('reminder')
    .setDescription('Manage reminders for your server')
    .addSubcommand((subcommand) =>
        subcommand
            .setName('set')
            .setDescription('Set a new reminder')
            .addStringOption((option) =>
                option
                    .setName('name')
                    .setDescription('Name of the reminder, must be unique')
                    .setRequired(true)
            )
            .addStringOption((option) =>
                option
                    .setName('time')
                    .setDescription('Time in HH:mm format (Jakarta timezone)')
                    .setRequired(true)
            )
            .addStringOption((option) =>
                option
                    .setName('message')
                    .setDescription('Message to send when reminder triggers, must be less than 2000 characters')
                    .setMaxLength(2000)
                    .setRequired(true)
            )
            .addRoleOption((option) =>
                option
                    .setName('role')
                    .setDescription('Role to mention (optional, defaults to you)')
            )
            .addChannelOption((option) =>
                option
                    .setName('channel')
                    .setDescription('Channel to send reminder (optional, defaults to current channel)')
            )
            .addBooleanOption((option) =>
                option
                    .setName('recurring')
                    .setDescription('Whether the reminder should repeat daily (default: false)')
            )
            .addStringOption((option) =>
                option
                    .setName('days')
                    .setDescription('Days of week to run reminder (e.g., "monday,wednesday,friday" or leave empty for every day)')
                    .setRequired(false)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName('list')
            .setDescription('List all reminders for this server')
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName('delete')
            .setDescription('Delete a reminder by name')
            .addStringOption((option) =>
                option
                    .setName('name')
                    .setDescription('Name of the reminder to delete')
                    .setRequired(true)
                    .setAutocomplete(true)
            )
    );

export const cooldown = 3;

const DAYS_MAP: { [key: string]: number } = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6,
    'sun': 0,
    'mon': 1,
    'tue': 2,
    'wed': 3,
    'thu': 4,
    'fri': 5,
    'sat': 6,
};

function parseDaysOfWeek(daysString: string | null): number[] | undefined {
    if (!daysString || daysString.trim() === '') {
        return undefined; // Run every day
    }

    const days = daysString
        .toLowerCase()
        .split(',')
        .map(d => d.trim())
        .filter(d => d.length > 0);

    const dayNumbers: number[] = [];
    for (const day of days) {
        const dayNum = DAYS_MAP[day];
        if (dayNum !== undefined) {
            if (!dayNumbers.includes(dayNum)) {
                dayNumbers.push(dayNum);
            }
        }
    }

    return dayNumbers.length > 0 ? dayNumbers.sort() : undefined;
}

function formatDaysOfWeek(daysOfWeek?: number[]): string {
    if (!daysOfWeek || daysOfWeek.length === 0) {
        return 'Every day';
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return daysOfWeek.map(d => dayNames[d]).join(', ');
}

function validateTime(time: string): boolean {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
}

export async function autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guildId) {
        return;
    }

    const focusedValue = interaction.options.getFocused();
    const reminders = ConfigManager.getReminders(interaction.guildId);

    const filtered = reminders
        .filter(reminder => reminder.name.toLowerCase().includes(focusedValue.toLowerCase()))
        .slice(0, 25)
        .map(reminder => ({
            name: reminder.name,
            value: reminder.name,
        }));

    await interaction.respond(filtered);
}

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
        await interaction.reply({
            content: '❌ This command can only be used in a server.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
        switch (subcommand) {
            case 'set':
                await handleSet(interaction);
                break;
            case 'list':
                await handleList(interaction);
                break;
            case 'delete':
                await handleDelete(interaction);
                break;
        }
    } catch (error) {
        console.error('Error executing reminder command:', error);
        await interaction.reply({
            content: '❌ An error occurred while executing this command.',
            flags: MessageFlags.Ephemeral,
        });
    }
}

async function handleSet(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString('name', true);
    const time = interaction.options.getString('time', true);
    const message = interaction.options.getString('message', true);
    const role = interaction.options.getRole('role');
    const channel = interaction.options.getChannel('channel');
    const recurring = interaction.options.getBoolean('recurring') ?? false;
    const daysString = interaction.options.getString('days');

    // Validate time format
    if (!validateTime(time)) {
        await interaction.reply({
            content: '❌ Invalid time format. Please use HH:mm format (e.g., 09:00, 17:30).',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Check if reminder name already exists
    const existingReminders = ConfigManager.getReminders(interaction.guildId!);
    if (existingReminders.some(r => r.name === name)) {
        await interaction.reply({
            content: `❌ A reminder with the name "${name}" already exists.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Parse days of week
    const daysOfWeek = parseDaysOfWeek(daysString);

    // Determine role/user to mention
    const roleId = role ? role.id : null;
    const userId = roleId ? null : interaction.user.id;

    // Determine channel
    const channelId = channel ? channel.id : interaction.channelId;

    // Create reminder
    const reminder: Reminder = {
        name,
        time,
        message,
        roleId,
        userId,
        channelId,
        recurring,
        daysOfWeek,
        createdBy: interaction.user.id,
        createdAt: new Date().toISOString(),
    };

    ConfigManager.addReminder(interaction.guildId!, reminder);

    const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Reminder Created')
        .addFields(
            { name: 'Name', value: name, inline: true },
            { name: 'Time', value: `${time} (Jakarta timezone)`, inline: true },
            { name: 'Type', value: recurring ? 'Recurring' : 'One-time', inline: true },
            { name: 'Days', value: formatDaysOfWeek(daysOfWeek), inline: false },
            { name: 'Message', value: message, inline: false },
            {
                name: 'Mention',
                value: roleId ? `<@&${roleId}>` : `<@${userId}>`,
                inline: true,
            },
            {
                name: 'Channel',
                value: channelId ? `<#${channelId}>` : 'Current channel',
                inline: true,
            }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleList(interaction: ChatInputCommandInteraction) {
    const reminders = ConfigManager.getReminders(interaction.guildId!);

    if (reminders.length === 0) {
        await interaction.reply({
            content: '📋 No reminders set for this server.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`📋 Reminders (${reminders.length})`)
        .setTimestamp();

    const fields = reminders.map((reminder) => {
        const mention = reminder.roleId
            ? `<@&${reminder.roleId}>`
            : reminder.userId
            ? `<@${reminder.userId}>`
            : 'None';

        return {
            name: `${reminder.name} ${reminder.recurring ? '🔄' : '⏰'}`,
            value: [
                `**Time:** ${reminder.time} (Jakarta timezone)`,
                `**Days:** ${formatDaysOfWeek(reminder.daysOfWeek)}`,
                `**Type:** ${reminder.recurring ? 'Recurring' : 'One-time'}`,
                `**Message:** ${reminder.message}`,
                `**Mention:** ${mention}`,
                `**Channel:** <#${reminder.channelId}>`,
            ].join('\n'),
            inline: false,
        };
    });

    // Discord embeds have a limit of 25 fields, so we'll paginate if needed
    if (fields.length <= 25) {
        embed.addFields(fields);
        await interaction.reply({ embeds: [embed] });
    } else {
        // Split into multiple embeds if more than 25 reminders
        const chunks = [];
        for (let i = 0; i < fields.length; i += 25) {
            chunks.push(fields.slice(i, i + 25));
        }

        const embeds = chunks.map((chunk, index) => {
            const chunkEmbed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle(`📋 Reminders (${reminders.length}) - Page ${index + 1}/${chunks.length}`)
                .addFields(chunk)
                .setTimestamp();
            return chunkEmbed;
        });

        await interaction.reply({ embeds });
    }
}

async function handleDelete(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString('name', true);

    const deleted = ConfigManager.removeReminder(interaction.guildId!, name);

    if (deleted) {
        await interaction.reply({
            content: `✅ Reminder "${name}" has been deleted.`,
            flags: MessageFlags.Ephemeral,
        });
    } else {
        await interaction.reply({
            content: `❌ Reminder "${name}" not found.`,
            flags: MessageFlags.Ephemeral,
        });
    }
}


