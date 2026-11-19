'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Match, MatchEvent, MatchOdds } from '../types/football';

function parseClockToSeconds(clockStr?: string): number {
  if (!clockStr) return 0;
  if (clockStr.includes(':')) {
    const [min, sec] = clockStr.split(':').map((v) => parseInt(v, 10));
    return (isNaN(min) ? 0 : min) * 60 + (isNaN(sec) ? 0 : sec);
  }
  const clean = clockStr.replace(/[^0-9]/g, '');
  const min = parseInt(clean, 10);
  return isNaN(min) ? 0 : min * 60;
}

function formatSecondsToClock(totalSeconds: number): string {
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function americanToDecimal(val?: string | number): number | null {
  if (val === undefined || val === null) return null;
  const parsed = typeof val === 'number' ? val : parseInt(String(val).replace(/[^0-9+-]/g, ''), 10);
  if (isNaN(parsed) || parsed === 0) return null;
  return parsed > 0
    ? Number((1 + parsed / 100).toFixed(2))
    : Number((1 + 100 / Math.abs(parsed)).toFixed(2));
}

interface RawEspnEvent {
  id: string;
  date?: string;
  season?: { slug?: string };
  league?: { name?: string; slug?: string };
  competitions?: Array<{
    attendance?: number;
    type?: { text?: string };
    notes?: Array<{ headline?: string }>;
    venue?: { fullName?: string; address?: { city?: string; country?: string } };
    broadcasts?: Array<{ names?: string[] }>;
    odds?: Array<{
      moneyline?: {
        home?: { close?: { odds?: string }; open?: { odds?: string } };
        away?: { close?: { odds?: string }; open?: { odds?: string } };
        draw?: { close?: { odds?: string }; open?: { odds?: string } };
      };
      drawOdds?: { moneyLine?: number };
    }>;
    details?: Array<{
      type?: { text?: string };
      clock?: { displayValue?: string };
      team?: { id?: string };
      athletesInvolved?: Array<{ displayName?: string }>;
    }>;
    status?: {
      displayClock?: string;
      type?: { state?: string; name?: string; shortDetail?: string };
    };
    competitors?: Array<{
      homeAway?: string;
      score?: string;
      statistics?: Array<{ name?: string; displayValue?: string }>;
      team?: {
        id?: string;
        displayName?: string;
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

function transformDirectEspn(event: RawEspnEvent): Match | null {
  try {
    const competition = event.competitions?.[0];
    if (!competition) return null;
    const comps = competition.competitors || [];
    const homeComp = comps.find((c) => c.homeAway === 'home') || comps[0];
    const awayComp = comps.find((c) => c.homeAway === 'away') || comps[1];
    if (!homeComp || !awayComp) return null;

    const state = competition.status?.type?.state || 'pre';
    let status: Match['status'] = 'UPCOMING';
    let clockSecs = 0;
    let minute = competition.status?.type?.shortDetail || 'Scheduled';

    if (state === 'in') {
      status = 'LIVE';
      const display = competition.status?.displayClock || '0:00';
      clockSecs = parseClockToSeconds(display);
      minute = formatSecondsToClock(clockSecs);
      if (competition.status?.type?.name === 'STATUS_HALFTIME') {
        status = 'HT';
        minute = 'HT';
      }
    } else if (state === 'post') {
      status = 'FINISHED';
      minute = competition.status?.type?.shortDetail || 'FT';
    }

    const homeScore = parseInt(homeComp.score || '0', 10) || 0;
    const awayScore = parseInt(awayComp.score || '0', 10) || 0;

    const getStat = (name: string, fallback: [number, number]): [number, number] => {
      const h = homeComp.statistics?.find((s) => s.name === name)?.displayValue;
      const a = awayComp.statistics?.find((s) => s.name === name)?.displayValue;
      if (h !== undefined && a !== undefined) {
        const valH = parseFloat(h.replace('%', ''));
        const valA = parseFloat(a.replace('%', ''));
        if (!isNaN(valH) && !isNaN(valA)) return [valH, valA];
      }
      return fallback;
    };

    const possession = getStat('possessionPct', [50, 50]);
    const shots = getStat('totalShots', getStat('shotsTotal', [0, 0]));
    const shotsOnTarget = getStat('shotsOnTarget', [0, 0]);
    const corners = getStat('wonCorners', getStat('corners', [0, 0]));
    const fouls = getStat('foulsCommitted', [0, 0]);
    const yellowCards = getStat('yellowCards', [0, 0]);
    const passes = getStat('totalPasses', [0, 0]);
    const passAccuracy = getStat('passPct', [0, 0]);

    const parsedEvents: MatchEvent[] = [];
    (competition.details || []).forEach((d, idx) => {
      const txt = (d.type?.text || '').toLowerCase();
      const isGoal = txt.includes('goal') || txt.includes('penalty - scored');
      const isYellow = txt.includes('yellow');
      const isRed = txt.includes('red');
      if (!isGoal && !isYellow && !isRed) return;
      const teamSide: 'home' | 'away' =
        homeComp.team?.id && d.team?.id === homeComp.team.id ? 'home' : 'away';
      parsedEvents.push({
        id: `espn-direct-${idx}`,
        type: isGoal ? 'goal' : isRed ? 'red_card' : 'yellow_card',
        minute: parseInt((d.clock?.displayValue || '0').replace(/[^0-9]/g, ''), 10) || 0,
        player:
          d.athletesInvolved?.[0]?.displayName ||
          (teamSide === 'home'
            ? homeComp.team?.shortDisplayName || 'Home'
            : awayComp.team?.shortDisplayName || 'Away'),
        team: teamSide,
        detail: d.type?.text || 'Match Event',
      });
    });

    let odds: MatchOdds | undefined;
    const rawOdds = competition.odds?.[0];
    if (rawOdds?.moneyline) {
      const h = americanToDecimal(rawOdds.moneyline.home?.close?.odds ?? rawOdds.moneyline.home?.open?.odds);
      const d = americanToDecimal(
        rawOdds.moneyline.draw?.close?.odds ?? rawOdds.moneyline.draw?.open?.odds ?? rawOdds.drawOdds?.moneyLine
      );
      const a = americanToDecimal(rawOdds.moneyline.away?.close?.odds ?? rawOdds.moneyline.away?.open?.odds);
      if (h && d && a) odds = { home: h, draw: d, away: a };
    }

    const eventDate = event.date ? new Date(event.date) : new Date();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const kickoffDate =
      eventDate.toDateString() === today.toDateString()
        ? 'Today'
        : eventDate.toDateString() === tomorrow.toDateString()
        ? 'Tomorrow'
        : eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const broadcastNames = (competition.broadcasts || []).flatMap((b) => b.names || []).filter(Boolean);
    const attendance =
      typeof competition.attendance === 'number' && competition.attendance > 0
        ? competition.attendance
        : undefined;

    return {
      id: event.id,
      tournament: event.league?.name || competition.notes?.[0]?.headline || event.season?.slug || 'World Football',
      stage: competition.type?.text || (status === 'LIVE' ? 'Live In-Play' : 'Official Fixture'),
      homeTeam: {
        name: homeComp.team?.displayName || 'Home Team',
        shortName: homeComp.team?.shortDisplayName || homeComp.team?.abbreviation || 'HOM',
        code: homeComp.team?.abbreviation || 'HOM',
        color: '#' + (homeComp.team?.color || 'ffffff'),
        accentColor: '#' + (homeComp.team?.alternateColor || '0055ff'),
        logo: homeComp.team?.logo || '⚽',
        country: homeComp.team?.location || 'Global',
      },
      awayTeam: {
        name: awayComp.team?.displayName || 'Away Team',
        shortName: awayComp.team?.shortDisplayName || awayComp.team?.abbreviation || 'AWY',
        code: awayComp.team?.abbreviation || 'AWY',
        color: '#' + (awayComp.team?.color || '00ff88'),
        accentColor: '#' + (awayComp.team?.alternateColor || '111420'),
        logo: awayComp.team?.logo || '⚽',
        country: awayComp.team?.location || 'Global',
      },
      score: { home: homeScore, away: awayScore },
      minute,
      liveClockSeconds: status === 'LIVE' ? clockSecs : undefined,
      status,
      kickoffTime:
        eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) +
        ' GMT',
      kickoffDate,
      kickoffIso: event.date || eventDate.toISOString(),
      leagueSlug: event.league?.slug,
      stadium: competition.venue?.fullName || 'TBD Venue',
      city: competition.venue?.address?.city || 'TBD',
      attendance,
      viewers: attendance ? `${attendance.toLocaleString()} Stadium Attendance` : undefined,
      streamQuality: '4K HDR',
      channels: broadcastNames.length > 0 ? broadcastNames : ['Official Broadcast Feed'],
      cameraAngles: [
        { name: 'Tactical Cam 1', description: 'Wide broadcast tactical flow' },
        { name: 'Director Cut 4K', description: 'Main broadcast production feed' },
        { name: 'Goal Line Cam', description: 'High frame-rate pitch replay' },
      ],
      commentaryTracks: [
        { language: 'English (Live)', commentator: 'World Feed Commentary' },
        { language: 'Stadium Atmos', commentator: 'Clean Pitch Audio' },
      ],
      events: parsedEvents,
      stats: {
        possession,
        shots,
        shotsOnTarget,
        xG: [
          Number((shotsOnTarget[0] * 0.28 + homeScore * 0.35).toFixed(2)),
          Number((shotsOnTarget[1] * 0.28 + awayScore * 0.35).toFixed(2)),
        ],
        corners,
        fouls,
        yellowCards,
        passes,
        passAccuracy,
      },
      odds,
    };
  } catch {
    return null;
  }
}

export function useLiveMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Syncing live telemetry...');
  const [source, setSource] = useState<string>('ESPN Live Global Telemetry');
  const [secondsUntilNextSync, setSecondsUntilNextSync] = useState<number>(15);
  const [liveSecondTick, setLiveSecondTick] = useState<number>(0);

  const syncCountdownRef = useRef<number>(15);
  const hasMatchesRef = useRef<boolean>(false);

  const fetchLiveMatches = useCallback(async () => {
    try {
      let fetchedMatches: Match[] = [];
      let feedSource = 'ESPN Live Satellite Global Telemetry';
      let fetchError: string | null = null;

      try {
        const res = await fetch('/api/live', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.matches) && data.matches.length > 0) {
            fetchedMatches = data.matches;
            feedSource = data.source || feedSource;
          } else if (data.error) {
            fetchError = data.error;
          }
        } else {
          fetchError = `Internal API route status: ${res.status}`;
        }
      } catch (err: unknown) {
        fetchError = err instanceof Error ? err.message : 'API Route unreachable';
      }

      if (fetchedMatches.length === 0) {
        try {
          const directRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard', {
            cache: 'no-store',
          });
          if (directRes.ok) {
            const espnData = (await directRes.json()) as { events?: RawEspnEvent[] };
            const parsed = (espnData.events || [])
              .map(transformDirectEspn)
              .filter((m): m is Match => m !== null);

            if (parsed.length > 0) {
              fetchedMatches = parsed;
              feedSource = 'Direct Live Satellite Stream (ESPN Public API)';
              fetchError = null;
            }
          }
        } catch {
          // Direct fetch unavailable
        }
      }

      if (fetchedMatches.length > 0) {
        hasMatchesRef.current = true;
        setMatches((prev) =>
          fetchedMatches.map((newM) => {
            const oldM = prev.find((p) => p.id === newM.id);
            if (newM.status === 'LIVE') {
              const currentSecs = oldM?.liveClockSeconds ?? parseClockToSeconds(newM.minute);
              return {
                ...newM,
                liveClockSeconds: currentSecs,
                minute: formatSecondsToClock(currentSecs),
              };
            }
            return newM;
          })
        );

        setIsLiveConnected(true);
        setError(null);
        setSource(feedSource);
        setLastSyncTime(
          new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      } else {
        if (!hasMatchesRef.current) {
          setError(fetchError || 'No live or scheduled matches returned from ESPN telemetry right now.');
        }
        setIsLiveConnected(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error connecting to live sports API.');
      setIsLiveConnected(false);
    } finally {
      setIsLoading(false);
      syncCountdownRef.current = 15;
      setSecondsUntilNextSync(15);
    }
  }, []);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      void fetchLiveMatches();
    }, 0);

    const secondInterval = setInterval(() => {
      setLiveSecondTick((t) => t + 1);

      syncCountdownRef.current -= 1;
      if (syncCountdownRef.current <= 0) {
        syncCountdownRef.current = 15;
        void fetchLiveMatches();
      }
      setSecondsUntilNextSync(syncCountdownRef.current);

      setMatches((prevMatches) => {
        if (prevMatches.length === 0) return prevMatches;
        return prevMatches.map((match) => {
          if (match.status !== 'LIVE') return match;
          const currentSeconds = (match.liveClockSeconds || parseClockToSeconds(match.minute)) + 1;
          return {
            ...match,
            liveClockSeconds: currentSeconds,
            minute: formatSecondsToClock(currentSeconds),
          };
        });
      });
    }, 1000);

    return () => {
      clearTimeout(initTimer);
      clearInterval(secondInterval);
    };
  }, [fetchLiveMatches]);

  return {
    matches,
    isLoading,
    isLiveConnected,
    error,
    lastSyncTime,
    source,
    refreshLiveScores: fetchLiveMatches,
    liveCount: matches.filter((m) => m.status === 'LIVE' || m.status === 'HT').length,
    totalCount: matches.length,
    secondsUntilNextSync,
    liveSecondTick,
  };
}
