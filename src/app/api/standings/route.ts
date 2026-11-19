import { NextRequest, NextResponse } from 'next/server';

const LEAGUE_STANDINGS_MAP: Record<string, string> = {
  'premier-league': 'eng.1',
  'uefa-champions-league': 'uefa.champions',
  'la-liga': 'esp.1',
  'serie-a': 'ita.1',
  'bundesliga': 'ger.1',
  'ligue-1': 'fra.1',
  'mls': 'usa.1',
  'liga-mx': 'mex.1',
  'saudi-pro-league': 'sau.1',
  'copa-libertadores': 'conmebol.libertadores',
  'fifa-world-cup-2026': 'fifa.world',
};

interface EspnStat {
  name?: string;
  displayValue?: string;
}

interface EspnStandingEntry {
  team?: {
    displayName?: string;
    logos?: Array<{ href?: string }>;
  };
  stats?: EspnStat[];
}

interface EspnScoreboardEvent {
  id?: string;
  date?: string;
  competitions?: Array<{
    type?: { text?: string };
    venue?: { fullName?: string };
    status?: { type?: { state?: string; shortDetail?: string } };
    details?: Array<{
      type?: { text?: string };
      clock?: { displayValue?: string };
      team?: { id?: string };
      athletesInvolved?: Array<{ displayName?: string }>;
    }>;
    competitors?: Array<{
      homeAway?: string;
      score?: string;
      team?: { id?: string; displayName?: string; shortDisplayName?: string; logo?: string };
    }>;
  }>;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const leagueId = searchParams.get('league') || 'premier-league';
  const espnLeague = LEAGUE_STANDINGS_MAP[leagueId] || 'eng.1';

