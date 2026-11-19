'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Box,
  Gamepad2,
  Sparkles,
  Flame,
  Zap,
  Shield,
  Target,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import { Match } from '../../types/football';
import { TiltCard } from '../worldcup/TiltCard';
import { ParallaxMouseLayer } from '../common/ParallaxItem';

interface InteractiveMatchHubProps {
  activeMatch: Match | null;
  onAskTacticalAI: (prompt: string) => void;
}

type VoteChoice = 'HOME' | 'DRAW' | 'AWAY';

interface MatchVotes {
  HOME: number;
  DRAW: number;
  AWAY: number;
  userVote?: VoteChoice;
}

interface CrowdReactions {
  fire: number;
  pace: number;
  defense: number;
  clinical: number;
}

const VOTES_STORAGE_KEY = 'footylive_match_votes_v1';
const REACTIONS_STORAGE_KEY = 'footylive_match_reactions_v1';

const EMPTY_REACTIONS: CrowdReactions = {
  fire: 0,
  pace: 0,
  defense: 0,
  clinical: 0,
};

function getImpliedProbabilities(match: Match | null): {
  home: number;
  draw: number;
  away: number;
  fromOdds: boolean;
} {
  if (match?.odds && match.odds.home > 0 && match.odds.draw > 0 && match.odds.away > 0) {
    const rawH = 1 / match.odds.home;
    const rawD = 1 / match.odds.draw;
    const rawA = 1 / match.odds.away;
    const sum = rawH + rawD + rawA;
    const home = Math.round((rawH / sum) * 100);
    const draw = Math.round((rawD / sum) * 100);
    const away = Math.max(0, 100 - home - draw);
    return { home, draw, away, fromOdds: true };
  }
  return { home: 0, draw: 0, away: 0, fromOdds: false };
}

