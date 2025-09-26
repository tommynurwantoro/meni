import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "dotenv";
import { readdirSync } from "fs";
import { join } from "path";

// Load environment variables
config();

// Validate environment variables
if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN is not set in .env file");
  process.exit(1);
}

if (!process.env.DISCORD_CLIENT_ID) {
  console.error("❌ DISCORD_CLIENT_ID is not set in .env file");
  process.exit(1);
}

const commands: SlashCommandBuilder[] = [];
const commandsPath = join(__dirname, "commands");

async function loadCommands() {
  try {
    const commandFiles = readdirSync(commandsPath).filter(
      (file) => file.endsWith(".js") || file.endsWith(".ts")
    );

    for (const file of commandFiles) {
      const filePath = join(commandsPath, file);
      const command = await import(filePath);

      if ("data" in command) {
        commands.push(command.data.toJSON());
        console.log(`✅ Added command: ${command.data.name}`);
      }
    }
  } catch (error) {
    console.log("📁 Commands directory not found");
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);

// Deploy commands
(async () => {
  await loadCommands();

  try {
    console.log(
      `🚀 Started refreshing ${commands.length} application (/) commands.`
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
      { body: commands }
    );

    console.log(
      `✅ Successfully reloaded ${
        (data as any).length
      } application (/) commands.`
    );
  } catch (error) {
    console.error("❌ Error deploying commands:", error);
  }
})();
