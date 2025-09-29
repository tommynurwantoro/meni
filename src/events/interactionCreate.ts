import { Events, Interaction } from 'discord.js';
import { handleCommand } from '../handlers/commandHandler';
import { handleButton } from '../handlers/buttonHandler';
import { handleModal } from '../handlers/modalHandler';
import { handleChannelSelect } from '../handlers/channelSelectHandler';
import { handleRoleSelect } from '../handlers/roleSelectHandler';
import { handleUserSelect } from '../handlers/userSelectHandler';
import { handleStringSelect } from '../handlers/stringSelectHandler';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: Interaction) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
        await handleCommand(interaction);
    }

    // Handle button interactions
    if (interaction.isButton()) {
        await handleButton(interaction);
    }

    // Handle modal submissions
    if (interaction.isModalSubmit()) {
        await handleModal(interaction);
    }

    // Handle channel select interactions
    if (interaction.isChannelSelectMenu()) {
        await handleChannelSelect(interaction);
    }

    // Handle role select interactions
    if (interaction.isRoleSelectMenu()) {
        await handleRoleSelect(interaction);
    }

    // Handle user select interactions
    if (interaction.isUserSelectMenu()) {
        await handleUserSelect(interaction);
    }

    // Handle string select interactions
    if (interaction.isStringSelectMenu()) {
        await handleStringSelect(interaction);
    }
}
