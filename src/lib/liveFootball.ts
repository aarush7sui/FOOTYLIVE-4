import { Match, MatchEvent, MatchLineup, MatchOdds, MatchTeam, PlayerInfo } from '../types/football';

const LEAGUE_MAP: Record<string, string> = {
  '2026-27-english-premier-league': 'Premier League',
  'english-premier-league': 'Premier League',
  'eng.1': 'Premier League',
  'uefa-champions-league': 'UEFA Champions League',
  'uefa.champions': 'UEFA Champions League',
  'league-phase': 'UEFA Champions League / Europe',
  'uefa.europa': 'UEFA Europa League',
  '2026-27-laliga': 'La Liga EA Sports',
  'laliga': 'La Liga EA Sports',
  'esp.1': 'La Liga EA Sports',
  '2026-27-italian-serie-a': 'Serie A Made in Italy',
  'italian-serie-a': 'Serie A Made in Italy',
  'ita.1': 'Serie A Made in Italy',
  '2026-27-german-bundesliga': 'Bundesliga',
  'german-bundesliga': 'Bundesliga',
  'ger.1': 'Bundesliga',
  '2026-27-ligue-1': 'Ligue 1 McDonald’s',
  'fra.1': 'Ligue 1 McDonald’s',
  'torneo-apertura': 'Liga MX',
  'mex.1': 'Liga MX',
  'major-league-soccer': 'Major League Soccer',
  'usa.1': 'Major League Soccer',
  'saudi-pro-league': 'Roshn Saudi League',
  'sau.1': 'Roshn Saudi League',
  'conmebol-libertadores': 'CONMEBOL Copa Libertadores',
  'conmebol.libertadores': 'CONMEBOL Copa Libertadores',
  'fifa.world': 'FIFA World Cup',
};

const SCOREBOARD_LEAGUES = [
  'all',
  'eng.1',
  'uefa.champions',
  'uefa.europa',
  'esp.1',
  'ita.1',
  'ger.1',
  'fra.1',
  'usa.1',
  'mex.1',
  'sau.1',
  'conmebol.libertadores',
] as const;

interface EspnStatItem {
  name?: string;
  displayValue?: string;
}

interface EspnRosterEntry {
  starter?: boolean;
  jersey?: string;
  athlete?: { displayName?: string };
  position?: { abbreviation?: string };
}

interface EspnRosterTeam {
  homeAway?: string;
  formation?: string;
  team?: { id?: string; displayName?: string };
  roster?: EspnRosterEntry[];
}

interface EspnDetailItem {
  type?: { text?: string };
  team?: { id?: string };
  clock?: { displayValue?: string };
  athletesInvolved?: Array<{ displayName?: string }>;
  participants?: Array<{ athlete?: { displayName?: string } }>;
}

interface EspnEvent {
  id: string;
  date?: string;
  season?: { slug?: string };
  league?: { name?: string; slug?: string };
  status?: { displayClock?: string; type?: { state?: string; name?: string; shortDetail?: string } };
  competitions?: Array<{
    attendance?: number;
    type?: { text?: string };
    notes?: Array<{ headline?: string }>;
    venue?: { fullName?: string; address?: { city?: string; country?: string } };
    broadcasts?: Array<{ names?: string[] }>;
    details?: EspnDetailItem[];
    odds?: Array<{
      moneyline?: {
        home?: { close?: { odds?: string }; open?: { odds?: string } };
        away?: { close?: { odds?: string }; open?: { odds?: string } };
        draw?: { close?: { odds?: string }; open?: { odds?: string } };
      };
      drawOdds?: { moneyLine?: number };
    }>;
    status?: { displayClock?: string; type?: { state?: string; name?: string; shortDetail?: string } };
    competitors?: Array<{
      id?: string;
      homeAway?: string;
      score?: string;
      statistics?: EspnStatItem[];
      team?: {
        id?: string;
        displayName?: string;
        name?: string;
        shortDisplayName?: string;
        abbreviation?: string;
        color?: string;
        alternateColor?: string;
        logo?: string;
        location?: string;
      };
    }>;
  }>;
}

interface EspnSummaryResponse {
  rosters?: EspnRosterTeam[];
  keyEvents?: EspnDetailItem[];
  boxscore?: {
    teams?: Array<{
      homeAway?: string;
      team?: { id?: string };
      statistics?: EspnStatItem[];
    }>;
  };
}

