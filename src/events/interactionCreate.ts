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
        console.log("Handling command");
        await handleCommand(interaction);
    }

    // Handle button interactions
    if (interaction.isButton()) {
        console.log("Handling button");
        await handleButton(interaction);
    }

    // Handle modal submissions
    if (interaction.isModalSubmit()) {
        console.log("Handling modal");
        await handleModal(interaction);
    }

    // Handle channel select interactions
    if (interaction.isChannelSelectMenu()) {
        console.log("Handling channel select");
        await handleChannelSelect(interaction);
    }

    // Handle role select interactions
    if (interaction.isRoleSelectMenu()) {
        console.log("Handling role select");
        await handleRoleSelect(interaction);
    }

    // Handle user select interactions
    if (interaction.isUserSelectMenu()) {
        console.log("Handling user select");
        await handleUserSelect(interaction);
    }

    // Handle string select interactions
    if (interaction.isStringSelectMenu()) {
        console.log("Handling string select");
        await handleStringSelect(interaction);
    }
}
