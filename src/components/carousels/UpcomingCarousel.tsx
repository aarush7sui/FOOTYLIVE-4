'use client';

import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TeamLogo } from '../common/TeamLogo';
import { TiltCard } from '../worldcup/TiltCard';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Bell,
  BellRing,
  BellOff,
  Clock,
  Timer,
} from 'lucide-react';
import { Match } from '../../types/football';
import {
  MatchReminder,
  BrowserPermissionState,
  formatCountdown,
} from '../../hooks/useMatchReminders';

interface UpcomingCarouselProps {
  matches: Match[];
  onSelectMatch: (match: Match) => void;
  reminders: Record<string, MatchReminder>;
  permission: BrowserPermissionState;
  nowMs: number;
  onToggleReminder: (match: Match) => void;
  onArmTestReminder: (match: Match, delaySeconds?: number) => void;
  onRequestPermission: () => void;
}

export const UpcomingCarousel: React.FC<UpcomingCarouselProps> = ({
  matches,
  onSelectMatch,
  reminders,
  permission,
  nowMs,
  onToggleReminder,
  onArmTestReminder,
  onRequestPermission,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedFilter, setSelectedFilter] = useState('ALL');

  const upcomingMatches = matches.filter((m) => m.status === 'UPCOMING');

  // Dynamically derive filter tabs from real scheduled competitions
  const tournamentNames = Array.from(new Set(upcomingMatches.map((m) => m.tournament))).slice(0, 6);
  const filterTabs = [
    { id: 'ALL', label: `All Upcoming (${upcomingMatches.length})` },
    { id: 'Today', label: 'Today' },
    { id: 'Tomorrow', label: 'Tomorrow' },
    ...tournamentNames.map((name) => ({ id: name, label: name })),
  ];

  const filtered = upcomingMatches.filter((m) => {
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'Today' || selectedFilter === 'Tomorrow') {
      return m.kickoffDate === selectedFilter;
    }
    return m.tournament === selectedFilter;
  });

  const armedCount = Object.values(reminders).filter((r) => !r.fired).length;

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -380 : 380;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <section className="space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00ff88]/20 border border-[#00ff88]/40 shadow-[0_0_10px_rgba(0,255,136,0.2)]">
            <CalendarDays className="h-4 w-4 text-[#00ff88]" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-white flex flex-wrap items-center gap-2">
              UPCOMING FIXTURES
              <span className="rounded-full bg-[#1c2233] px-2 py-0.5 text-[10px] font-bold text-[#00ff88] font-mono">
                {upcomingMatches.length} SCHEDULED
              </span>
              {armedCount > 0 && (
                <span className="rounded-full bg-[#00ff88]/15 border border-[#00ff88]/40 px-2 py-0.5 text-[10px] font-bold text-[#00ff88] font-mono">
                  {armedCount} ALERT{armedCount > 1 ? 'S' : ''} ARMED
                </span>
              )}
            </h2>
            <p className="text-xs text-[#8b94a5]">
              Live ESPN schedules — arm &quot;Remind Me&quot; for an automatic browser kickoff notification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Browser Notification Permission Button */}
          {permission === 'default' && (
            <button
              type="button"
              onClick={onRequestPermission}
              className="flex items-center gap-1.5 rounded-lg border border-[#00ff88]/40 bg-[#00ff88]/10 px-2.5 py-1.5 text-[11px] font-bold text-[#00ff88] hover:bg-[#00ff88]/20 transition-colors"
            >
              <Bell className="h-3.5 w-3.5" />
              <span>Enable Browser Alerts</span>
            </button>
          )}
          {permission === 'granted' && (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#00ff88]/30 bg-[#00ff88]/10 px-2.5 py-1.5 text-[11px] font-bold text-[#00ff88]">
              <BellRing className="h-3.5 w-3.5" />
              <span>Notifications Active</span>
            </span>
          )}
          {permission === 'denied' && (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-950/30 px-2.5 py-1.5 text-[11px] font-bold text-amber-300"
              title="Browser notifications are blocked; in-app kickoff banners and sound chimes remain active"
            >
              <BellOff className="h-3.5 w-3.5" />
              <span>In-App Alerts Only</span>
            </span>
          )}

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => scroll('left')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#222838] bg-[#12151e] text-[#8b94a5] hover:border-[#00ff88]/50 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => scroll('right')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#222838] bg-[#12151e] text-[#8b94a5] hover:border-[#00ff88]/50 hover:text-white transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      {/* Filter Tabs with Framer Motion Sliding Pill */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {filterTabs.map((tab) => {
          const isActive = selectedFilter === tab.id;
          return (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setSelectedFilter(tab.id)}
              className="relative whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all"
            >
              {isActive && (
                <motion.div
                  layoutId="activeUpcomingPill"
                  className="absolute inset-0 rounded-lg bg-[#00ff88] shadow-[0_0_12px_rgba(0,255,136,0.35)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <span className={`relative z-10 ${isActive ? 'text-black' : 'text-[#8b94a5] hover:text-white'}`}>
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Carousel */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#222736] bg-[#131620] p-6 text-center text-xs text-[#8b94a5]">
          No scheduled upcoming matches found for this filter in the live ESPN feed right now.
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto no-scrollbar pb-3 scroll-smooth"
        >
          {filtered.map((match) => {
            const reminder = reminders[match.id];
            const isArmed = Boolean(reminder && !reminder.fired);
            const countdownLabel =
              reminder && nowMs > 0
                ? formatCountdown(reminder.kickoffIso, nowMs)
                : match.kickoffIso && nowMs > 0
                ? formatCountdown(match.kickoffIso, nowMs)
                : `${match.kickoffDate} ${match.kickoffTime}`;

            return (
              <TiltCard
                key={match.id}
                maxTilt={6}
                onClick={() => onSelectMatch(match)}
                className="group flex w-[320px] sm:w-[360px] flex-shrink-0 flex-col justify-between border border-[#222736] bg-[#131620] p-4 hover:border-[#00ff88]/50 hover:bg-[#181c28]"
              >
                <div>
                  {/* Top Badge: Tournament & Kickoff Date */}
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <span className="text-[11px] font-bold text-[#8b94a5] truncate max-w-[165px]">
                      {match.tournament}
                    </span>
                    <div className="flex items-center gap-1.5 rounded-md bg-[#19202f] px-2 py-0.5 text-[11px] font-mono text-[#00ff88]">
                      <Clock className="h-3 w-3" />
                      <span>{match.kickoffDate} {match.kickoffTime}</span>
                    </div>
                  </div>

                  {/* Teams Card */}
                  <div className="rounded-xl bg-[#0c0e14] border border-[#1f2434] p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <TeamLogo logo={match.homeTeam.logo} name={match.homeTeam.name} className="h-6 w-6" />
                        <span className="text-sm font-bold text-white truncate max-w-[170px]">{match.homeTeam.name}</span>
                      </div>
                      {match.odds && (
                        <span className="text-xs font-mono font-bold text-[#8b94a5]">
                          {match.odds.home}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-mono text-[#647188]">KICKOFF</span>
                      <span className="rounded bg-[#1a2030] px-2.5 py-0.5 text-[10px] font-black uppercase text-[#8b94a5] font-mono">
                        VS
                      </span>
                      <span className="text-[10px] font-mono text-[#00ff88]">
                        {countdownLabel}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <TeamLogo logo={match.awayTeam.logo} name={match.awayTeam.name} className="h-6 w-6" />
                        <span className="text-sm font-bold text-white truncate max-w-[170px]">{match.awayTeam.name}</span>
                      </div>
                      {match.odds && (
                        <span className="text-xs font-mono font-bold text-[#8b94a5]">
                          {match.odds.away}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stadium Venue */}
                  <div className="mt-3 text-[11px] text-[#8b94a5] truncate">
                    📍 {match.stadium}{match.city && match.city !== 'TBD' ? `, ${match.city}` : ''}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-[#1c2232] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleReminder(match);
                      }}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                        isArmed
                          ? 'bg-[#00ff88]/20 border border-[#00ff88]/50 text-[#00ff88]'
                          : reminder?.fired
                          ? 'bg-[#0055FF]/20 border border-[#0055FF]/50 text-[#7ab1ff]'
                          : 'bg-[#1b2233] text-[#8b94a5] hover:text-white'
                      }`}
                    >
                      {isArmed ? (
                        <BellRing className="h-3.5 w-3.5 text-[#00ff88] animate-pulse" />
                      ) : (
                        <Bell className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {isArmed
                          ? `Armed • ${countdownLabel}`
                          : reminder?.fired
                          ? 'Kickoff Notified'
                          : 'Remind Me'}
                      </span>
                    </motion.button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onArmTestReminder(match, 5);
                      }}
                      className="flex items-center gap-1 rounded-lg border border-[#283148] bg-[#141824] px-2 py-1.5 text-[10px] font-mono font-bold text-[#8b94a5] hover:border-[#00ff88]/40 hover:text-[#00ff88] transition-colors"
                      title="Trigger a test browser kickoff notification for this match in 5 seconds"
                    >
                      <Timer className="h-3 w-3" />
                      <span>5s Test</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    className="text-xs font-bold text-[#00ff88] hover:underline whitespace-nowrap"
                  >
                    Intel →
                  </button>
                </div>
              </TiltCard>
            );
          })}
        </div>
      )}
    </section>
  );
};