function americanOddsToDecimal(oddsInput?: string | number): number | null {
  if (oddsInput === undefined || oddsInput === null) return null;
  const parsed = typeof oddsInput === 'number' ? oddsInput : parseInt(String(oddsInput).replace(/[^0-9+-]/g, ''), 10);
  if (isNaN(parsed) || parsed === 0) return null;
  if (parsed > 0) {
    return Number((1 + parsed / 100).toFixed(2));
  }
  return Number((1 + 100 / Math.abs(parsed)).toFixed(2));
}

function formatKickoffDateLabel(eventDate: Date): string {
  const now = new Date();
  const todayStr = now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  if (eventDate.toDateString() === todayStr) return 'Today';
  if (eventDate.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function parseClockSeconds(clock?: string): number {
  if (!clock) return 0;
  if (clock.includes(':')) {
    const parts = clock.split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }
  const mins = parseInt(clock.replace(/[^0-9]/g, ''), 10);
  return isNaN(mins) ? 0 : mins * 60;
}

function extractLineup(
  summary: EspnSummaryResponse | null,
  homeTeamId?: string,
  awayTeamId?: string
): MatchLineup | undefined {
  if (!summary?.rosters || summary.rosters.length < 2) return undefined;

  const homeRoster =
    summary.rosters.find((r) => r.homeAway === 'home' || (homeTeamId && r.team?.id === homeTeamId)) ||
    summary.rosters[0];
  const awayRoster =
    summary.rosters.find((r) => r.homeAway === 'away' || (awayTeamId && r.team?.id === awayTeamId)) ||
    summary.rosters[1];

  const mapPlayers = (entries?: EspnRosterEntry[]): PlayerInfo[] =>
    (entries || [])
      .filter((p) => p.starter)
      .slice(0, 11)
      .map((p) => ({
        number: parseInt(p.jersey || '0', 10) || 0,
        name: p.athlete?.displayName || 'Starter',
        position: p.position?.abbreviation || 'XI',
      }));

  const homeXI = mapPlayers(homeRoster?.roster);
  const awayXI = mapPlayers(awayRoster?.roster);

  if (homeXI.length === 0 && awayXI.length === 0) return undefined;

  return {
    home: {
      formation: homeRoster?.formation || 'XI',
      startingXI: homeXI,
    },
    away: {
      formation: awayRoster?.formation || 'XI',
      startingXI: awayXI,
    },
  };
}

function extractEvents(
  rawDetails: EspnDetailItem[] | undefined,
  summaryEvents: EspnDetailItem[] | undefined,
  homeTeamId: string | undefined,
  homeShortName: string,
  awayShortName: string
): MatchEvent[] {
  const source = summaryEvents && summaryEvents.length > 0 ? summaryEvents : rawDetails || [];
  const parsed: MatchEvent[] = [];

  source.forEach((d, idx) => {
    const text = (d.type?.text || '').toLowerCase();
    const isGoal = text.includes('goal') || text.includes('penalty - scored');
    const isYellow = text.includes('yellow');
    const isRed = text.includes('red');
    const isSub = text.includes('substitution');
    const isPenMiss = text.includes('penalty') && (text.includes('missed') || text.includes('saved'));

    if (!isGoal && !isYellow && !isRed && !isSub && !isPenMiss) return;

    const teamSide: 'home' | 'away' = homeTeamId && d.team?.id === homeTeamId ? 'home' : 'away';
    const playerName =
      d.athletesInvolved?.[0]?.displayName ||
      d.participants?.[0]?.athlete?.displayName ||
      (teamSide === 'home' ? homeShortName : awayShortName);

    const minuteVal = parseInt((d.clock?.displayValue || '0').replace(/[^0-9]/g, ''), 10) || 0;

    parsed.push({
      id: `espn-ev-${idx}-${minuteVal}`,
      type: isGoal
        ? 'goal'
        : isRed
        ? 'red_card'
        : isYellow
        ? 'yellow_card'
        : isPenMiss
        ? 'penalty_miss'
        : 'sub',
      minute: minuteVal,
      player: playerName,
      team: teamSide,
      detail: d.type?.text || 'Match Event',
    });
  });

  return parsed;
}

function transformEspnEvent(
  event: EspnEvent,
  leagueSlug: string,
  summary: EspnSummaryResponse | null
): Match | null {
  try {
    const competition = event.competitions?.[0];
    if (!competition) return null;

    const competitors = competition.competitors || [];
    const homeComp = competitors.find((c) => c.homeAway === 'home') || competitors[0];
    const awayComp = competitors.find((c) => c.homeAway === 'away') || competitors[1];
    if (!homeComp || !awayComp) return null;

    const statusType = competition.status?.type || event.status?.type || {};
    const state = statusType.state || 'pre';

    let status: Match['status'] = 'UPCOMING';
    let minute = 'Upcoming';
    let clockSecs = 0;

    if (state === 'in') {
      status = 'LIVE';
      const clock = competition.status?.displayClock || event.status?.displayClock;
      minute = clock ? `${clock}` : 'LIVE';
      clockSecs = parseClockSeconds(clock);
      if (statusType.name === 'STATUS_HALFTIME') {
        status = 'HT';
        minute = 'HT';
        clockSecs = 45 * 60;
      }
    } else if (state === 'post') {
      status = 'FINISHED';
      minute = statusType.shortDetail || 'FT';
    } else {
      status = 'UPCOMING';
      minute = statusType.shortDetail || 'Scheduled';
    }

    const homeScore = parseInt(homeComp.score || '0', 10);
    const awayScore = parseInt(awayComp.score || '0', 10);

    const eventDate = event.date ? new Date(event.date) : new Date();
    const kickoffIso = event.date || eventDate.toISOString();
    const kickoffTime =
      eventDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' GMT';
    const kickoffDate = formatKickoffDateLabel(eventDate);

    const seasonSlug = event.season?.slug || '';
    const tournamentName =
      LEAGUE_MAP[leagueSlug] ||
      LEAGUE_MAP[seasonSlug] ||
      event.league?.name ||
      competition.notes?.[0]?.headline ||
      (seasonSlug
        ? seasonSlug
            .split('-')
            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
            .join(' ')
        : 'World Football Match');

    const homeTeam: MatchTeam = {
      name: homeComp.team?.displayName || homeComp.team?.name || 'Home Club',
      shortName: homeComp.team?.shortDisplayName || homeComp.team?.abbreviation || 'HOM',
      code: homeComp.team?.abbreviation || 'HOM',
      color: '#' + (homeComp.team?.color || 'ffffff'),
      accentColor: '#' + (homeComp.team?.alternateColor || '0055ff'),
      logo: homeComp.team?.logo || '⚽',
      country: homeComp.team?.location || 'Global',
    };

    const awayTeam: MatchTeam = {
      name: awayComp.team?.displayName || awayComp.team?.name || 'Away Club',
      shortName: awayComp.team?.shortDisplayName || awayComp.team?.abbreviation || 'AWY',
      code: awayComp.team?.abbreviation || 'AWY',
      color: '#' + (awayComp.team?.color || '00ff88'),
      accentColor: '#' + (awayComp.team?.alternateColor || '111420'),
      logo: awayComp.team?.logo || '⚽',
      country: awayComp.team?.location || 'Global',
    };

    // Merge real statistics from scoreboard competitors and summary boxscore
    const boxHomeStats =
      summary?.boxscore?.teams?.find((t) => t.homeAway === 'home' || t.team?.id === homeComp.team?.id)?.statistics || [];
    const boxAwayStats =
      summary?.boxscore?.teams?.find((t) => t.homeAway === 'away' || t.team?.id === awayComp.team?.id)?.statistics || [];

    const homeStatsAll = [...(homeComp.statistics || []), ...boxHomeStats];
    const awayStatsAll = [...(awayComp.statistics || []), ...boxAwayStats];

    const getStat = (name: string, fallback: [number, number]): [number, number] => {
      const h = homeStatsAll.find((s) => s.name === name)?.displayValue;
      const a = awayStatsAll.find((s) => s.name === name)?.displayValue;
      if (h !== undefined && a !== undefined) {
        const valH = parseFloat(h.replace('%', ''));
        const valA = parseFloat(a.replace('%', ''));
        if (!isNaN(valH) && !isNaN(valA)) return [valH, valA];
      }
      return fallback;
    };

    const possession = getStat('possessionPct', status === 'UPCOMING' ? [50, 50] : [50, 50]);
    const shots = getStat('totalShots', getStat('shotsTotal', [0, 0]));
    const shotsOnTarget = getStat('shotsOnTarget', [0, 0]);
    const corners = getStat('wonCorners', getStat('corners', [0, 0]));
    const fouls = getStat('foulsCommitted', [0, 0]);
    const yellowCards = getStat('yellowCards', [0, 0]);
    const passes = getStat('totalPasses', [0, 0]);
    const passAccuracy = getStat('passPct', getStat('accuratePasses', [0, 0]));

    const events = extractEvents(
      competition.details,
      summary?.keyEvents,
      homeComp.team?.id,
      homeTeam.shortName,
      awayTeam.shortName
    );

    const lineup = extractLineup(summary, homeComp.team?.id, awayComp.team?.id);

    // Parse real bookmaker odds when supplied by ESPN
    let odds: MatchOdds | undefined;
    const rawOdds = competition.odds?.[0];
    if (rawOdds?.moneyline) {
      const h = americanOddsToDecimal(rawOdds.moneyline.home?.close?.odds ?? rawOdds.moneyline.home?.open?.odds);
      const d = americanOddsToDecimal(
        rawOdds.moneyline.draw?.close?.odds ?? rawOdds.moneyline.draw?.open?.odds ?? rawOdds.drawOdds?.moneyLine
      );
      const a = americanOddsToDecimal(rawOdds.moneyline.away?.close?.odds ?? rawOdds.moneyline.away?.open?.odds);
      if (h && d && a) {
        odds = { home: h, draw: d, away: a };
      }
    }

    const broadcastNames = (competition.broadcasts || [])
      .flatMap((b) => b.names || [])
      .filter(Boolean);

    const attendance =
      typeof competition.attendance === 'number' && competition.attendance > 0
        ? competition.attendance
        : undefined;

    return {
      id: event.id,
      tournament: tournamentName,
      stage: competition.type?.text || (status === 'LIVE' ? 'Live In-Play' : 'Official Fixture'),
      homeTeam,
      awayTeam,
      score: {
        home: isNaN(homeScore) ? 0 : homeScore,
        away: isNaN(awayScore) ? 0 : awayScore,
      },
      minute,
      liveClockSeconds: status === 'LIVE' ? clockSecs : undefined,
      status,
      kickoffTime,
      kickoffDate,
      kickoffIso,
      leagueSlug,
      stadium: competition.venue?.fullName || 'TBD Venue',
      city: competition.venue?.address?.city
        ? `${competition.venue.address.city}${competition.venue.address.country ? `, ${competition.venue.address.country}` : ''}`
        : 'TBD',
      attendance,
      viewers: attendance ? `${attendance.toLocaleString()} Stadium Attendance` : undefined,
      streamQuality: '4K HDR',
      channels: broadcastNames.length > 0 ? broadcastNames : ['Official Broadcast Feed'],
      cameraAngles: [
        { name: 'Tactical Cam 1', description: 'Wide broadcast tactical flow and shape' },
        { name: 'Director Cut 4K', description: 'Main broadcast production feed' },
        { name: 'Goal Line Cam', description: 'High frame-rate pitch replay' },
      ],
      commentaryTracks: [
        { language: 'English (Live)', commentator: 'World Feed Commentary' },
        { language: 'Stadium Atmos', commentator: 'Clean Pitch Audio' },
      ],
      events,
      stats: {
        possession,
        shots,
        shotsOnTarget,
        xG: [
          Number((shotsOnTarget[0] * 0.28 + (isNaN(homeScore) ? 0 : homeScore) * 0.35).toFixed(2)),
          Number((shotsOnTarget[1] * 0.28 + (isNaN(awayScore) ? 0 : awayScore) * 0.35).toFixed(2)),
        ],
        corners,
        fouls,
        yellowCards,
        passes,
        passAccuracy,
      },
      lineup,
      odds,
    };
  } catch (err) {
    console.warn('Error parsing ESPN soccer event:', err);
    return null;
  }
}

async function fetchEventSummary(eventId: string, leagueSlug: string): Promise<EspnSummaryResponse | null> {
  const slug = leagueSlug || 'all';
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eventId}`,
      {
        next: { revalidate: 20 },
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 FOOTYLive/3.0',
        },
      }
    );
    if (!res.ok) return null;
    return (await res.json()) as EspnSummaryResponse;
  } catch {
    return null;
  }
}

export async function fetchLiveMatchesServer(): Promise<Match[]> {
  const results = await Promise.allSettled(
    SCOREBOARD_LEAGUES.map(async (slug) => {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`;
      const res = await fetch(url, {
        next: { revalidate: 15 },
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 FOOTYLive/3.0',
        },
      });
      if (!res.ok) return { slug, events: [] as EspnEvent[] };
      const json = (await res.json()) as { events?: EspnEvent[] };
      return { slug, events: json.events || [] };
    })
  );

  const seenIds = new Set<string>();
  const collected: Array<{ event: EspnEvent; slug: string }> = [];

  for (const res of results) {
    if (res.status !== 'fulfilled') continue;
    for (const ev of res.value.events) {
      if (!ev?.id || seenIds.has(ev.id)) continue;
      seenIds.add(ev.id);
      const effectiveSlug = res.value.slug === 'all' ? ev.league?.slug || 'all' : res.value.slug;
      collected.push({ event: ev, slug: effectiveSlug });
    }
  }

  // Enrich LIVE, HT, and top active/finished events (up to 8) with real ESPN summary rosters, boxscores, and keyEvents
  const enrichTargets = collected
    .filter(({ event }) => {
      const state = event.competitions?.[0]?.status?.type?.state || event.status?.type?.state;
      return state === 'in' || state === 'post';
    })
    .slice(0, 8);

  const summaryMap = new Map<string, EspnSummaryResponse | null>();
  await Promise.allSettled(
    enrichTargets.map(async ({ event, slug }) => {
      const summary = await fetchEventSummary(event.id, slug);
      summaryMap.set(event.id, summary);
    })
  );

  const matches: Match[] = [];
  for (const { event, slug } of collected) {
    const transformed = transformEspnEvent(event, slug, summaryMap.get(event.id) ?? null);
    if (transformed) matches.push(transformed);
  }

  matches.sort((a, b) => {
    const rank = (s: Match['status']) => (s === 'LIVE' ? 0 : s === 'HT' ? 1 : s === 'UPCOMING' ? 2 : 3);
    const diff = rank(a.status) - rank(b.status);
    if (diff !== 0) return diff;
    const tA = a.kickoffIso ? Date.parse(a.kickoffIso) : 0;
    const tB = b.kickoffIso ? Date.parse(b.kickoffIso) : 0;
    return tA - tB;
  });

  return matches;
}

