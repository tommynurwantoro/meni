import { Events, Interaction } from 'discord.js';
import { handleCommand } from '../handlers/commandHandler';
import { handleButton } from '../handlers/buttonHandler';
import { handleModal } from '../handlers/modalHandler';
import { handleChannelSelect } from '../handlers/channelSelectHandler';

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
}
