import { NextResponse } from 'next/server';
import { Tournament } from '../../../types/football';
import { GLOBAL_LEAGUES, LeagueCatalogEntry } from '../../../lib/leagues';

interface EspnLeagueMetaResponse {
  leagues?: Array<{
    name?: string;
    abbreviation?: string;
    season?: { displayName?: string };
    logos?: Array<{ href?: string }>;
  }>;
  events?: Array<{
    date?: string;
    competitions?: Array<{
      status?: { type?: { state?: string; shortDetail?: string } };
      competitors?: Array<{
        team?: { id?: string; displayName?: string };
      }>;
    }>;
  }>;
}

interface EspnStandingsGroup {
  name?: string;
  standings?: {
    entries?: Array<{
      team?: { id?: string; displayName?: string };
      stats?: Array<{ name?: string; displayValue?: string }>;
    }>;
  };
}

interface EspnStandingsResponse {
  name?: string;
  children?: EspnStandingsGroup[];
  standings?: {
    entries?: Array<{
      team?: { id?: string; displayName?: string };
      stats?: Array<{ name?: string; displayValue?: string }>;
    }>;
  };
}

interface LiveLeagueSnapshot {
  name?: string;
  abbreviation?: string;
  season?: string;
  logoUrl?: string;
  activeCount: number;
  liveCount: number;
  upcomingCount: number;
  teamsCount: number;
  groupsCount: number;
  leader?: string;
  leaderPoints?: number;
  nextFixtureText?: string;
}

async function fetchLeagueSnapshot(entry: LeagueCatalogEntry): Promise<LiveLeagueSnapshot> {
  const [sbRes, stRes] = await Promise.all([
    fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${entry.espnSlug}/scoreboard`, {
      next: { revalidate: 90 },
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 FOOTYLive/3.0' },
    }).catch(() => null),
    fetch(`https://site.api.espn.com/apis/v2/sports/soccer/${entry.espnSlug}/standings`, {
      next: { revalidate: 180 },
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 FOOTYLive/3.0' },
    }).catch(() => null),
  ]);

  let name: string | undefined;
  let abbreviation: string | undefined;
  let season: string | undefined;
  let logoUrl: string | undefined;
  let activeCount = 0;
  let liveCount = 0;
  let upcomingCount = 0;
  let nextFixtureText: string | undefined;
  const scoreboardTeamIds = new Set<string>();

  if (sbRes && sbRes.ok) {
    const sbJson = (await sbRes.json()) as EspnLeagueMetaResponse;
    const meta = sbJson.leagues?.[0];
    name = meta?.name;
    abbreviation = meta?.abbreviation;
    season = meta?.season?.displayName;
    logoUrl = meta?.logos?.[0]?.href;

    const events = sbJson.events || [];
    activeCount = events.length;
    liveCount = events.filter((e) => e.competitions?.[0]?.status?.type?.state === 'in').length;
    upcomingCount = events.filter((e) => e.competitions?.[0]?.status?.type?.state === 'pre').length;

    const firstUpcoming = events.find((e) => e.competitions?.[0]?.status?.type?.state === 'pre');
    if (firstUpcoming) {
      const comps = firstUpcoming.competitions?.[0]?.competitors || [];
      const h = comps[0]?.team?.displayName;
      const a = comps[1]?.team?.displayName;
      if (h && a) {
        nextFixtureText = `${h} vs ${a}`;
      }
    }

    for (const ev of events) {
      for (const comp of ev.competitions?.[0]?.competitors || []) {
        if (comp.team?.id) scoreboardTeamIds.add(comp.team.id);
      }
    }
  }

  let teamsCount = scoreboardTeamIds.size;
  let groupsCount = 0;
  let leader: string | undefined;
  let leaderPoints: number | undefined;

  if (stRes && stRes.ok) {
    const stJson = (await stRes.json()) as EspnStandingsResponse;
    const groups = stJson.children && stJson.children.length > 0 ? stJson.children : [];
    groupsCount = groups.length;

    const standingsEntries =
      groups.length > 0
        ? groups.flatMap((g) => g.standings?.entries || [])
        : stJson.standings?.entries || [];

    const uniqueTeamNames = new Set<string>();
    for (const item of standingsEntries) {
      const tName = item.team?.id || item.team?.displayName;
      if (tName) uniqueTeamNames.add(tName);
    }
    if (uniqueTeamNames.size > 0) {
      teamsCount = uniqueTeamNames.size;
    }

    // Determine best leader across standings entries (preferring highest points when multiple groups exist)
    let bestPts = -1;
    for (const item of standingsEntries) {
      const tName = item.team?.displayName;
      if (!tName) continue;
      const ptsRaw = item.stats?.find((s) => s.name === 'points')?.displayValue;
      const pts = ptsRaw ? parseInt(ptsRaw, 10) : 0;
      if (!leader || (!isNaN(pts) && pts > bestPts)) {
        bestPts = isNaN(pts) ? 0 : pts;
        leader = tName;
        leaderPoints = bestPts > 0 ? bestPts : undefined;
      }
    }
  }

  return {
    name,
    abbreviation,
    season,
    logoUrl,
    activeCount,
    liveCount,
    upcomingCount,
    teamsCount: teamsCount > 0 ? teamsCount : entry.defaultTeamsCount,
    groupsCount,
    leader,
    leaderPoints,
    nextFixtureText,
  };
}

