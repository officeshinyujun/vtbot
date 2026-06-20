import { Client, GatewayIntentBits, Events, REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import {
  commands,
  handleRegister,
  handleInfo,
  handleMapRecommend,
  handleMatchmaker,
  handleDelete,
  handleSearch,
  handleMatchmakerSelect,
  handleUserRegister,
  handleReload,
  handleClearCommands,
  handleImageMatchmaker,
} from './commands';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token) {
  console.error('Error: DISCORD_TOKEN is not defined in the environment variables.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const guildId = process.env.GUILD_ID;

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Handle Interactions (Slash commands & Components)
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // 1. Route Slash Commands
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === '등록') {
        await handleRegister(interaction);
      } else if (commandName === '정보') {
        await handleInfo(interaction);
      } else if (commandName === '팀구성') {
        await handleMatchmaker(interaction);
      } else if (commandName === '맵추천') {
        await handleMapRecommend(interaction);
      } else if (commandName === '삭제') {
        await handleDelete(interaction);
      } else if (commandName === '검색') {
        await handleSearch(interaction);
      } else if (commandName === '사용자등록') {
        await handleUserRegister(interaction);
      } else if (commandName === '리로드') {
        await handleReload(interaction);
      } else if (commandName === '청소') {
        await handleClearCommands(interaction);
      } else if (commandName === '사진팀구성') {
        await handleImageMatchmaker(interaction);
      }
    }

    // 2. Route Dropdown Components
    if (interaction.isUserSelectMenu()) {
      if (interaction.customId === 'matchmaker_select') {
        await handleMatchmakerSelect(interaction);
      }
    }
  } catch (error) {
    console.error(`Error executing interaction:`, error);
    const responseMsg = '명령어 또는 인터랙션을 처리하는 도중 오류가 발생했습니다.';
    
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: responseMsg, ephemeral: true });
      } else {
        await interaction.reply({ content: responseMsg, ephemeral: true });
      }
    }
  }
});

// Handle Legacy Text Commands (Message Create)
client.on(Events.MessageCreate, async (message) => {
  // Ignore messages from other bots
  if (message.author.bot) return;

  if (message.content === '!ping') {
    await message.reply('Pong! (Legacy Command) 🏓');
  }
});

client.login(token);