export function formatLiveContextForBot(matches: Match[]): string {
  const nowStr = new Date().toUTCString();
  if (!matches || matches.length === 0) {
    return `Current UTC time: ${nowStr}. Live scoreboard currently returned 0 active fixtures from ESPN; use Google Search if the user asks about specific matches, scores, or schedules.`;
  }

  const live = matches.filter((m) => m.status === 'LIVE' || m.status === 'HT').slice(0, 10);
  const upcoming = matches.filter((m) => m.status === 'UPCOMING').slice(0, 10);
  const finished = matches.filter((m) => m.status === 'FINISHED').slice(0, 8);

  const fmt = (m: Match) =>
    `- [${m.tournament}] ${m.homeTeam.name} ${m.score.home} - ${m.score.away} ${m.awayTeam.name} (${m.status === 'UPCOMING' ? `${m.kickoffDate} ${m.kickoffTime}` : m.minute}) @ ${m.stadium}`;

  return [
    `Current UTC Time: ${nowStr}`,
    `LIVE / IN-PLAY MATCHES (${live.length}):`,
    live.length > 0 ? live.map(fmt).join('\n') : '- None currently in-play on ESPN feed right now',
    `UPCOMING SCHEDULED MATCHES (${upcoming.length}):`,
    upcoming.length > 0 ? upcoming.map(fmt).join('\n') : '- None queued right now',
    `RECENTLY FINISHED MATCHES (${finished.length}):`,
    finished.length > 0 ? finished.map(fmt).join('\n') : '- None listed',
  ].join('\n');
}
