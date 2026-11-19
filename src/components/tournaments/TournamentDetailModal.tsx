'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Trophy,
  Globe,
  Radio,
  RefreshCw,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { Tournament, StandingItem } from '../../types/football';
import { TeamLogo } from '../common/TeamLogo';
import { StandingsSkeleton } from '../common/LoadingSkeletons';

interface TournamentDetailModalProps {
  tournament: Tournament | null;
  onClose: () => void;
  onSelectMatchFixture?: (home: string, away: string) => void;
}

interface LiveLeagueStanding extends StandingItem {
  gf?: number;
  ga?: number;
  streak?: string;
}

interface LiveLeagueFixture {
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
}

interface LiveMatchScorer {
  name: string;
  team: string;
  goals: number;
}

interface AttackingClubRow {
  rank: number;
  team: string;
  logo?: string;
  goalsFor: number;
  goalsAgainst: number;
  gd: number;
  played: number;
  points: number;
}

export const TournamentDetailModal: React.FC<TournamentDetailModalProps> = ({
  tournament,
  onClose,
  onSelectMatchFixture,
}) => {
  const [activeTab, setActiveTab] = useState<'standings' | 'fixtures' | 'scorers' | 'info'>('standings');
  const [liveStandings, setLiveStandings] = useState<LiveLeagueStanding[]>([]);
  const [fixtures, setFixtures] = useState<LiveLeagueFixture[]>([]);
  const [scorers, setScorers] = useState<LiveMatchScorer[]>([]);
  const [attackingClubs, setAttackingClubs] = useState<AttackingClubRow[]>([]);
  const [isLoadingStandings, setIsLoadingStandings] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStandings = useCallback(async () => {
    if (!tournament) return;
    try {
      setIsLoadingStandings(true);
      setError(null);
      const res = await fetch(`/api/standings?league=${tournament.id}`);
      const data = await res.json();
      if (!res.ok && !data.success) {
        throw new Error(data.error || `Standings telemetry responded with status ${res.status}`);
      }
      setLiveStandings(Array.isArray(data.standings) ? data.standings : []);
      setFixtures(Array.isArray(data.fixtures) ? data.fixtures : []);
      setScorers(Array.isArray(data.scorers) ? data.scorers : []);
      setAttackingClubs(Array.isArray(data.attackingClubs) ? data.attackingClubs : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to connect to live standings feed');
      setLiveStandings([]);
      setFixtures([]);
      setScorers([]);
      setAttackingClubs([]);
    } finally {
      setIsLoadingStandings(false);
    }
  }, [tournament]);

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchStandings();
    }, 0);
    return () => clearTimeout(t);
  }, [fetchStandings]);

  if (!tournament) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-[#262c3e] bg-[#0f121b] shadow-2xl overflow-hidden"
        >
          {/* Modal Header */}
          <div className="relative border-b border-[#1c2233] bg-gradient-to-r from-[#141825] via-[#10141f] to-[#171c2c] p-5 sm:p-6">
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="absolute top-4 right-4 rounded-xl border border-white/10 bg-black/40 p-2 text-[#8b94a5] hover:text-white hover:border-[#00ff88]/50 transition-colors"
            >
              <X className="h-5 w-5" />
            </motion.button>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1c2234] border border-[#2b3348] text-3xl shadow-inner">
                {tournament.flag}
              </div>

              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-md bg-[#00ff88]/20 border border-[#00ff88]/30 px-2 py-0.5 text-[10px] font-black uppercase text-[#00ff88] font-mono">
                    {tournament.confederation} • {tournament.tier}
                  </span>
                  <span className="text-xs text-[#8b94a5]">{tournament.region}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {tournament.name}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#8b94a5] mt-1 font-mono">
                  <span>Season: <strong className="text-white">{tournament.currentSeason}</strong></span>
                  <span>•</span>
                  <span>Status: <strong className="text-[#00ff88]">{tournament.currentPhase}</strong></span>
                  <span>•</span>
                  <span>Champion / Title: <strong className="text-white">🏆 {tournament.defendingChampion}</strong></span>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 mt-5 border-t border-[#1e2436] pt-3 overflow-x-auto no-scrollbar">
              {[
                { id: 'standings' as const, label: 'League Table & Standings' },
                { id: 'fixtures' as const, label: `Fixtures & Results (${fixtures.length})` },
                { id: 'scorers' as const, label: 'Attack & Goal Leaders' },
                { id: 'info' as const, label: 'Tournament Overview' },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setActiveTab(tab.id)}
                    className="relative rounded-lg px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-all"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeModalTab"
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
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-4">
            {/* Standings Tab */}
            {activeTab === 'standings' && (
              <div>
                {isLoadingStandings && <StandingsSkeleton />}

                {!isLoadingStandings && error && (
                  <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-6 text-center">
                    <AlertCircle className="h-6 w-6 text-red-400 mx-auto mb-2" />
                    <p className="text-xs text-red-300 font-mono mb-3">{error}</p>
                    <button
                      onClick={() => void fetchStandings()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs text-red-300 font-bold transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Reconnect to Live Standings Feed
                    </button>
                  </div>
                )}

                {!isLoadingStandings && !error && liveStandings.length === 0 && (
                  <div className="rounded-xl border border-[#232838] bg-[#121520] p-6 text-center text-xs text-[#8b94a5]">
                    ESPN does not publish a live league table for this knockout stage right now. Switch to Fixtures &amp; Results to view live matches.
                  </div>
                )}

                {!isLoadingStandings && !error && liveStandings.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#202738] text-[11px] font-bold uppercase text-[#8b94a5] font-mono">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Club</th>
                          <th className="py-2.5 px-3 text-center">P</th>
                          <th className="py-2.5 px-3 text-center">W</th>
                          <th className="py-2.5 px-3 text-center">D</th>
                          <th className="py-2.5 px-3 text-center">L</th>
                          <th className="py-2.5 px-3 text-center">GF/GA</th>
                          <th className="py-2.5 px-3 text-center">GD</th>
                          <th className="py-2.5 px-3 text-center font-bold text-white">PTS</th>
                          <th className="py-2.5 px-3 text-center">Form / Streak</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveStandings.map((row) => (
                          <tr
                            key={row.team}
                            className="border-b border-[#181d2c] hover:bg-[#151926] transition-colors"
                          >
                            <td className="py-2.5 px-3 font-mono font-bold text-[#8b94a5]">
                              <span
                                className={`inline-flex h-5 w-5 items-center justify-center rounded ${
                                  row.rank <= 4
                                    ? 'bg-[#00ff88]/20 text-[#00ff88] font-bold'
                                    : 'text-[#8b94a5]'
                                }`}
                              >
                                {row.rank}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2.5">
                                <TeamLogo logo={row.logo} name={row.team} className="h-5 w-5" />
                                <span className="font-bold text-white truncate max-w-[150px] sm:max-w-[200px]">
                                  {row.team}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-[#8b94a5]">{row.played}</td>
                            <td className="py-2.5 px-3 text-center font-mono text-[#8b94a5]">{row.won}</td>
                            <td className="py-2.5 px-3 text-center font-mono text-[#8b94a5]">{row.drawn}</td>
                            <td className="py-2.5 px-3 text-center font-mono text-[#8b94a5]">{row.lost}</td>
                            <td className="py-2.5 px-3 text-center font-mono text-[#8b94a5]">
                              {row.gf ?? 0}:{row.ga ?? 0}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-[#8b94a5]">
                              {row.gd > 0 ? `+${row.gd}` : row.gd}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-black text-white text-sm">
                              {row.points}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {row.form && row.form.length > 0 ? (
                                <div className="flex items-center justify-center gap-1">
                                  {row.form.map((res, i) => (
                                    <span
                                      key={i}
                                      className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-black font-mono ${
                                        res === 'W'
                                          ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/40'
                                          : res === 'D'
                                          ? 'bg-[#ffaa00]/20 text-[#ffaa00] border border-[#ffaa00]/40'
                                          : 'bg-red-500/20 text-red-400 border border-red-500/40'
                                      }`}
                                    >
                                      {res}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="font-mono text-[11px] text-[#00ff88]">
                                  {row.streak || '—'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Real Live Fixtures Tab */}
            {activeTab === 'fixtures' && (
              <div className="space-y-3">
                <div className="rounded-xl border border-[#232838] bg-[#121520] p-4">
                  <div className="flex items-center justify-between mb-3 text-xs text-[#8b94a5] font-mono">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[#00ff88]" />
                      Official Live ESPN Scoreboard Fixtures
                    </span>
                    <span className="text-[#00ff88]">{fixtures.length} Listed</span>
                  </div>

                  {fixtures.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#8b94a5]">
                      No active or scheduled fixtures returned by ESPN for this competition today.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {fixtures.map((fixture) => (
                        <button
                          key={fixture.id}
                          type="button"
                          onClick={() => onSelectMatchFixture?.(fixture.homeTeam, fixture.awayTeam)}
                          className="w-full text-left flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-[#161a27] border border-[#202638] hover:border-[#00ff88]/40 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <TeamLogo logo={fixture.homeLogo} name={fixture.homeTeam} className="h-4 w-4" />
                              <span className="text-xs font-bold text-white">{fixture.homeTeam}</span>
                            </div>
                            <span className="text-[10px] font-mono text-[#00ff88] bg-[#00ff88]/10 px-1.5 py-0.5 rounded">
                              {fixture.score || 'VS'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <TeamLogo logo={fixture.awayLogo} name={fixture.awayTeam} className="h-4 w-4" />
                              <span className="text-xs font-bold text-white">{fixture.awayTeam}</span>
                            </div>
                          </div>
                          <div className="text-[11px] font-mono text-[#8b94a5]">
                            {fixture.date} • {fixture.time} • {fixture.stadium}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Real Scorers & Attacking Clubs Tab */}
            {activeTab === 'scorers' && (
              <div className="space-y-4">
                {scorers.length > 0 && (
                  <div className="rounded-xl border border-[#232838] bg-[#121520] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="h-4 w-4 text-[#ffaa00]" />
                      <h3 className="text-xs font-bold uppercase text-white font-mono">
                        Live Matchday Goalscorers
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {scorers.map((scorer, idx) => (
                        <div
                          key={`${scorer.name}-${scorer.team}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-[#161a27] border border-[#202638]"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-xs text-[#00ff88]">#{idx + 1}</span>
                            <div>
                              <div className="text-xs font-bold text-white">{scorer.name}</div>
                              <div className="text-[10px] text-[#8b94a5]">{scorer.team}</div>
                            </div>
                          </div>
                          <div className="font-mono text-xs text-white">
                            <strong className="text-[#00ff88] text-sm">{scorer.goals}</strong> goal{scorer.goals > 1 ? 's' : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-[#232838] bg-[#121520] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="h-4 w-4 text-[#00ff88]" />
                    <h3 className="text-xs font-bold uppercase text-white font-mono">
                      Top Attacking Clubs (Live Goals Scored)
                    </h3>
                  </div>

                  {attackingClubs.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#8b94a5]">
                      No live goals statistics currently published for this tournament.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attackingClubs.map((club) => (
                        <div
                          key={club.team}
                          className="flex items-center justify-between p-3 rounded-lg bg-[#161a27] border border-[#202638]"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-xs text-[#00ff88]">#{club.rank}</span>
                            <TeamLogo logo={club.logo} name={club.team} className="h-5 w-5" />
                            <div>
                              <div className="text-xs font-bold text-white">{club.team}</div>
                              <div className="text-[10px] text-[#8b94a5]">
                                {club.played} played • GD {club.gd > 0 ? `+${club.gd}` : club.gd}
                              </div>
                            </div>
                          </div>
                          <div className="font-mono text-xs text-white">
                            <strong className="text-[#00ff88] text-sm">{club.goalsFor}</strong> GF ({club.goalsAgainst} GA)
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Info Tab */}
            {activeTab === 'info' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#232838] bg-[#121520] p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#00ff88] font-mono flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Competition Details
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[#1c2233]">
                      <span className="text-[#8b94a5]">Confederation:</span>
                      <span className="font-bold text-white">{tournament.confederation}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#1c2233]">
                      <span className="text-[#8b94a5]">Region:</span>
                      <span className="font-bold text-white">{tournament.region}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#1c2233]">
                      <span className="text-[#8b94a5]">Tier:</span>
                      <span className="font-bold text-white">{tournament.tier} Competition</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#1c2233]">
                      <span className="text-[#8b94a5]">Total Clubs / Nations:</span>
                      <span className="font-mono font-bold text-white">{tournament.totalTeams}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-[#8b94a5]">Host Venues:</span>
                      <span className="font-mono font-bold text-white">{tournament.venueCount} Stadiums</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[#232838] bg-[#121520] p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#00ff88] font-mono flex items-center gap-2">
                    <Radio className="h-4 w-4" /> Broadcast &amp; Telemetry
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[#1c2233]">
                      <span className="text-[#8b94a5]">Data Feed:</span>
                      <span className="font-bold text-[#00ff88]">Live ESPN Satellite API</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#1c2233]">
                      <span className="text-[#8b94a5]">Official Match Ball:</span>
                      <span className="font-bold text-white">{tournament.officialBall || 'Standard Matchball'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-[#8b94a5]">Broadcast Partners:</span>
                      <span className="font-bold text-white truncate max-w-[160px]">
                        {tournament.broadcastPartners?.join(', ') || 'Official Broadcasters'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
