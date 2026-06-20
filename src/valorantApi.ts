import * as dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.HENRIK_API_KEY;

if (!API_KEY) {
  console.warn('Warning: HENRIK_API_KEY is not defined in environment variables.');
}

interface MmrResponse {
  status: number;
  data?: {
    account?: {
      name: string;
      tag: string;
      puuid: string;
    };
    peak?: {
      season?: any;
      ranking_schema?: string;
      tier?: {
        id: number;
        name: string;
      };
      rr?: number;
    };
    current?: {
      tier?: {
        id: number;
        name: string;
      };
      rr?: number;
      last_change?: number;
      elo?: number;
    };
  };
  errors?: Array<{ message: string }>;
}

interface MmrHistoryItem {
  mmr_change_to_last_game: number;
}

interface MmrHistoryResponse {
  status: number;
  data?: MmrHistoryItem[];
}

export interface ValorantStats {
  riotName: string;
  riotTag: string;
  tier: string;
  peakTier: string;
  rating: number;
  elo: number;
  rr: number;
  lastChange: number;
  winCount: number;
  lossCount: number;
}

async function requestApi<T>(url: string): Promise<T> {
  let finalUrl = url;
  if (API_KEY) {
    const separator = finalUrl.includes('?') ? '&' : '?';
    finalUrl = `${finalUrl}${separator}api_key=${API_KEY}`;
  }

  const response = await fetch(finalUrl);
  if (!response.ok) {
    let errorDetail = '';
    let errorMessage = '';
    try {
      const errorJson: any = await response.json();
      errorDetail = JSON.stringify(errorJson);
      if (errorJson && Array.isArray(errorJson.errors) && errorJson.errors.length > 0) {
        errorMessage = errorJson.errors.map((e: any) => e.message).join(', ');
      } else if (errorJson && errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      try {
        errorDetail = await response.text();
      } catch {
        errorDetail = 'No body detail';
      }
    }
    // Mask the API key in the logged URL to keep logs secure
    const maskedUrl = finalUrl.replace(/api_key=([^&]+)/, 'api_key=HIDDEN');
    console.error(`[API Error] URL: ${maskedUrl} | Status: ${response.status} | Details: ${errorDetail}`);

    let userFriendlyMsg = '';
    if (response.status === 400) {
      userFriendlyMsg = '요청이 잘못되었습니다. 이름과 태그 형식을 확인해 주세요.';
    } else if (response.status === 403) {
      userFriendlyMsg = 'API 인증에 실패했습니다. (서버 API 키 설정을 확인해 주세요)';
    } else if (response.status === 404) {
      userFriendlyMsg = '해당 사용자를 찾을 수 없거나 전적 데이터가 존재하지 않습니다.';
    } else if (response.status === 429) {
      userFriendlyMsg = '요청 횟수 제한을 초과했습니다. 잠시 후 다시 시도해 주세요.';
    } else if (response.status >= 500) {
      userFriendlyMsg = '발로란트 API 서버 또는 라이엇 서버에 장애가 발생했습니다.';
    } else {
      userFriendlyMsg = errorMessage || `API 오류가 발생했습니다. (상태코드: ${response.status})`;
    }

    throw new Error(userFriendlyMsg);
  }
  return response.json() as Promise<T>;
}

export async function getValorantStats(riotName: string, riotTag: string): Promise<ValorantStats> {
  const regions = ['kr', 'ap', 'na', 'eu']; // Support Korea, Asia-Pacific, North America, and Europe
  let mmrData: any = null;
  let activeRegion = 'kr';
  let errorMsg = '';

  // 1. Get MMR details (Auto-fallback regions)
  for (const region of regions) {
    try {
      const url = `https://api.henrikdev.xyz/valorant/v3/mmr/${region}/pc/${encodeURIComponent(riotName)}/${encodeURIComponent(riotTag)}`;
      console.log(`[API Call] Fetching MMR from HenrikDev API (${region}): ${url}`);
      const res = await requestApi<MmrResponse>(url);
      
      if (res.status === 200 && res.data?.current) {
        mmrData = res.data;
        activeRegion = region;
        break;
      } else if (res.errors && res.errors.length > 0) {
        errorMsg = res.errors[0].message;
        console.warn(`[API Info] HenrikDev returned warning for ${region}: ${errorMsg}`);
      }
    } catch (e: any) {
      errorMsg = e.message;
      // Handle the case where the user has no Ranked MMR data (Unrated)
      if (errorMsg.includes('404') && (errorMsg.includes('No MMR data') || errorMsg.includes('No MMR'))) {
        console.log(`[API Info] User ${riotName}#${riotTag} is Unrated (No MMR data available).`);
        mmrData = {
          account: { name: riotName, tag: riotTag },
          current: { elo: 0, rr: 0, last_change: 0, tier: { name: 'Unrated' } },
          peak: { tier: { name: 'Unrated' } }
        };
        break;
      }
      console.error(`[API Exception] Error checking ${region} region:`, e.message);
    }
  }

  if (!mmrData) {
    throw new Error(`발로란트 계정 정보를 찾을 수 없거나 API 호출에 실패했습니다. (사유: ${errorMsg || '알 수 없는 오류'})`);
  }

  const currentInfo = mmrData.current || {};
  const peakInfo = mmrData.peak || {};
  const accountInfo = mmrData.account || {};

  const baseElo = currentInfo.elo || 0;
  const tierName = currentInfo.tier?.name || 'Unrated';
  const peakTierName = peakInfo.tier?.name || 'Unrated';
  const currentRr = currentInfo.rr || 0;
  const lastChange = currentInfo.last_change || 0;
  const officialName = accountInfo.name || riotName;
  const officialTag = accountInfo.tag || riotTag;

  // 2. Fetch Match History to calculate recent win/loss
  let winCount = 0;
  let lossCount = 0;

  try {
    const historyUrl = `https://api.henrikdev.xyz/valorant/v1/mmr-history/${activeRegion}/${encodeURIComponent(officialName)}/${encodeURIComponent(officialTag)}`;
    console.log(`[API Call] Fetching MMR History from HenrikDev API (${activeRegion}): ${historyUrl}`);
    const historyRes = await requestApi<MmrHistoryResponse>(historyUrl);

    if (historyRes.status === 200 && Array.isArray(historyRes.data)) {
      // Analyze the last 5 matches
      const recentMatches = historyRes.data.slice(0, 5);
      recentMatches.forEach((match) => {
        if (match.mmr_change_to_last_game > 0) {
          winCount++;
        } else if (match.mmr_change_to_last_game < 0) {
          lossCount++;
        }
      });
    }
  } catch (e: any) {
    console.error(`[API Error] 최근 전적(MMR History) 로딩 중 예외 발생: ${e.message}`, e);
  }

  // 3. Apply Performance Weighting Formula
  const totalPlayed = winCount + lossCount;
  let performanceBonus = 0;
  if (totalPlayed > 0) {
    const winRate = winCount / totalPlayed;
    performanceBonus = Math.round((winRate - 0.5) * 100);
  }

  const finalRating = baseElo + performanceBonus;

  return {
    riotName: officialName,
    riotTag: officialTag,
    tier: tierName,
    peakTier: peakTierName,
    rating: finalRating,
    elo: baseElo,
    rr: currentRr,
    lastChange,
    winCount,
    lossCount,
  };
}
