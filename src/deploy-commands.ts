import { REST, Routes } from 'discord.js';
import { commands } from './commands';
import * as dotenv from 'dotenv';
dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('Error: DISCORD_TOKEN or CLIENT_ID is missing in .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    if (guildId && guildId !== 'your_discord_server_id_here' && guildId.trim() !== '') {
      console.log(`Started refreshing application (/) commands for guild: ${guildId}`);
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands },
      );
      console.log('Successfully reloaded application (/) commands for guild.');
    } else {
      console.log('Started refreshing global application (/) commands.');
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands },
      );
      console.log('Successfully reloaded global application (/) commands (may take a few minutes to update).');
    }
  } catch (error) {
    console.error('Failed to deploy commands:', error);
  }
})();
