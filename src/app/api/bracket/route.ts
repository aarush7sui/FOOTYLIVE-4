import { NextRequest, NextResponse } from 'next/server';
import { BracketMatch, BracketRound } from '../../../types/football';

interface EspnBracketEvent {
  id: string;
  date?: string;
  competitions?: Array<{
    venue?: { fullName?: string };
    notes?: Array<{ headline?: string }>;
    status?: {
      displayClock?: string;
      type?: { state?: string; shortDetail?: string };
    };
    competitors?: Array<{
      homeAway?: string;
      score?: string;
      winner?: boolean;
      shootoutScore?: number;
      team?: {
        displayName?: string;
        shortDisplayName?: string;
        logo?: string;
      };
    }>;
  }>;
}

function mapEventToBracketMatch(ev: EspnBracketEvent, customNotes?: string): BracketMatch | null {
  const comp = ev.competitions?.[0];
  if (!comp) return null;
  const competitors = comp.competitors || [];
  const home = competitors.find((c) => c.homeAway === 'home') || competitors[0];
  const away = competitors.find((c) => c.homeAway === 'away') || competitors[1];
  if (!home || !away) return null;

  const state = comp.status?.type?.state || 'pre';
  const shortDetail = comp.status?.type?.shortDetail || '';
  const status = state === 'in' ? 'LIVE' : state === 'post' ? 'COMPLETED' : 'SCHEDULED';

  const score1 = state === 'pre' ? undefined : parseInt(home.score ?? '0', 10);
  const score2 = state === 'pre' ? undefined : parseInt(away.score ?? '0', 10);

  const dt = ev.date ? new Date(ev.date) : null;
  const dateLabel = dt
    ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'TBD';

  const isWinner1 =
    typeof home.winner === 'boolean'
      ? home.winner
      : state === 'post' && score1 !== undefined && score2 !== undefined && score1 > score2;
  const isWinner2 =
    typeof away.winner === 'boolean'
      ? away.winner
      : state === 'post' && score1 !== undefined && score2 !== undefined && score2 > score1;

  return {
    id: ev.id,
    team1: {
      name: home.team?.displayName || 'Home',
      flag: home.team?.logo || '⚽',
      score: score1,
      penalties: home.shootoutScore,
      isWinner: isWinner1,
    },
    team2: {
      name: away.team?.displayName || 'Away',
      flag: away.team?.logo || '⚽',
      score: score2,
      penalties: away.shootoutScore,
      isWinner: isWinner2,
    },
    date: dateLabel,
    status,
    minute: state === 'in' ? comp.status?.displayClock : undefined,
    venue: comp.venue?.fullName || dateLabel,
    notes:
      customNotes ||
      comp.notes?.[0]?.headline ||
      (state === 'pre' && dt
        ? dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' GMT'
        : shortDetail || undefined),
  };
}

async function fetchEspnEvents(url: string): Promise<EspnBracketEvent[]> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 300 },
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 FOOTYLive/3.0' },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { events?: EspnBracketEvent[] };
    return data.events || [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tournament = searchParams.get('tournament') || 'worldcup';

  try {
    if (tournament === 'worldcup') {
      const roundSpecs = [
        { title: 'Round of 16', dates: ['20260704', '20260705', '20260706', '20260707'] },
        { title: 'Quarter-Finals', dates: ['20260709', '20260710', '20260711'] },
        { title: 'Semi-Finals', dates: ['20260714', '20260715'] },
        { title: 'Third-Place Playoff', dates: ['20260718'] },
        { title: 'Grand Final', dates: ['20260719'] },
      ];

      const rounds: BracketRound[] = await Promise.all(
        roundSpecs.map(async (spec) => {
          const batch = await Promise.all(
            spec.dates.map((d) =>
              fetchEspnEvents(
                `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${d}`
              )
            )
          );
          const flat = batch.flat();
          const seen = new Set<string>();
          const matches: BracketMatch[] = [];
          for (const ev of flat) {
            if (!ev?.id || seen.has(ev.id)) continue;
            seen.add(ev.id);
            const isFinal = spec.title === 'Grand Final';
            const detail = ev.competitions?.[0]?.status?.type?.shortDetail;
            const mapped = mapEventToBracketMatch(
              ev,
              isFinal ? `CHAMPIONS 🏆 (${detail || 'Final'})` : detail
            );
            if (mapped) matches.push(mapped);
          }
          return { title: spec.title, matches };
        })
      );

      return NextResponse.json({
        success: true,
        source: 'ESPN FIFA World Cup Official Feed',
        rounds: rounds.filter((r) => r.matches.length > 0),
      });
    }

    const leagueSlugMap: Record<string, string> = {
      ucl: 'uefa.champions',
      europa: 'uefa.europa',
      libertadores: 'conmebol.libertadores',
    };

    const slug = leagueSlugMap[tournament];
    if (slug) {
      const events = await fetchEspnEvents(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`
      );

      const liveMatches: BracketMatch[] = [];
      const upcomingMatches: BracketMatch[] = [];
      const completedMatches: BracketMatch[] = [];

      for (const ev of events) {
        const mapped = mapEventToBracketMatch(ev);
        if (!mapped) continue;
        if (mapped.status === 'LIVE') liveMatches.push(mapped);
        else if (mapped.status === 'COMPLETED') completedMatches.push(mapped);
        else upcomingMatches.push(mapped);
      }

      const rounds: BracketRound[] = [];
      if (liveMatches.length > 0) rounds.push({ title: 'Live Now', matches: liveMatches });
      if (upcomingMatches.length > 0) rounds.push({ title: 'Upcoming Fixtures', matches: upcomingMatches });
      if (completedMatches.length > 0) rounds.push({ title: 'Completed Results', matches: completedMatches });

      return NextResponse.json({
        success: true,
        source: `ESPN Live ${slug} Feed`,
        rounds,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported tournament bracket feed', rounds: [] },
      { status: 404 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load tournament bracket';
    return NextResponse.json({ success: false, error: message, rounds: [] }, { status: 500 });
  }
}