  try {
    const [standingsRes, scoreboardRes] = await Promise.all([
      fetch(`https://site.api.espn.com/apis/v2/sports/soccer/${espnLeague}/standings`, {
        next: { revalidate: 120 },
      }),
      fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${espnLeague}/scoreboard`, {
        next: { revalidate: 60 },
      }).catch(() => null),
    ]);

    let standings: Array<{
      rank: number;
      team: string;
      logo: string;
      played: number;
      won: number;
      drawn: number;
      lost: number;
      gf: number;
      ga: number;
      gd: number;
      points: number;
      streak: string;
      form: ('W' | 'D' | 'L')[];
    }> = [];

    if (standingsRes.ok) {
      const data = await standingsRes.json();
      const entries: EspnStandingEntry[] =
        data.children?.[0]?.standings?.entries ||
        data.standings?.entries ||
        [];

      standings = entries.map((entry, index) => {
        const statsMap = (entry.stats || []).reduce<Record<string, EspnStat>>((acc, s) => {
          if (s.name) acc[s.name] = s;
          return acc;
        }, {});

        const played = parseInt(statsMap['gamesPlayed']?.displayValue || '0', 10) || 0;
        const won = parseInt(statsMap['wins']?.displayValue || '0', 10) || 0;
        const drawn = parseInt(statsMap['ties']?.displayValue || '0', 10) || 0;
        const lost = parseInt(statsMap['losses']?.displayValue || '0', 10) || 0;
        const gf = parseInt(statsMap['pointsFor']?.displayValue || '0', 10) || 0;
        const ga = parseInt(statsMap['pointsAgainst']?.displayValue || '0', 10) || 0;
        const gd = parseInt(statsMap['pointDifferential']?.displayValue || '0', 10) || 0;
        const points = parseInt(statsMap['points']?.displayValue || '0', 10) || 0;
        const teamName = entry.team?.displayName || `Club ${index + 1}`;
        const streak = statsMap['streak']?.displayValue || '';

        let formArray: ('W' | 'D' | 'L')[] = [];
        const rawForm = statsMap['form']?.displayValue || '';
        if (rawForm) {
          formArray = rawForm
            .toUpperCase()
            .replace(/[^WDL]/g, '')
            .slice(-5)
            .split('') as ('W' | 'D' | 'L')[];
        }

        return {
          rank: index + 1,
          team: teamName,
          logo: entry.team?.logos?.[0]?.href || '',
          played,
          won,
          drawn,
          lost,
          gf,
          ga,
          gd,
          points,
          streak,
          form: formArray,
        };
      });
    }

    const fixtures: Array<{
      id: string;
      homeTeam: string;
      awayTeam: string;
      homeLogo?: string;
      awayLogo?: string;
      date: string;
      time: string;
      stage: string;
      stadium: string;
      status: string;
      score?: string;
    }> = [];

    const matchScorerMap = new Map<string, { name: string; team: string; goals: number }>();

    if (scoreboardRes && scoreboardRes.ok) {
      const sbData = (await scoreboardRes.json()) as { events?: EspnScoreboardEvent[] };
      for (const ev of sbData.events || []) {
        const comp = ev.competitions?.[0];
        if (!comp) continue;
        const competitors = comp.competitors || [];
        const home = competitors.find((c) => c.homeAway === 'home') || competitors[0];
        const away = competitors.find((c) => c.homeAway === 'away') || competitors[1];
        if (!home || !away) continue;

        const dt = ev.date ? new Date(ev.date) : null;
        const state = comp.status?.type?.state || 'pre';
        const scoreLabel =
          state === 'in' || state === 'post'
            ? `${home.score ?? '0'} - ${away.score ?? '0'} (${comp.status?.type?.shortDetail || state.toUpperCase()})`
            : undefined;

        fixtures.push({
          id: ev.id || `${home.team?.displayName}-${away.team?.displayName}`,
          homeTeam: home.team?.displayName || 'Home',
          awayTeam: away.team?.displayName || 'Away',
          homeLogo: home.team?.logo,
          awayLogo: away.team?.logo,
          date: dt
            ? dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            : 'Scheduled',
          time: dt
            ? dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' GMT'
            : 'TBD',
          stage: comp.type?.text || comp.status?.type?.shortDetail || 'Official Fixture',
          stadium: comp.venue?.fullName || 'TBD Stadium',
          status: state,
          score: scoreLabel,
        });

        for (const d of comp.details || []) {
          const text = (d.type?.text || '').toLowerCase();
          if (text.includes('goal') || text.includes('penalty - scored')) {
            const scorerName = d.athletesInvolved?.[0]?.displayName;
            if (!scorerName) continue;
            const teamName =
              d.team?.id === home.team?.id
                ? home.team?.displayName || 'Home'
                : away.team?.displayName || 'Away';
            const key = `${scorerName}::${teamName}`;
            const existing = matchScorerMap.get(key);
            if (existing) {
              existing.goals += 1;
            } else {
              matchScorerMap.set(key, { name: scorerName, team: teamName, goals: 1 });
            }
          }
        }
      }
    }

    const matchScorers = Array.from(matchScorerMap.values()).sort((a, b) => b.goals - a.goals);

    // Top attacking clubs from real ESPN standings sorted by goals for (gf)
    const attackingClubs = [...standings]
      .filter((s) => s.played > 0)
      .sort((a, b) => b.gf - a.gf || b.gd - a.gd)
      .slice(0, 8)
      .map((s, idx) => ({
        rank: idx + 1,
        team: s.team,
        logo: s.logo,
        goalsFor: s.gf,
        goalsAgainst: s.ga,
        gd: s.gd,
        played: s.played,
        points: s.points,
      }));

    if (standings.length === 0 && fixtures.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No live ESPN standings or fixtures available for ${leagueId} right now.`,
          standings: [],
          fixtures: [],
          scorers: [],
          attackingClubs: [],
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      league: leagueId,
      standings,
      fixtures,
      scorers: matchScorers,
      attackingClubs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch live standings';
    return NextResponse.json(
      {
        success: false,
        error: message,
        standings: [],
        fixtures: [],
        scorers: [],
        attackingClubs: [],
      },
      { status: 503 }
    );
  }
}
