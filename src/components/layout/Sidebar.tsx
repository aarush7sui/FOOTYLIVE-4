'use client';

import React from 'react';
import Link from 'next/link';
import {
  Home,
  Radio,
  Trophy,
  CalendarDays,
  GitBranch,
  PlaySquare,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Flame,
  ShieldCheck,
  Globe2,
  Tv2,
  Sliders,
  Settings,
  Gamepad2,
  MessageSquare,
  Box,
} from 'lucide-react';
import { Tournament } from '../../types/football';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectLeague: (leagueId: string) => void;
  selectedLeagueId?: string;
  tournaments: Tournament[];
  liveCount?: number;
  onOpenAllTournaments: () => void;
  onOpenChat?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  onSelectLeague,
  selectedLeagueId,
  tournaments,
  liveCount = 0,
  onOpenAllTournaments,
  onOpenChat,
}) => {
  const navItems = [
    { id: 'discover', label: 'Discover & Stream', icon: Home },
    {
      id: 'live',
      label: 'Live Now',
      icon: Radio,
      badge: liveCount > 0 ? `${liveCount} LIVE` : 'ESPN LIVE',
      badgeColor: liveCount > 0 ? 'bg-[#ff3355] text-white' : 'bg-[#1c2233] text-[#8b94a5]',
    },
    {
      id: 'tournaments',
      label: 'All Tournaments',
      icon: Trophy,
      badge: tournaments.length > 0 ? `${tournaments.length} LEAGUES` : 'WORLD',
      badgeColor: 'bg-[#00ff88]/20 text-[#00ff88]',
    },
    { id: 'schedule', label: 'Fixtures & Schedule', icon: CalendarDays },
    { id: 'bracket', label: 'Tournament Brackets', icon: GitBranch },
    { id: 'highlights', label: 'Highlights & VOD', icon: PlaySquare },
    { id: 'favorites', label: 'My Watchlist', icon: Bookmark },
  ];

  const featuredLeagues = tournaments.length > 0
    ? tournaments.slice(0, 8).map((t) => ({
        id: t.id,
        name: t.shortName || t.name,
        flag: t.flag,
        live: t.liveFixturesCount || 0,
        active: t.activeFixturesCount || 0,
      }))
    : [
        { id: 'uefa-champions-league', name: 'Champions League', flag: '⭐', live: 0, active: 0 },
        { id: 'premier-league', name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', live: 0, active: 0 },
        { id: 'la-liga', name: 'La Liga', flag: '🇪🇸', live: 0, active: 0 },
        { id: 'serie-a', name: 'Serie A', flag: '🇮🇹', live: 0, active: 0 },
        { id: 'bundesliga', name: 'Bundesliga', flag: '🇩🇪', live: 0, active: 0 },
        { id: 'fifa-world-cup-2026', name: 'World Cup 26', flag: '🌍', live: 0, active: 0 },
        { id: 'copa-libertadores', name: 'Libertadores', flag: '🏆', live: 0, active: 0 },
        { id: 'saudi-pro-league', name: 'Saudi Pro League', flag: '🇸🇦', live: 0, active: 0 },
      ];

  return (
    <aside
      className={`relative flex flex-col justify-between border-r border-[#1a1f2c] bg-[#0f1118] transition-all duration-300 z-30 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Header / Logo */}
      <div>
        <div className="flex h-16 items-center justify-between px-4 border-b border-[#1a1f2c]">
          <div
            onClick={() => onTabChange('discover')}
            className="flex items-center gap-3 cursor-pointer overflow-hidden"
          >
            <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#16121b] to-[#1c2233] border border-[#ff3355]/35 shadow-md group">
              <Tv2 className="h-5 w-5 text-[#00ff88] transition-transform group-hover:scale-110" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff3355] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ff3355]"></span>
              </span>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <div className="flex items-center tracking-wider font-black text-lg text-white">
                  FOOTY<span className="text-[#00ff88] ml-0.5">LIVE</span>
                </div>
                <span className="text-[9px] uppercase tracking-widest text-[#ff5c77] font-semibold -mt-1">
                  4K LIVE BROADCAST
                </span>
              </div>
            )}
          </div>

          <button
            onClick={onToggleCollapse}
            className="rounded-lg p-1.5 text-[#8b94a5] hover:bg-[#181d29] hover:text-[#f3f4f6] transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="p-3 space-y-1">
          <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#647188] ${isCollapsed ? 'text-center' : ''}`}>
            {isCollapsed ? '•••' : 'Main Menu'}
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all relative ${
                  isActive
                    ? 'bg-[#18202d] text-[#00ff88] border border-[#00ff88]/30 shadow-[0_0_12px_rgba(0,255,136,0.12)]'
                    : 'text-[#9da7b8] hover:bg-[#141824] hover:text-white'
                } ${isCollapsed ? 'justify-center' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon
                  className={`h-4 w-4 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-[#00ff88]' : 'text-[#8b94a5]'
                  }`}
                />
                {!isCollapsed && (
                  <div className="flex flex-1 items-center justify-between">
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                          item.badgeColor || 'bg-[#232838] text-[#c0c7d5]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
                {/* Active Neon Bar */}
                {isActive && (
                  <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md bg-[#00ff88]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Leagues Section */}
        <div className="p-3 pt-1 border-t border-[#1a1f2c]">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider text-[#647188] ${isCollapsed ? 'sr-only' : ''}`}>
              Top Leagues
            </span>
            {!isCollapsed && (
              <button
                onClick={onOpenAllTournaments}
                className="text-[10px] font-semibold text-[#00ff88] hover:underline"
              >
                Browse All
              </button>
            )}
          </div>
          <div className="space-y-1">
            {/* 3D Tactical Stadium Explorer Link */}
            <Link
              href="/tactical-3d"
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs border border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88] hover:bg-[#00ff88] hover:text-black transition-all ${
                isCollapsed ? 'justify-center' : ''
              }`}
              title="Open 3D Tactical Stadium Explorer"
            >
              <Box className="h-4 w-4 shrink-0" />
              {!isCollapsed && (
                <div className="flex flex-1 items-center justify-between">
                  <span className="font-bold">3D Tactical Stadium</span>
                  <span className="rounded bg-[#00ff88] px-1.5 py-0.2 text-[9px] font-black text-black">
                    3D VIEW
                  </span>
                </div>
              )}
            </Link>

            {/* 3D Penalty Arena Game Link */}
            <Link
              href="/penalty-arena"
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs border border-[#0055FF]/40 bg-[#0055FF]/15 text-[#7ab1ff] hover:bg-[#0055FF] hover:text-white transition-all ${
                isCollapsed ? 'justify-center' : ''
              }`}
              title="Play 3D Penalty Arena"
            >
              <Gamepad2 className="h-4 w-4 shrink-0" />
              {!isCollapsed && (
                <div className="flex flex-1 items-center justify-between">
                  <span className="font-bold">3D Penalty Arena</span>
                  <span className="rounded bg-[#0055FF] px-1.5 py-0.2 text-[9px] font-black text-white">
                    3D GAME
                  </span>
                </div>
              )}
            </Link>

            {/* FOOTYBot AI Trigger */}
            {onOpenChat && (
              <button
                onClick={onOpenChat}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs border border-[#2c3652] bg-[#141926] text-[#d6deeb] hover:border-[#00ff88]/50 hover:text-[#00ff88] transition-all ${
                  isCollapsed ? 'justify-center' : ''
                }`}
                title="Ask FOOTYBot (Football-Only AI)"
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-[#00ff88]" />
                {!isCollapsed && (
                  <div className="flex flex-1 items-center justify-between">
                    <span className="font-bold">FOOTYBot AI</span>
                    <span className="rounded bg-[#232b42] px-1.5 py-0.2 text-[9px] font-bold text-[#00ff88]">
                      FOOTBALL
                    </span>
                  </div>
                )}
              </button>
            )}

            {/* World Cup 2026 Daylight Experience Button */}
            <button
              onClick={() => {
                const el = document.getElementById('world-cup-2026-experience');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs border border-[#0055FF]/40 bg-[#0055FF]/15 text-[#5497ff] hover:bg-[#0055FF] hover:text-white transition-all ${
                isCollapsed ? 'justify-center' : ''
              }`}
              title="World Cup 2026 Daylight Experience"
            >
              <span className="text-sm">🌍</span>
              {!isCollapsed && (
                <div className="flex flex-1 items-center justify-between">
                  <span className="font-bold text-white">World Cup &apos;26</span>
                  <span className="rounded bg-[#FF3D00] px-1.5 py-0.2 text-[9px] font-black text-white">
                    DAYLIGHT
                  </span>
                </div>
              )}
            </button>

            {featuredLeagues.map((league) => {
              const isSelected = selectedLeagueId === league.id;
              return (
                <button
                  key={league.id}
                  onClick={() => onSelectLeague(league.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                    isSelected
                      ? 'bg-[#18202d] text-[#00ff88] font-bold border border-[#00ff88]/30'
                      : 'text-[#9da7b8] hover:bg-[#141824] hover:text-[#f3f4f6]'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                  title={isCollapsed ? league.name : undefined}
                >
                  <span className="text-sm">{league.flag}</span>
                  {!isCollapsed && (
                    <div className="flex flex-1 items-center justify-between gap-1.5 min-w-0">
                      <span className="truncate text-left">{league.name}</span>
                      {league.live > 0 ? (
                        <span className="rounded bg-[#ff3355] px-1 py-0.2 text-[9px] font-black text-white font-mono">
                          {league.live}
                        </span>
                      ) : league.active > 0 ? (
                        <span className="rounded bg-[#1a2233] px-1.5 py-0.2 text-[9px] font-mono text-[#00ff88]">
                          {league.active}
                        </span>
                      ) : null}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom VIP Subscription Pill */}
      <div className="p-3 border-t border-[#ff3355]/20 bg-[#0c0e14]">
        {!isCollapsed ? (
          <div className="rounded-xl border border-[#2b3347] border-t-[#ff3355]/45 bg-gradient-to-b from-[#171420] to-[#0e111a] p-3 text-left">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-black text-white">
                <ShieldCheck className="h-3.5 w-3.5 text-[#ff3355]" />
                FOOTYLIVE PRO
              </span>
              <span className="rounded bg-[#ff3355]/20 border border-[#ff3355]/40 px-1.5 py-0.5 text-[9px] font-bold text-[#ff5c77]">
                LIVE PASS
              </span>
            </div>
            <p className="text-[11px] text-[#8b94a5] mb-2 leading-tight">
              Streaming in 4K HDR 60fps with zero ads &amp; multi-angle camera feeds.
            </p>
            <button
              onClick={onOpenAllTournaments}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#00ff88] to-[#00e078] py-1.5 text-xs font-bold text-black transition-all hover:brightness-110 shadow-[0_0_12px_rgba(0,255,136,0.25)]"
            >
              <Globe2 className="h-3.5 w-3.5" />
              World Tournaments Hub
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAllTournaments}
            className="flex h-10 w-full items-center justify-center rounded-xl bg-[#00ff88]/10 text-[#00ff88] hover:bg-[#00ff88]/20 transition-colors"
            title="Explore All Tournaments"
          >
            <Globe2 className="h-5 w-5 text-[#00ff88]" />
          </button>
        )}
      </div>
    </aside>
  );
};
