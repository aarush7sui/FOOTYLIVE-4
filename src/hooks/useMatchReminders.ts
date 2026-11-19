'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Match } from '../types/football';

export interface MatchReminder {
  matchId: string;
  homeName: string;
  awayName: string;
  homeLogo?: string;
  awayLogo?: string;
  tournament: string;
  stadium: string;
  kickoffIso: string;
  isTest?: boolean;
  fired?: boolean;
}

export type BrowserPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

const STORAGE_KEY = 'footylive_match_reminders_v1';

function playKickoffChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [587.33, 880]; // Crisp D5 -> A5 broadcast chime
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.14);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + idx * 0.14 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.14 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.14);
      osc.stop(ctx.currentTime + idx * 0.14 + 0.36);
    });
  } catch {
    // Audio playback blocked before interaction or unsupported
  }
}

function sendBrowserNotification(
  reminder: MatchReminder,
  onClickFocus?: (matchId: string) => void
) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const notif = new Notification(`⚽ KICKOFF: ${reminder.homeName} vs ${reminder.awayName}`, {
      body: `${reminder.tournament} is starting now at ${reminder.stadium}. Click to open FOOTYLive.`,
      icon: '/favicon.ico',
      tag: `footylive-kickoff-${reminder.matchId}`,
      requireInteraction: false,
    });
    notif.onclick = () => {
      window.focus();
      onClickFocus?.(reminder.matchId);
      notif.close();
    };
  } catch {
    // Notification constructor may fail inside restricted contexts; in-app banner still alerts user
  }
}

export function formatCountdown(targetIso: string, nowMs: number): string {
  const diffMs = Date.parse(targetIso) - nowMs;
  if (isNaN(diffMs)) return 'Scheduled';
  if (diffMs <= 0) return 'Kickoff!';

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days > 0) return `T-${days}d ${hours}h`;
  if (hours > 0) return `T-${hours}h ${mins.toString().padStart(2, '0')}m`;
  if (mins > 0) return `T-${mins}m ${secs.toString().padStart(2, '0')}s`;
  return `T-${secs}s`;
}

export function useMatchReminders(onKickoffFocus?: (matchId: string) => void) {
  const [reminders, setReminders] = useState<Record<string, MatchReminder>>({});
  const [permission, setPermission] = useState<BrowserPermissionState>('default');
  const [nowMs, setNowMs] = useState<number>(0);
  const [activeKickoffAlert, setActiveKickoffAlert] = useState<MatchReminder | null>(null);
  const focusCbRef = useRef(onKickoffFocus);

  useEffect(() => {
    focusCbRef.current = onKickoffFocus;
  }, [onKickoffFocus]);

  // Hydrate persisted reminders and current permission asynchronously after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setNowMs(Date.now());
      if (typeof window !== 'undefined') {
        if (!('Notification' in window)) {
          setPermission('unsupported');
        } else {
          setPermission(Notification.permission);
        }
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved) as Record<string, MatchReminder>;
            setReminders(parsed);
          }
        } catch {
          // Ignore malformed localStorage
        }
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Persist reminders whenever they change
  const persist = useCallback((next: Record<string, MatchReminder>) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const requestNotificationPermission = useCallback(async (): Promise<BrowserPermissionState> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return 'unsupported';
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      return Notification.permission;
    }
  }, []);

  const toggleReminder = useCallback(
    async (match: Match) => {
      if (reminders[match.id]) {
        const next = { ...reminders };
        delete next[match.id];
        setReminders(next);
        persist(next);
        return;
      }

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        await requestNotificationPermission();
      }

      const kickoffIso =
        match.kickoffIso && !isNaN(Date.parse(match.kickoffIso))
          ? match.kickoffIso
          : new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const entry: MatchReminder = {
        matchId: match.id,
        homeName: match.homeTeam.name,
        awayName: match.awayTeam.name,
        homeLogo: match.homeTeam.logo,
        awayLogo: match.awayTeam.logo,
        tournament: match.tournament,
        stadium: match.stadium,
        kickoffIso,
        fired: false,
      };

      const next = { ...reminders, [match.id]: entry };
      setReminders(next);
      persist(next);
    },
    [reminders, persist, requestNotificationPermission]
  );

  const armTestReminder = useCallback(
    async (match: Match, delaySeconds = 5) => {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        await requestNotificationPermission();
      }

      const kickoffIso = new Date(Date.now() + delaySeconds * 1000).toISOString();
      const entry: MatchReminder = {
        matchId: match.id,
        homeName: match.homeTeam.name,
        awayName: match.awayTeam.name,
        homeLogo: match.homeTeam.logo,
        awayLogo: match.awayTeam.logo,
        tournament: match.tournament,
        stadium: match.stadium,
        kickoffIso,
        isTest: true,
        fired: false,
      };

      const next = { ...reminders, [match.id]: entry };
      setReminders(next);
      persist(next);
    },
    [reminders, persist, requestNotificationPermission]
  );

  const dismissKickoffAlert = useCallback(() => {
    setActiveKickoffAlert(null);
  }, []);

  // 1-second timer to update countdowns and trigger native browser notification at kickoff
  useEffect(() => {
    const interval = setInterval(() => {
      const current = Date.now();
      setNowMs(current);

      setReminders((prev) => {
        let changed = false;
        const next: Record<string, MatchReminder> = { ...prev };

        for (const [id, rem] of Object.entries(prev)) {
          if (rem.fired) continue;
          const target = Date.parse(rem.kickoffIso);
          if (!isNaN(target) && current >= target) {
            changed = true;
            const firedReminder: MatchReminder = { ...rem, fired: true };
            next[id] = firedReminder;
            playKickoffChime();
            sendBrowserNotification(firedReminder, focusCbRef.current);
            setActiveKickoffAlert(firedReminder);
          }
        }

        if (changed) {
          persist(next);
          return next;
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [persist]);

  return {
    reminders,
    permission,
    nowMs,
    activeKickoffAlert,
    requestNotificationPermission,
    toggleReminder,
    armTestReminder,
    dismissKickoffAlert,
  };
}
