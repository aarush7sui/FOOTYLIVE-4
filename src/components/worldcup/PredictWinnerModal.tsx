'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  BarChart3,
  X,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Flame,
  Shield,
} from 'lucide-react';

export type SimScenario = 'balanced' | 'host-boost' | 'chaos';

interface ContenderTeam {
  id: string;
  name: string;
  flag: string;
  confederation: string;
  elo: number;
  attack: number;
  defense: number;
  isHost?: boolean;
}

const CONTENDER_TEAMS: ContenderTeam[] = [
  { id: 'esp', name: 'Spain', flag: '🇪🇸', confederation: 'UEFA', elo: 2120, attack: 93, defense: 89 },
  { id: 'arg', name: 'Argentina', flag: '🇦🇷', confederation: 'CONMEBOL', elo: 2105, attack: 92, defense: 88 },
  { id: 'fra', name: 'France', flag: '🇫🇷', confederation: 'UEFA', elo: 2085, attack: 94, defense: 86 },
  { id: 'eng', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', confederation: 'UEFA', elo: 2055, attack: 90, defense: 86 },
  { id: 'bra', name: 'Brazil', flag: '🇧🇷', confederation: 'CONMEBOL', elo: 2030, attack: 91, defense: 84 },
  { id: 'ger', name: 'Germany', flag: '🇩🇪', confederation: 'UEFA', elo: 2010, attack: 88, defense: 85 },
  { id: 'ned', name: 'Netherlands', flag: '🇳🇱', confederation: 'UEFA', elo: 1975, attack: 85, defense: 87 },
  { id: 'por', name: 'Portugal', flag: '🇵🇹', confederation: 'UEFA', elo: 1970, attack: 88, defense: 84 },
  { id: 'col', name: 'Colombia', flag: '🇨🇴', confederation: 'CONMEBOL', elo: 1935, attack: 86, defense: 82 },
  { id: 'mar', name: 'Morocco', flag: '🇲🇦', confederation: 'CAF', elo: 1895, attack: 81, defense: 86 },
  { id: 'usa', name: 'United States', flag: '🇺🇸', confederation: 'CONCACAF', elo: 1860, attack: 80, defense: 80, isHost: true },
  { id: 'jpn', name: 'Japan', flag: '🇯🇵', confederation: 'AFC', elo: 1875, attack: 82, defense: 81 },
  { id: 'mex', name: 'Mexico', flag: '🇲🇽', confederation: 'CONCACAF', elo: 1835, attack: 79, defense: 79, isHost: true },
  { id: 'can', name: 'Canada', flag: '🇨🇦', confederation: 'CONCACAF', elo: 1810, attack: 79, defense: 77, isHost: true },
];

interface TeamSimStats {
  team: ContenderTeam;
  r16Pct: number;
  qfPct: number;
  sfPct: number;
  finalPct: number;
  winPct: number;
}

interface SimulationOutput {
  iterations: number;
  resultsById: Record<string, TeamSimStats>;
  ranked: TeamSimStats[];
}

// Deterministic seeded PRNG (Mulberry32) so initial render is crisp & hydration-safe,
// while "Re-Simulate" advances the seed cleanly for fresh simulation runs.
function createRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runTournamentSimulation(
  favoriteId: string,
  scenario: SimScenario,
  seed: number,
  iterations = 10000
): SimulationOutput {
  const rng = createRng(seed);
  const scaleDivisor = scenario === 'chaos' ? 560 : 390;

  // Pool of 16 knockout contenders (top 14 curated + 2 qualifier slots represented by Uruguay & Croatia strength)
  const pool = CONTENDER_TEAMS.map((t) => {
    let adjustedElo = t.elo;
    if (scenario === 'host-boost' && t.isHost) {
      adjustedElo += 115;
    }
    // Slight tactical morale boost for user's selected nation so toggling favorites visibly shifts bracket outcomes
    if (t.id === favoriteId) {
      adjustedElo += scenario === 'chaos' ? 55 : 35;
    }
    return { team: t, elo: adjustedElo };
  });

  const extraQualifiers = [
    { id: 'uru', elo: 1945 },
    { id: 'cro', elo: 1920 },
  ];

  const counts: Record<
    string,
    { r16: number; qf: number; sf: number; fin: number; win: number }
  > = {};
  CONTENDER_TEAMS.forEach((t) => {
    counts[t.id] = { r16: 0, qf: 0, sf: 0, fin: 0, win: 0 };
  });

  const playMatch = (aElo: number, bElo: number) => {
    const pA = 1 / (1 + Math.pow(10, (bElo - aElo) / scaleDivisor));
    return rng() < pA;
  };

  for (let sim = 0; sim < iterations; sim++) {
    // Construct 16-team knockout bracket with randomized seeding shuffle
    const bracket = [
      ...pool.map((p) => ({ id: p.team.id, elo: p.elo })),
      ...extraQualifiers,
    ];
    for (let i = bracket.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = bracket[i];
      bracket[i] = bracket[j];
      bracket[j] = tmp;
    }

    // Round of 16 -> Quarter-Finals (all 16 start in R16 knockout sim, weighted by group pass chance)
    const qfTeams: typeof bracket = [];
    for (let i = 0; i < 16; i += 2) {
      const a = bracket[i];
      const b = bracket[i + 1];
      if (counts[a.id]) counts[a.id].r16 += 1;
      if (counts[b.id]) counts[b.id].r16 += 1;
      const aWins = playMatch(a.elo, b.elo);
      qfTeams.push(aWins ? a : b);
    }

    // Quarter-Finals -> Semi-Finals
    const sfTeams: typeof bracket = [];
    for (let i = 0; i < 8; i += 2) {
      const a = qfTeams[i];
      const b = qfTeams[i + 1];
      if (counts[a.id]) counts[a.id].qf += 1;
      if (counts[b.id]) counts[b.id].qf += 1;
      const aWins = playMatch(a.elo, b.elo);
      sfTeams.push(aWins ? a : b);
    }

    // Semi-Finals -> Final
    const finalTeams: typeof bracket = [];
    for (let i = 0; i < 4; i += 2) {
      const a = sfTeams[i];
      const b = sfTeams[i + 1];
      if (counts[a.id]) counts[a.id].sf += 1;
      if (counts[b.id]) counts[b.id].sf += 1;
      const aWins = playMatch(a.elo, b.elo);
      finalTeams.push(aWins ? a : b);
    }

    // Grand Final
    const f1 = finalTeams[0];
    const f2 = finalTeams[1];
    if (counts[f1.id]) counts[f1.id].fin += 1;
    if (counts[f2.id]) counts[f2.id].fin += 1;
    const champ = playMatch(f1.elo, f2.elo) ? f1 : f2;
    if (counts[champ.id]) counts[champ.id].win += 1;
  }

  const resultsById: Record<string, TeamSimStats> = {};
  const ranked: TeamSimStats[] = CONTENDER_TEAMS.map((team) => {
    const c = counts[team.id];
    // Scale group-stage qualification probability realistically by Elo before R16
    const groupPassFactor = Math.min(0.98, Math.max(0.58, (team.elo - 1650) / 480));
    const entry: TeamSimStats = {
      team,
      r16Pct: Number((groupPassFactor * 100).toFixed(1)),
      qfPct: Number(((c.qf / iterations) * groupPassFactor * 100).toFixed(1)),
      sfPct: Number(((c.sf / iterations) * groupPassFactor * 100).toFixed(1)),
      finalPct: Number(((c.fin / iterations) * groupPassFactor * 100).toFixed(1)),
      winPct: Number(((c.win / iterations) * groupPassFactor * 100).toFixed(1)),
    };
    resultsById[team.id] = entry;
    return entry;
  }).sort((a, b) => b.winPct - a.winPct);

  return { iterations, resultsById, ranked };
}

interface PredictWinnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PredictWinnerModal: React.FC<PredictWinnerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>('esp');
  const [scenario, setScenario] = useState<SimScenario>('balanced');
  const [simSeed, setSimSeed] = useState<number>(2026);
  const [lockedPrediction, setLockedPrediction] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const simulation = useMemo(
    () => runTournamentSimulation(selectedTeamId, scenario, simSeed, 10000),
    [selectedTeamId, scenario, simSeed]
  );

  const selectedStats = simulation.resultsById[selectedTeamId] ?? simulation.ranked[0];

  // Top 6 nations + always include the user's selected favorite if outside Top 6
  const chartEntries = useMemo(() => {
    const top = simulation.ranked.slice(0, 6);
    if (top.some((entry) => entry.team.id === selectedTeamId)) {
      return top;
    }
    return [...top.slice(0, 5), selectedStats];
  }, [simulation.ranked, selectedTeamId, selectedStats]);

  const maxChartWinPct = Math.max(
    1,
    ...chartEntries.map((entry) => entry.winPct)
  );

  const handleRerun = useCallback(() => {
    setSimSeed((prev) => prev + 137);
  }, []);

  const handleLockPick = useCallback(() => {
    setLockedPrediction(selectedTeamId);
  }, [selectedTeamId]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A1128]/70 backdrop-blur-md p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="predict-winner-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-blue-100 bg-white text-[#0A1128] shadow-2xl"
          >
            {/* Header Bar */}
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur-md px-5 py-4 sm:px-7">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0055FF] to-[#0088FF] text-white shadow-md shadow-blue-500/25">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2
                      id="predict-winner-title"
                      className="text-lg sm:text-xl font-black uppercase tracking-tight text-[#0A1128]"
                    >
                      Predict the Winner
                    </h2>
                    <span className="rounded-full bg-[#FF3D00]/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#FF3D00]">
                      10,000 SIMS
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Pick your favorite nation to simulate World Cup 2026 title odds across hypothetical knockout brackets.
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:border-blue-300 hover:bg-blue-50 hover:text-[#0055FF] transition-colors"
                aria-label="Close Predict the Winner modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 sm:p-7 space-y-6">
              {/* Scenario Controls + Re-Simulate */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-[#F7F9FB] p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1">
                    Simulation Model:
                  </span>
                  {(
                    [
                      { id: 'balanced', label: 'Balanced Ratings' },
                      { id: 'host-boost', label: 'Host Nation Boost' },
                      { id: 'chaos', label: 'Underdog Chaos' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setScenario(item.id)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                        scenario === item.id
                          ? 'bg-[#0055FF] text-white shadow-sm shadow-blue-500/25'
                          : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-[#0055FF]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleRerun}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-blue-200 px-3.5 py-1.5 text-xs font-bold text-[#0055FF] shadow-sm hover:bg-blue-50 active:scale-95 transition-all"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Re-Run 10,000 Sims</span>
                </button>
              </div>

              {/* Favorite Team Selection Grid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    1. Select Your Favorite Nation
                  </h3>
                  <span className="font-mono text-[11px] text-slate-400">
                    14 Contenders • Click any flag
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {CONTENDER_TEAMS.map((team) => {
                    const isSelected = team.id === selectedTeamId;
                    const teamWinPct = simulation.resultsById[team.id]?.winPct ?? 0;
                    return (
                      <button
                        key={team.id}
                        onClick={() => setSelectedTeamId(team.id)}
                        className={`group flex flex-col items-center justify-center rounded-2xl border p-2.5 text-center transition-all ${
                          isSelected
                            ? 'border-[#0055FF] bg-blue-50/90 shadow-md shadow-blue-500/15 scale-[1.03]'
                            : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-2xl leading-none">{team.flag}</span>
                        <span
                          className={`mt-1.5 text-[11px] font-bold truncate w-full ${
                            isSelected ? 'text-[#0055FF]' : 'text-[#0A1128]'
                          }`}
                        >
                          {team.name}
                        </span>
                        <span className="font-mono text-[10px] font-semibold text-slate-500 tabular-nums">
                          {teamWinPct.toFixed(1)}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Two-Column Analytics: Contender Bar Chart + Selected Nation Deep Dive */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left: Tournament Win Probability Bar Chart */}
                <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-[#F7F9FB] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-tight text-[#0A1128] flex items-center gap-1.5">
                        <Trophy className="h-4 w-4 text-[#FF3D00]" />
                        <span>Championship Probability Chart</span>
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Share of 10,000 simulated tournaments won by each contender
                      </p>
                    </div>
                    <span className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 font-mono text-[10px] font-bold text-[#0055FF]">
                      ELO + KNOCKOUT
                    </span>
                  </div>

                  <div className="space-y-3 pt-1">
                    {chartEntries.map((entry, idx) => {
                      const isPick = entry.team.id === selectedTeamId;
                      const barWidthPct = Math.max(
                        6,
                        (entry.winPct / maxChartWinPct) * 100
                      );
                      return (
                        <div key={entry.team.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[11px] font-bold text-slate-400 w-4">
                                #{idx + 1}
                              </span>
                              <span className="text-base">{entry.team.flag}</span>
                              <span
                                className={`font-bold truncate ${
                                  isPick ? 'text-[#0055FF]' : 'text-[#0A1128]'
                                }`}
                              >
                                {entry.team.name}
                              </span>
                              {isPick && (
                                <span className="rounded bg-[#FF3D00] px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                                  YOUR PICK
                                </span>
                              )}
                            </div>
                            <span
                              className={`font-mono font-black tabular-nums ${
                                isPick ? 'text-[#0055FF]' : 'text-[#0A1128]'
                              }`}
                            >
                              {entry.winPct.toFixed(1)}%
                            </span>
                          </div>

                          <div className="h-3.5 w-full overflow-hidden rounded-full bg-slate-200/80 p-0.5">
                            <motion.div
                              initial={false}
                              animate={{ width: `${barWidthPct}%` }}
                              transition={{ type: 'spring', stiffness: 180, damping: 24 }}
                              className={`h-full rounded-full ${
                                isPick
                                  ? 'bg-gradient-to-r from-[#0055FF] to-[#FF3D00]'
                                  : 'bg-gradient-to-r from-[#0055FF]/85 to-[#38bdf8]'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Selected Team Stage Progression Bars & Ratings */}
                <div className="lg:col-span-5 rounded-2xl border border-blue-200 bg-gradient-to-b from-white to-blue-50/40 p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-4xl">{selectedStats.team.flag}</span>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-[#FF3D00]">
                            {selectedStats.team.confederation} • ELO {selectedStats.team.elo}
                          </div>
                          <h3 className="text-lg font-black text-[#0A1128]">
                            {selectedStats.team.name}
                          </h3>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold uppercase text-slate-500">
                          Title Odds
                        </div>
                        <div className="font-mono text-2xl font-black text-[#0055FF] tabular-nums">
                          {selectedStats.winPct.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Stage-by-Stage Survival Probability Bars */}
                    <div className="space-y-2.5">
                      <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                        Knockout Path Probability
                      </div>
                      {[
                        { label: 'Reach Round of 16', pct: selectedStats.r16Pct },
                        { label: 'Reach Quarter-Finals', pct: selectedStats.qfPct },
                        { label: 'Reach Semi-Finals', pct: selectedStats.sfPct },
                        { label: 'Reach Grand Final', pct: selectedStats.finalPct },
                        { label: 'Lift Trophy 🏆', pct: selectedStats.winPct },
                      ].map((stage) => (
                        <div key={stage.label} className="space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span className="text-slate-600">{stage.label}</span>
                            <span className="font-mono font-bold text-[#0A1128] tabular-nums">
                              {stage.pct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
                            <motion.div
                              initial={false}
                              animate={{ width: `${Math.max(2, stage.pct)}%` }}
                              transition={{ type: 'spring', stiffness: 180, damping: 24 }}
                              className="h-full rounded-full bg-[#0055FF]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Attack vs Defense Mini Metrics */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5 flex items-center gap-2">
                        <Flame className="h-4 w-4 text-[#FF3D00]" />
                        <div>
                          <div className="text-[10px] font-semibold text-slate-500">
                            Attack Index
                          </div>
                          <div className="font-mono text-sm font-black text-[#0A1128] tabular-nums">
                            {selectedStats.team.attack} / 99
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-[#0055FF]" />
                        <div>
                          <div className="text-[10px] font-semibold text-slate-500">
                            Defense Index
                          </div>
                          <div className="font-mono text-sm font-black text-[#0A1128] tabular-nums">
                            {selectedStats.team.defense} / 99
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lock In Prediction CTA */}
                  <div className="pt-2">
                    <button
                      onClick={handleLockPick}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-black uppercase tracking-wider transition-all ${
                        lockedPrediction === selectedTeamId
                          ? 'bg-[#00ff88] text-[#0A1128] shadow-md'
                          : 'bg-[#0055FF] text-white shadow-lg shadow-blue-600/25 hover:bg-[#0047db]'
                      }`}
                    >
                      {lockedPrediction === selectedTeamId ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Prediction Locked: {selectedStats.team.name}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 text-[#FF3D00]" />
                          <span>Lock {selectedStats.team.name} as Champion</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
