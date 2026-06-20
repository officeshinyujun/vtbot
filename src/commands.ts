import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, User, PermissionFlagsBits, ActionRowBuilder, UserSelectMenuBuilder, REST, Routes } from 'discord.js';
import { getValorantStats } from './valorantApi';
import { saveUser, getUser, UserProfile, deleteUser } from './database';

// 1. Definition of commands
export const commands = [
  // /등록 [이름] [태그]
  new SlashCommandBuilder()
    .setName('등록')
    .setDescription('본인의 발로란트 ID를 연동하여 레이팅을 등록합니다.')
    .addStringOption(option =>
      option.setName('이름')
        .setDescription('Riot ID의 이름 부분 (예: 닉네임)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('태그')
        .setDescription('Riot ID의 태그 부분 (# 제외, 예: KR1)')
        .setRequired(true)
    ),

  // /정보 [유저]
  new SlashCommandBuilder()
    .setName('정보')
    .setDescription('등록된 유저의 발로란트 티어 및 레이팅 정보를 조회합니다.')
    .addUserOption(option =>
      option.setName('유저')
        .setDescription('조회할 디스코드 유저 (지정하지 않으면 본인 조회)')
        .setRequired(false)
    ),

  // /맵추천 [개수]
  new SlashCommandBuilder()
    .setName('맵추천')
    .setDescription('현재 발로란트 맵 풀에서 랜덤으로 맵을 추첨합니다.')
    .addIntegerOption(option =>
      option.setName('개수')
        .setDescription('추첨할 맵의 개수 (1 ~ 11개)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(11)
    ),

  // /팀구성
  new SlashCommandBuilder()
    .setName('팀구성')
    .setDescription('드롭다운 메뉴를 통해 내전에 참가할 유저들을 선택하고 밸런스 팀을 구성합니다.'),

  // /삭제 [유저]
  new SlashCommandBuilder()
    .setName('삭제')
    .setDescription('등록된 발로란트 프로필 정보를 삭제합니다.')
    .addUserOption(option =>
      option.setName('유저')
        .setDescription('삭제할 유저 (지정하지 않으면 본인 프로필 삭제)')
        .setRequired(false)
    ),

  // /검색 [이름] [태그]
  new SlashCommandBuilder()
    .setName('검색')
    .setDescription('라이엇 ID를 입력하여 발로란트 전적을 실시간으로 검색합니다.')
    .addStringOption(option =>
      option.setName('이름')
        .setDescription('Riot ID의 이름 부분 (예: 닉네임)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('태그')
        .setDescription('Riot ID의 태그 부분 (# 제외, 예: KR1)')
        .setRequired(true)
    ),

  // /사용자등록 [유저] [이름] [태그] (관리자 전용)
  new SlashCommandBuilder()
    .setName('사용자등록')
    .setDescription('[관리자 전용] 특정 유저의 디스코드 계정과 발로란트 ID를 연동합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName('유저')
        .setDescription('연동할 디스코드 유저')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('이름')
        .setDescription('Riot ID의 이름 부분 (예: 닉네임)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('태그')
        .setDescription('Riot ID의 태그 부분 (# 제외, 예: KR1)')
        .setRequired(true)
    ),

  // /리로드 (관리자 전용)
  new SlashCommandBuilder()
    .setName('리로드')
    .setDescription('[관리자 전용] 디스코드 API 서버에 슬래시 명령어를 강제로 다시 등록합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(command => command.toJSON());

// 2. Command Handlers
export async function handleRegister(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString('이름', true).trim();
  const tag = interaction.options.getString('태그', true).trim().replace('#', '');
  
  await interaction.deferReply();

  try {
    const stats = await getValorantStats(name, tag);
    
    const profile: UserProfile = {
      discordId: interaction.user.id,
      discordTag: interaction.user.tag,
      riotName: stats.riotName,
      riotTag: stats.riotTag,
      tier: stats.tier,
      peakTier: stats.peakTier,
      rating: stats.rating,
      lastUpdated: new Date().toISOString(),
    };

    saveUser(profile);

    const lastChangeText = stats.lastChange >= 0 ? `+${stats.lastChange}` : `${stats.lastChange}`;

    const embed = new EmbedBuilder()
      .setColor(0x00FF99) // Neon Green
      .setTitle('🎯 발로란트 프로필 등록 완료')
      .setDescription(`<@${interaction.user.id}>님이 성공적으로 등록되었습니다.`)
      .addFields(
        { name: 'Riot ID', value: `\`${stats.riotName}#${stats.riotTag}\``, inline: true },
        { name: '현재 티어', value: `\`${stats.tier} (${stats.rr} RR)\``, inline: true },
        { name: '최고 티어', value: `\`${stats.peakTier}\``, inline: true },
        { name: '최근 경기 변동', value: `\`${lastChangeText}점\``, inline: true },
        { name: '최근 5경기 전적', value: `\`${stats.winCount}승 ${stats.lossCount}패\``, inline: true },
        { name: '최종 매칭 레이팅', value: `\`${stats.rating}점\` (최근 승률 반영)`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    const embed = new EmbedBuilder()
      .setColor(0xFF3366) // Neon Pink (Error)
      .setTitle('❌ 등록 실패')
      .setDescription(error.message || '알 수 없는 오류가 발생했습니다.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

export async function handleInfo(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser('유저') || interaction.user;
  const profile = getUser(targetUser.id);

  if (!profile) {
    const embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setTitle('🔍 정보 조회 실패')
      .setDescription(`<@${targetUser.id}>님은 아직 등록되지 않았습니다.\n\`/등록\` 명령어를 통해 먼저 연동해 주세요.`);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // Update stats in real-time when checking info to ensure accuracy
  await interaction.deferReply();
  try {
    const stats = await getValorantStats(profile.riotName, profile.riotTag);
    
    const updatedProfile: UserProfile = {
      ...profile,
      tier: stats.tier,
      peakTier: stats.peakTier,
      rating: stats.rating,
      lastUpdated: new Date().toISOString(),
    };
    saveUser(updatedProfile);

    const lastChangeText = stats.lastChange >= 0 ? `+${stats.lastChange}` : `${stats.lastChange}`;

    const embed = new EmbedBuilder()
      .setColor(0x33CCFF) // Neon Blue
      .setTitle(`👤 ${targetUser.username}님의 발로란트 정보`)
      .addFields(
        { name: 'Riot ID', value: `\`${stats.riotName}#${stats.riotTag}\``, inline: true },
        { name: '현재 티어', value: `\`${stats.tier} (${stats.rr} RR)\``, inline: true },
        { name: '최고 티어', value: `\`${stats.peakTier}\``, inline: true },
        { name: '최근 경기 변동', value: `\`${lastChangeText}점\``, inline: true },
        { name: '최근 전적', value: `\`${stats.winCount}승 ${stats.lossCount}패\``, inline: true },
        { name: '최종 매칭 레이팅', value: `\`${stats.rating}점\``, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    // If API lookup fails, display cached data
    const embed = new EmbedBuilder()
      .setColor(0x33CCFF)
      .setTitle(`👤 ${targetUser.username}님의 발로란트 정보 (캐시됨)`)
      .setDescription('실시간 API 조회에 실패하여 마지막으로 저장된 데이터를 불러왔습니다.')
      .addFields(
        { name: 'Riot ID', value: `\`${profile.riotName}#${profile.riotTag}\``, inline: true },
        { name: '현재 티어', value: `\`${profile.tier}\``, inline: true },
        { name: '최고 티어', value: `\`${profile.peakTier || 'Unrated'}\``, inline: true },
        { name: '매칭 레이팅', value: `\`${profile.rating}점\``, inline: true },
        { name: '마지막 갱신', value: `<t:${Math.floor(Date.parse(profile.lastUpdated) / 1000)}:R>`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

export async function handleMapRecommend(interaction: ChatInputCommandInteraction) {
  const count = interaction.options.getInteger('개수', true);
  
  const mapPool = [
    { en: 'Ascent', ko: '어센트' },
    { en: 'Bind', ko: '바인드' },
    { en: 'Breeze', ko: '브리즈' },
    { en: 'Icebox', ko: '아이스박스' },
    { en: 'Split', ko: '스플릿' },
    { en: 'Haven', ko: '헤이븐' },
    { en: 'Fracture', ko: '프랙처' },
    { en: 'Pearl', ko: '펄' },
    { en: 'Lotus', ko: '로터스' },
    { en: 'Sunset', ko: '선셋' },
    { en: 'Abyss', ko: '어비스' },
  ];

  // Shuffle map pool (Fisher-Yates)
  for (let i = mapPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mapPool[i], mapPool[j]] = [mapPool[j], mapPool[i]];
  }

  const selectedMaps = mapPool.slice(0, count);

  const embed = new EmbedBuilder()
    .setColor(0xFFAA00) // Orange
    .setTitle(`🗺️ 추천 맵 선택 완료 (총 ${count}개)`)
    .setDescription(
      selectedMaps.map((map, index) => `${index + 1}. **${map.ko}** (${map.en})`).join('\n')
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

export async function handleMatchmaker(interaction: ChatInputCommandInteraction) {
  const selectMenu = new UserSelectMenuBuilder()
    .setCustomId('matchmaker_select')
    .setPlaceholder('내전에 참여할 유저들을 선택하세요 (최대 10명)')
    .setMinValues(2)
    .setMaxValues(10);

  const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(selectMenu);

  const embed = new EmbedBuilder()
    .setColor(0xAA00FF) // Neon Purple
    .setTitle('⚔️ 내전 밸런스 매치메이커')
    .setDescription('아래의 드롭다운 메뉴를 클릭하여 내전에 참가할 유저들을 선택해 주세요.\n\n* **최소 2명 ~ 최대 10명** 선택 가능\n* 팀을 공평하게 나누기 위해 **짝수 인원**(예: 4명, 6명, 8명, 10명)을 골라주세요.');

  await interaction.reply({ embeds: [embed], components: [row] });
}

export async function handleMatchmakerSelect(interaction: any) {
  const userIds = interaction.values; // Selected User IDs
  const profiles: UserProfile[] = [];
  const unregistered: string[] = [];

  // 1. Verify all selected users are registered in db
  for (const id of userIds) {
    const profile = getUser(id);
    if (profile) {
      profiles.push(profile);
    } else {
      unregistered.push(id);
    }
  }

  if (unregistered.length > 0) {
    const embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setTitle('❌ 매칭 구성 불가능')
      .setDescription(
        `선택된 유저 중 등록되지 않은 플레이어가 있습니다.\n먼저 \`/등록\` 명령어를 통해 발로란트 아이디를 연결해 주세요.\n\n**미등록 유저:**\n${unregistered.map(id => `- <@${id}>`).join('\n')}`
      );
    // Keep components active so they can re-select
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // 2. Prevent odd team configurations
  const count = profiles.length;
  if (count % 2 !== 0) {
    const embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setTitle('❌ 인원 수 오류')
      .setDescription(`선택한 인원은 총 **${count}명**입니다.\n팀을 공평하게 나누기 위해 **짝수 인원(예: 4명, 6명, 8명, 10명)**을 선택해 주세요.`);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // 3. Balanced Matchmaking (Brute Force Combinatorics for selected team size)
  let minDiff = Infinity;
  let bestTeamA: UserProfile[] = [];
  let bestTeamB: UserProfile[] = [];
  const half = count / 2;

  const combine = (start: number, combo: UserProfile[]) => {
    if (combo.length === half) {
      const teamA = combo;
      const teamB = profiles.filter(p => !teamA.includes(p));
      
      const sumA = teamA.reduce((acc, p) => acc + p.rating, 0);
      const sumB = teamB.reduce((acc, p) => acc + p.rating, 0);
      
      const diff = Math.abs(sumA - sumB);
      if (diff < minDiff) {
        minDiff = diff;
        bestTeamA = [...teamA];
        bestTeamB = [...teamB];
      }
      return;
    }
    
    for (let i = start; i < count; i++) {
      combo.push(profiles[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  };

  combine(0, []);

  const totalRatingA = bestTeamA.reduce((acc, p) => acc + p.rating, 0);
  const totalRatingB = bestTeamB.reduce((acc, p) => acc + p.rating, 0);
  const avgRatingA = Math.round(totalRatingA / half);
  const avgRatingB = Math.round(totalRatingB / half);

  const getTeamListText = (team: UserProfile[]) => {
    return team
      .map(p => `- <@${p.discordId}> (티어: \`${p.tier}\` | 레이팅: \`${p.rating}점\`)`)
      .join('\n');
  };

  const embed = new EmbedBuilder()
    .setColor(0xAA00FF) // Neon Purple
    .setTitle(`⚔️ ${half}대${half} 균형 팀 매칭 완료`)
    .setDescription(`양 팀 레이팅 점수 차이: **${minDiff}점**`)
    .addFields(
      {
        name: `🔵 Team A (평균 레이팅: ${avgRatingA}점)`,
        value: getTeamListText(bestTeamA),
        inline: false
      },
      {
        name: `🔴 Team B (평균 레이팅: ${avgRatingB}점)`,
        value: getTeamListText(bestTeamB),
        inline: false
      }
    )
    .setFooter({ text: 'Riot API ELO 및 최근 경쟁전 5경기 전적이 반영된 균형 매치메이킹입니다.' })
    .setTimestamp();

  // Update original message and remove the dropdown (components: [])
  await interaction.update({ embeds: [embed], components: [] });
}

export async function handleDelete(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser('유저') || interaction.user;
  const isSelf = targetUser.id === interaction.user.id;
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

  if (!isSelf && !isAdmin) {
    const embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setTitle('❌ 권한 부족')
      .setDescription('타인의 등록 정보는 서버 관리자만 삭제할 수 있습니다.');
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  const success = deleteUser(targetUser.id);

  if (success) {
    const embed = new EmbedBuilder()
      .setColor(0x00FF99)
      .setTitle('🗑️ 프로필 삭제 완료')
      .setDescription(`<@${targetUser.id}>님의 발로란트 등록 정보가 성공적으로 삭제되었습니다.`);
    await interaction.reply({ embeds: [embed] });
  } else {
    const embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setTitle('❌ 삭제 실패')
      .setDescription(`<@${targetUser.id}>님은 등록되어 있지 않은 유저입니다.`);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

export async function handleSearch(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString('이름', true).trim();
  const tag = interaction.options.getString('태그', true).trim().replace('#', '');

  await interaction.deferReply();

  try {
    const stats = await getValorantStats(name, tag);
    const lastChangeText = stats.lastChange >= 0 ? `+${stats.lastChange}` : `${stats.lastChange}`;

    const embed = new EmbedBuilder()
      .setColor(0xFFFF00) // Neon Yellow
      .setTitle(`🔎 발로란트 전적 검색 결과 (\`${stats.riotName}#${stats.riotTag}\`)`)
      .addFields(
        { name: '현재 티어', value: `\`${stats.tier} (${stats.rr} RR)\``, inline: true },
        { name: '최고 티어', value: `\`${stats.peakTier}\``, inline: true },
        { name: '최근 경기 변동', value: `\`${lastChangeText}점\``, inline: true },
        { name: '최근 5경기 전적', value: `\`${stats.winCount}승 ${stats.lossCount}패\``, inline: true },
        { name: '최종 매칭 레이팅', value: `\`${stats.rating}점\` (최근 승률 반영)`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    const embed = new EmbedBuilder()
      .setColor(0xFF3366) // Neon Pink
      .setTitle('❌ 검색 실패')
      .setDescription(error.message || '정보를 조회하는 도중 오류가 발생했습니다.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

export async function handleUserRegister(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser('유저', true);
  const name = interaction.options.getString('이름', true).trim();
  const tag = interaction.options.getString('태그', true).trim().replace('#', '');
  
  await interaction.deferReply();

  try {
    const stats = await getValorantStats(name, tag);
    
    const profile: UserProfile = {
      discordId: targetUser.id,
      discordTag: targetUser.tag,
      riotName: stats.riotName,
      riotTag: stats.riotTag,
      tier: stats.tier,
      peakTier: stats.peakTier,
      rating: stats.rating,
      lastUpdated: new Date().toISOString(),
    };

    saveUser(profile);

    const lastChangeText = stats.lastChange >= 0 ? `+${stats.lastChange}` : `${stats.lastChange}`;

    const embed = new EmbedBuilder()
      .setColor(0x00FF99) // Neon Green
      .setTitle('🎯 [관리자] 발로란트 프로필 연동 완료')
      .setDescription(`<@${targetUser.id}>님의 발로란트 프로필이 수동으로 연동되었습니다.`)
      .addFields(
        { name: '대상 유저', value: `<@${targetUser.id}>`, inline: true },
        { name: 'Riot ID', value: `\`${stats.riotName}#${stats.riotTag}\``, inline: true },
        { name: '현재 티어', value: `\`${stats.tier} (${stats.rr} RR)\``, inline: true },
        { name: '최고 티어', value: `\`${stats.peakTier}\``, inline: true },
        { name: '최근 경기 변동', value: `\`${lastChangeText}점\``, inline: true },
        { name: '최근 5경기 전적', value: `\`${stats.winCount}승 ${stats.lossCount}패\``, inline: true },
        { name: '최종 매칭 레이팅', value: `\`${stats.rating}점\` (최근 승률 반영)`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    const embed = new EmbedBuilder()
      .setColor(0xFF3366) // Neon Pink
      .setTitle('❌ 수동 등록 실패')
      .setDescription(error.message || '알 수 없는 오류가 발생했습니다.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

export async function handleReload(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    const embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setTitle('❌ 권한 부족')
      .setDescription('이 명령어는 서버 관리자만 사용할 수 있습니다.');
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId) {
    return interaction.reply({ content: '❌ 환경 변수(DISCORD_TOKEN 또는 CLIENT_ID)가 설정되지 않았습니다.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const rest = new REST({ version: '10' }).setToken(token);

    if (guildId && guildId !== 'your_discord_server_id_here' && guildId.trim() !== '') {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands },
      );
      const embed = new EmbedBuilder()
        .setColor(0x00FF99)
        .setTitle('🔄 명령어 리로드 완료')
        .setDescription(`현재 서버(Guild ID: \`${guildId}\`)에 명령어가 즉시 업데이트되었습니다.`);
      await interaction.editReply({ embeds: [embed] });
    } else {
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands },
      );
      const embed = new EmbedBuilder()
        .setColor(0x00FF99)
        .setTitle('🔄 글로벌 명령어 리로드 요청 완료')
        .setDescription('모든 서버 대상 글로벌 명령어 갱신 요청을 보냈습니다.\n(디스코드 서버 캐시 갱신에 따라 적용까지 최대 수 분~1시간 정도 걸릴 수 있습니다.)');
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error: any) {
    const embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setTitle('❌ 리로드 실패')
      .setDescription(error.message || '명령어 재등록 중 오류가 발생했습니다.');
    await interaction.editReply({ embeds: [embed] });
  }
}


