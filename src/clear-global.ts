import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  console.error('Error: DISCORD_TOKEN or CLIENT_ID is missing in .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Started clearing global application (/) commands...');
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log('Successfully cleared all global application commands!');
    console.log('Note: It may take up to a few minutes for Discord to update the cache in your client.');
  } catch (error) {
    console.error('Failed to clear global commands:', error);
  }
})();