export const InteractiveMatchHub: React.FC<InteractiveMatchHubProps> = ({
  activeMatch,
  onAskTacticalAI,
}) => {
  const [votesByMatch, setVotesByMatch] = useState<Record<string, MatchVotes>>({});
  const [reactionsByMatch, setReactionsByMatch] = useState<Record<string, CrowdReactions>>({});
  const [lastReactionKey, setLastReactionKey] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const savedVotes = localStorage.getItem(VOTES_STORAGE_KEY);
        if (savedVotes) setVotesByMatch(JSON.parse(savedVotes));
        const savedReactions = localStorage.getItem(REACTIONS_STORAGE_KEY);
        if (savedReactions) setReactionsByMatch(JSON.parse(savedReactions));
      } catch {
        // Ignore storage errors
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const matchKey = activeMatch?.id ?? 'featured';
  const votes = votesByMatch[matchKey] ?? { HOME: 0, DRAW: 0, AWAY: 0 };
  const reactions = reactionsByMatch[matchKey] ?? EMPTY_REACTIONS;

  const totalUserVotes = votes.HOME + votes.DRAW + votes.AWAY;
  const implied = getImpliedProbabilities(activeMatch);

  const homePct =
    totalUserVotes > 0
      ? Math.round((votes.HOME / totalUserVotes) * 100)
      : implied.home;
  const drawPct =
    totalUserVotes > 0
      ? Math.round((votes.DRAW / totalUserVotes) * 100)
      : implied.draw;
  const awayPct =
    totalUserVotes > 0
      ? Math.max(0, 100 - homePct - drawPct)
      : implied.away;

  const handleVote = (choice: VoteChoice) => {
    setVotesByMatch((prev) => {
      const current = prev[matchKey] ?? { HOME: 0, DRAW: 0, AWAY: 0 };
      const next: MatchVotes = { ...current };
      if (current.userVote && current.userVote !== choice) {
        next[current.userVote] = Math.max(0, next[current.userVote] - 1);
      }
      if (current.userVote !== choice) {
        next[choice] += 1;
        next.userVote = choice;
      }
      const updated = { ...prev, [matchKey]: next };
      try {
        localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleReaction = (key: keyof CrowdReactions) => {
    setReactionsByMatch((prev) => {
      const current = prev[matchKey] ?? EMPTY_REACTIONS;
      const updated = {
        ...prev,
        [matchKey]: {
          ...current,
          [key]: current[key] + 1,
        },
      };
      try {
        localStorage.setItem(REACTIONS_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setLastReactionKey(key);
  };

  const homeLabel = activeMatch?.homeTeam.shortName || 'HOME';
  const awayLabel = activeMatch?.awayTeam.shortName || 'AWAY';
  const matchTitle = activeMatch
    ? `${activeMatch.homeTeam.name} vs ${activeMatch.awayTeam.name}`
    : 'Featured Match';

  return (
    <section
      id="interactive-match-hub"
      className="grid grid-cols-1 xl:grid-cols-12 gap-4"
      aria-label="Interactive Matchday Hub and 3D Experiences"
    >
      {/* Left: Live Match Predictor + Tactical AI Trigger + Match Vibe Reactions */}
      <div className="relative overflow-hidden xl:col-span-7 rounded-2xl border border-[#232838] bg-[#121622] p-4 sm:p-5 flex flex-col justify-between gap-4">
        <ParallaxMouseLayer
          depth={22}
          className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-[#00ff88]/8 blur-3xl"
        >
          <div className="h-full w-full" />
        </ParallaxMouseLayer>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00ff88]/15 border border-[#00ff88]/30 text-[#00ff88]">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black tracking-wide uppercase text-white">
                Interactive Matchday Pulse
              </h2>
              <p className="text-[11px] text-[#8b94a5]">
                {matchTitle} •{' '}
                {totalUserVotes > 0
                  ? `${totalUserVotes} your pick${totalUserVotes > 1 ? 's' : ''}`
                  : implied.fromOdds
                  ? 'Live ESPN Odds Win Probability'
                  : 'Cast your live prediction'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onAskTacticalAI(
                activeMatch
                  ? `Give me a crisp live tactical breakdown, recent form, and match prediction for ${activeMatch.homeTeam.name} vs ${activeMatch.awayTeam.name} in ${activeMatch.tournament}. Search for the latest team news and injuries.`
                  : 'Give me a tactical breakdown of the modern 4-3-3 high press vs 4-2-3-1 low block.'
              )
            }
            className="flex items-center gap-1.5 rounded-xl bg-[#00ff88] px-3 py-2 text-xs font-black text-black hover:bg-[#1fff98] transition-all shadow-[0_0_18px_rgba(0,255,136,0.28)]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Live Tactical Preview</span>
          </button>
        </div>

        {/* Predictor Vote Buttons */}
        <div className="grid grid-cols-3 gap-2.5">
          {(
            [
              { key: 'HOME' as const, label: `${homeLabel} Win`, pct: homePct, accent: '#00ff88' },
              { key: 'DRAW' as const, label: 'Draw', pct: drawPct, accent: '#9da7b8' },
              { key: 'AWAY' as const, label: `${awayLabel} Win`, pct: awayPct, accent: '#ff3355' },
            ] as const
          ).map((opt) => {
            const isSelected = votes.userVote === opt.key;
            return (
              <motion.button
                key={opt.key}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => handleVote(opt.key)}
                className={`relative overflow-hidden rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? 'border-[#00ff88] bg-[#17212f] shadow-[0_0_16px_rgba(0,255,136,0.16)]'
                    : 'border-[#242a3d] bg-[#0e111a] hover:border-[#39435f]'
                }`}
              >
                <div
                  className="absolute inset-y-0 left-0 opacity-15 transition-all duration-500"
                  style={{
                    width: `${opt.pct}%`,
                    backgroundColor: opt.accent,
                  }}
                />
                <div className="relative z-10 flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold text-[#c7d0df] truncate">
                    {opt.label}
                  </span>
                  {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-[#00ff88] shrink-0" />}
                </div>
                <div className="relative z-10 mt-1 text-base sm:text-lg font-black text-white font-mono">
                  {opt.pct > 0 ? `${opt.pct}%` : 'Pick'}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Live Match Momentum Reactions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#1c2233]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8b94a5]">
            Log Match Vibe:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: 'fire' as const, label: 'Goal Threat', icon: Flame, color: 'text-[#ff3355]' },
                { key: 'pace' as const, label: 'Counter Pace', icon: Zap, color: 'text-[#ffd166]' },
                { key: 'defense' as const, label: 'Lockdown', icon: Shield, color: 'text-[#3884ff]' },
                { key: 'clinical' as const, label: 'Clinical xG', icon: Target, color: 'text-[#00ff88]' },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const isJustTapped = lastReactionKey === item.key;
              return (
                <motion.button
                  key={item.key}
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleReaction(item.key)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    isJustTapped
                      ? 'border-[#00ff88]/60 bg-[#00ff88]/15 text-white'
                      : 'border-[#252c40] bg-[#0e111a] text-[#c0c7d5] hover:border-[#39435f] hover:text-white'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                  <span>{item.label}</span>
                  <span className="font-mono text-[10px] text-[#8b94a5]">
                    {reactions[item.key]}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: 3D Interactive Experience Cards with Tilt Parallax */}
      <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/tactical-3d" className="group block h-full">
          <TiltCard
            maxTilt={8}
            className="h-full rounded-2xl border border-[#00ff88]/35 bg-gradient-to-br from-[#121c22] via-[#121622] to-[#0e111a] p-4 sm:p-5 transition-all group-hover:border-[#00ff88] group-hover:shadow-[0_0_24px_rgba(0,255,136,0.18)]"
          >
            <div className="h-full flex flex-col justify-between gap-4">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00ff88]/15 border border-[#00ff88]/40 text-[#00ff88]">
                  <Box className="h-5 w-5" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-[#00ff88] px-2 py-0.5 text-[10px] font-black uppercase text-black">
                  3D WEBGL <ArrowUpRight className="h-3 w-3" />
                </span>
              </div>

              <div>
                <h3 className="text-sm font-black text-white group-hover:text-[#00ff88] transition-colors">
                  3D Tactical Stadium
                </h3>
                <p className="mt-1 text-xs text-[#9da7b8] leading-relaxed">
                  Orbit the 3D arena, explode roof tiers, switch 4-3-3 / 4-2-3-1 / 3-5-2 formations &amp; inspect all 22 players.
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold text-[#00ff88]">
                <span>Launch Tactical Explorer</span>
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </div>
          </TiltCard>
        </Link>

        <Link href="/penalty-arena" className="group block h-full">
          <TiltCard
            maxTilt={8}
            className="h-full rounded-2xl border border-[#2c3550] bg-gradient-to-br from-[#161a2b] via-[#121622] to-[#0e111a] p-4 sm:p-5 transition-all group-hover:border-[#3884ff] group-hover:shadow-[0_0_24px_rgba(56,132,255,0.2)]"
          >
            <div className="h-full flex flex-col justify-between gap-4">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0055FF]/20 border border-[#0055FF]/40 text-[#5497ff]">
                  <Gamepad2 className="h-5 w-5" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-[#0055FF]/25 border border-[#0055FF]/40 px-2 py-0.5 text-[10px] font-black uppercase text-[#7ab1ff]">
                  PLAYABLE <ArrowUpRight className="h-3 w-3" />
                </span>
              </div>

              <div>
                <h3 className="text-sm font-black text-white group-hover:text-[#7ab1ff] transition-colors">
                  3D Penalty Arena
                </h3>
                <p className="mt-1 text-xs text-[#9da7b8] leading-relaxed">
                  Step up to the spot in a 5-round shootout. Aim top bins, dial curve &amp; power, and beat the diving keeper.
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold text-[#7ab1ff]">
                <span>Enter Penalty Shootout</span>
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </div>
          </TiltCard>
        </Link>
      </div>
    </section>
  );
};
