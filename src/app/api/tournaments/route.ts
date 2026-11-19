import { NextResponse } from 'next/server';
import { Tournament } from '../../../types/football';

interface EspnLeagueMetaResponse {
  leagues?: Array<{
    season?: { displayName?: string };
  }>;
  events?: Array<{
    competitions?: Array<{
      status?: { type?: { state?: string } };
    }>;
  }>;
}

async function fetchLeagueTelemetry(espnSlug: string): Promise<{ season?: string; activeCount: number; liveCount: number }> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${espnSlug}/scoreboard`,
      { next: { revalidate: 120 } }
    );
    if (!res.ok) return { activeCount: 0, liveCount: 0 };
    const json = (await res.json()) as EspnLeagueMetaResponse;
    const events = json.events || [];
    const liveCount = events.filter(
      (e) => e.competitions?.[0]?.status?.type?.state === 'in'
    ).length;
    return {
      season: json.leagues?.[0]?.season?.displayName,
      activeCount: events.length,
      liveCount,
    };
  } catch {
    return { activeCount: 0, liveCount: 0 };
  }
}

export async function GET() {
  try {
    const baseTournaments: Array<Tournament & { espnSlug: string }> = [
      {
        id: 'fifa-world-cup-2026',
        espnSlug: 'fifa.world',
        name: 'FIFA World Cup 2026',
        shortName: 'World Cup 26',
        confederation: 'FIFA',
        region: 'North America (USA / Canada / Mexico)',
        country: 'USA / Mexico / Canada',
        flag: '🌍',
        tier: 'International',
        currentSeason: '2026 FIFA World Cup',
        currentPhase: 'Completed • Champions: Spain',
        defendingChampion: 'Spain (1-0 vs Argentina AET)',
        broadcastPartners: ['ESPN', 'FOX Sports', 'Telemundo', 'BBC / ITV'],
        officialBall: 'adidas Trionda 2026',
        totalTeams: 48,
        venueCount: 16,
      },
      {
        id: 'uefa-champions-league',
        espnSlug: 'uefa.champions',
        name: 'UEFA Champions League',
        shortName: 'UCL',
        confederation: 'UEFA',
        region: 'Europe',
        country: 'Europe',
        flag: '⭐',
        tier: 'Club',
        currentSeason: '2026-27',
        currentPhase: 'Live Competition',
        defendingChampion: 'UEFA Champions League',
        broadcastPartners: ['TNT Sports', 'CBS Sports Paramount+', 'DAZN'],
        officialBall: 'adidas UCL Pro',
        totalTeams: 36,
        venueCount: 36,
      },
      {
        id: 'premier-league',
        espnSlug: 'eng.1',
        name: 'Premier League',
        shortName: 'EPL',
        confederation: 'UEFA',
        region: 'England',
        country: 'England',
        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        tier: 'Club',
        currentSeason: '2026-27',
        currentPhase: 'Regular Season',
        defendingChampion: 'English Top Flight',
        broadcastPartners: ['Sky Sports Main Event', 'NBC Peacock'],
        officialBall: 'Puma Orbita Premier League',
        totalTeams: 20,
        venueCount: 20,
      },
      {
        id: 'la-liga',
        espnSlug: 'esp.1',
        name: 'La Liga EA Sports',
        shortName: 'La Liga',
        confederation: 'UEFA',
        region: 'Spain',
        country: 'Spain',
        flag: '🇪🇸',
        tier: 'Club',
        currentSeason: '2026-27',
        currentPhase: 'Regular Season',
        defendingChampion: 'Spanish Top Flight',
        broadcastPartners: ['DAZN LaLiga', 'ESPN+'],
        officialBall: 'Puma Orbita La Liga',
        totalTeams: 20,
        venueCount: 20,
      },
      {
        id: 'serie-a',
        espnSlug: 'ita.1',
        name: 'Serie A Made in Italy',
        shortName: 'Serie A',
        confederation: 'UEFA',
        region: 'Italy',
        country: 'Italy',
        flag: '🇮🇹',
        tier: 'Club',
        currentSeason: '2026-27',
        currentPhase: 'Regular Season',
        defendingChampion: 'Italian Top Flight',
        broadcastPartners: ['DAZN Italia', 'Paramount+'],
        officialBall: 'Puma Orbita Serie A',
        totalTeams: 20,
        venueCount: 20,
      },
      {
        id: 'bundesliga',
        espnSlug: 'ger.1',
        name: 'Bundesliga',
        shortName: 'Bundesliga',
        confederation: 'UEFA',
        region: 'Germany',
        country: 'Germany',
        flag: '🇩🇪',
        tier: 'Club',
        currentSeason: '2026-27',
        currentPhase: 'Regular Season',
        defendingChampion: 'German Top Flight',
        broadcastPartners: ['Sky Sport Bundesliga', 'ESPN+'],
        officialBall: 'Derbystar Bundesliga APS',
        totalTeams: 18,
        venueCount: 18,
      },
      {
        id: 'ligue-1',
        espnSlug: 'fra.1',
        name: 'Ligue 1 McDonald’s',
        shortName: 'Ligue 1',
        confederation: 'UEFA',
        region: 'France',
        country: 'France',
        flag: '🇫🇷',
        tier: 'Club',
        currentSeason: '2026-27',
        currentPhase: 'Regular Season',
        defendingChampion: 'French Top Flight',
        broadcastPartners: ['DAZN France', 'beIN Sports'],
        officialBall: 'Kipsta Ligue 1 Pro',
        totalTeams: 18,
        venueCount: 18,
      },
      {
        id: 'saudi-pro-league',
        espnSlug: 'sau.1',
        name: 'Roshn Saudi League',
        shortName: 'SPL',
        confederation: 'AFC',
        region: 'Middle East',
        country: 'Saudi Arabia',
        flag: '🇸🇦',
        tier: 'Club',
        currentSeason: '2026-27',
        currentPhase: 'Regular Season',
        defendingChampion: 'Saudi Pro League',
        broadcastPartners: ['SSC Sports', 'Shahid VIP'],
        officialBall: 'Saudi Pro Matchball',
        totalTeams: 18,
        venueCount: 18,
      },
      {
        id: 'mls',
        espnSlug: 'usa.1',
        name: 'Major League Soccer',
        shortName: 'MLS',
        confederation: 'CONCACAF',
        region: 'North America',
        country: 'USA / Canada',
        flag: '🇺🇸',
        tier: 'Club',
        currentSeason: '2026',
        currentPhase: 'MLS Season',
        defendingChampion: 'Major League Soccer',
        broadcastPartners: ['Apple TV MLS Season Pass', 'FOX'],
        officialBall: 'adidas MLS Pro',
        totalTeams: 30,
        venueCount: 30,
      },
      {
        id: 'copa-libertadores',
        espnSlug: 'conmebol.libertadores',
        name: 'CONMEBOL Copa Libertadores',
        shortName: 'Libertadores',
        confederation: 'CONMEBOL',
        region: 'South America',
        country: 'South America',
        flag: '🏆',
        tier: 'Club',
        currentSeason: '2026',
        currentPhase: 'Final Stage',
        defendingChampion: 'CONMEBOL Libertadores',
        broadcastPartners: ['ESPN', 'Globo', 'Paramount+'],
        officialBall: 'Puma Cumbre CONMEBOL',
        totalTeams: 32,
        venueCount: 32,
      },
    ];

    const telemetryList = await Promise.all(
      baseTournaments.map((t) => fetchLeagueTelemetry(t.espnSlug))
    );

    const tournaments: Tournament[] = baseTournaments.map((t, idx) => {
      const meta = telemetryList[idx];
      const { espnSlug: _unused, ...rest } = t;
      void _unused;
      const phaseLabel =
        meta.liveCount > 0
          ? `${meta.liveCount} Live Match${meta.liveCount > 1 ? 'es' : ''} Now`
          : meta.activeCount > 0
          ? `${meta.activeCount} Scheduled / Active Fixtures`
          : rest.currentPhase;
      return {
        ...rest,
        currentSeason: meta.season || rest.currentSeason,
        currentPhase: rest.id === 'fifa-world-cup-2026' ? rest.currentPhase : phaseLabel,
      };
    });

    return NextResponse.json({
      success: true,
      tournaments,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch tournaments';
    return NextResponse.json(
      { success: false, error: message, tournaments: [] },
      { status: 500 }
    );
  }
}