export async function GET() {
  try {
    const snapshots = await Promise.all(
      GLOBAL_LEAGUES.map((entry) => fetchLeagueSnapshot(entry))
    );

    const tournaments: Tournament[] = GLOBAL_LEAGUES.map((entry, idx) => {
      const snap = snapshots[idx];
      const liveName = snap.name || entry.fallbackName;
      const seasonLabel = snap.season || '2026-27 Season';

      const isWorldCup2026 = entry.id === 'fifa-world-cup-2026';

      let phaseLabel = 'Official Live Telemetry Connected';
      if (isWorldCup2026) {
        phaseLabel = 'Completed • Champions: Spain (1-0 vs Argentina)';
      } else if (snap.liveCount > 0) {
        phaseLabel = `${snap.liveCount} Live Match${snap.liveCount > 1 ? 'es' : ''} Now • ${snap.activeCount} Fixtures`;
      } else if (snap.upcomingCount > 0) {
        phaseLabel = `${snap.upcomingCount} Upcoming Fixture${snap.upcomingCount > 1 ? 's' : ''}`;
      } else if (snap.activeCount > 0) {
        phaseLabel = `${snap.activeCount} Matchday Fixture${snap.activeCount > 1 ? 's' : ''}`;
      } else if (snap.leader) {
        phaseLabel = `Standings Active (${snap.teamsCount} Teams)`;
      }

      const leaderText = isWorldCup2026
        ? 'Spain (2026 World Champions)'
        : snap.leader
        ? snap.leaderPoints !== undefined
          ? `${snap.leader} (${snap.leaderPoints} pts)`
          : snap.leader
        : 'Live Knockout Draw';

      const descriptionParts: string[] = [`Live ESPN ${seasonLabel} feed`];
      if (!isWorldCup2026 && snap.leader) {
        descriptionParts.push(
          `Currently led by ${snap.leader}${snap.leaderPoints !== undefined ? ` (${snap.leaderPoints} pts)` : ''}`
        );
      }
      if (snap.activeCount > 0) {
        descriptionParts.push(`${snap.activeCount} scoreboard fixture${snap.activeCount > 1 ? 's' : ''} tracked`);
      }
      if (snap.nextFixtureText) {
        descriptionParts.push(`Next: ${snap.nextFixtureText}`);
      }

      return {
        id: entry.id,
        espnSlug: entry.espnSlug,
        name: liveName,
        shortName: snap.abbreviation || entry.shortName,
        confederation: entry.confederation,
        region: entry.region,
        country: entry.country,
        flag: entry.flag,
        logoUrl: snap.logoUrl,
        tier: entry.tier,
        teamsCount: snap.teamsCount,
        totalTeams: snap.teamsCount,
        venueCount: entry.venueCount,
        officialBall: entry.officialBall,
        broadcastPartners: entry.broadcastPartners,
        defendingChampion: leaderText,
        leader: snap.leader,
        leaderPoints: snap.leaderPoints,
        activeFixturesCount: snap.activeCount,
        liveFixturesCount: snap.liveCount,
        currentSeason: seasonLabel,
        currentPhase: phaseLabel,
        description: `${descriptionParts.join(' • ')}.`,
      };
    });

    return NextResponse.json({
      success: true,
      totalLeagues: tournaments.length,
      tournaments,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch live tournaments';
    return NextResponse.json(
      { success: false, error: message, tournaments: [] },
      { status: 500 }
    );
  }
}
