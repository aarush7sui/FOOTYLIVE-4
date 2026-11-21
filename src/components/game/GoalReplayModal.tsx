'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Clapperboard, Pause, Play, RotateCcw } from 'lucide-react';

export interface GoalReplayData {
  round: number;
  goalsScored: number;
  streak: number;
  headline: string;
  detail: string;
  shotSpeedKmh: number;
  powerPct: number;
  curveLabel: string;
  placementZone: string;
  crossX: number;
  crossY: number;
  keeperX: number;
  keeperDiveAngle: number;
  snapshotUrl: string | null;
}

interface GoalReplayModalProps {
  replay: GoalReplayData;
  onContinue: () => void;
}

const AUTO_ADVANCE_MS = 3600;
const GOAL_HALF_W = 3.66;
const GOAL_HEIGHT = 2.44;

export const GoalReplayModal: React.FC<GoalReplayModalProps> = ({
  replay,
  onContinue,
}) => {
  const [holdReplay, setHoldReplay] = useState(false);
  const [remainingMs, setRemainingMs] = useState(AUTO_ADVANCE_MS);

  useEffect(() => {
    if (holdReplay) return;

    const interval = window.setInterval(() => {
      setRemainingMs((prev) => {
        if (prev <= 100) {
          window.clearInterval(interval);
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => window.clearInterval(interval);
  }, [holdReplay]);

  useEffect(() => {
    if (!holdReplay && remainingMs <= 0) {
      onContinue();
    }
  }, [holdReplay, remainingMs, onContinue]);

  const progressPct = Math.max(
    0,
    Math.min(100, (remainingMs / AUTO_ADVANCE_MS) * 100)
  );

  // Map 3D goal plane coordinates (x: -3.66..3.66, y: 0..2.44) into SVG 220x84 box
  const mapGoalX = (x: number) =>
    14 + ((Math.max(-GOAL_HALF_W, Math.min(GOAL_HALF_W, x)) + GOAL_HALF_W) / (GOAL_HALF_W * 2)) * 192;
  const mapGoalY = (y: number) =>
    72 - (Math.max(0, Math.min(GOAL_HEIGHT, y)) / GOAL_HEIGHT) * 58;

  const ballSvgX = mapGoalX(replay.crossX);
  const ballSvgY = mapGoalY(replay.crossY);
  const keeperSvgX = mapGoalX(replay.keeperX);

  const isFinalRound = replay.round >= 5;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Goal Replay"
      className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(5,8,15,0.78)] p-4 sm:p-6"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#2c3852] bg-[#0b101d] text-white shadow-2xl"
      >
        {/* Broadcast REPLAY Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e2940] bg-[#111829] px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-md bg-[#ff3355] px-2.5 py-1 text-xs font-black tracking-widest text-white uppercase whitespace-nowrap shrink-0">
              <Clapperboard className="h-3.5 w-3.5" />
              <span>REPLAY</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#cbd5e1]">
              <span className="font-bold text-white">Goal Highlight</span>
              <span aria-hidden="true" className="text-[#64748b]">·</span>
              <span className="tabular-nums">Round {replay.round} of 5</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold tabular-nums text-[#94a3b8]">
            <span>
              Score <strong className="text-[#00ff88]">{replay.goalsScored} / 5</strong>
            </span>
            <span aria-hidden="true" className="text-[#475569]">·</span>
            <span>
              Streak <strong className="text-[#38bdf8]">{replay.streak}</strong>
            </span>
          </div>
        </div>

        {/* Highlight Snapshot Viewport */}
        <div className="relative aspect-video w-full overflow-hidden bg-[#070b14]">
          {replay.snapshotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={replay.snapshotUrl}
              alt={`Goal replay highlight from round ${replay.round}`}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#0c1626] p-6">
              <svg
                viewBox="0 0 400 200"
                className="h-full w-full max-w-md"
                aria-label="Simulated goal trajectory highlight"
              >
                <rect x="30" y="28" width="340" height="136" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                <line x1="30" y1="164" x2="370" y2="164" stroke="#00ff88" strokeWidth="2" strokeOpacity="0.45" />
                <path
                  d={`M 200 192 Q ${(200 + 30 + ((replay.crossX + GOAL_HALF_W) / (GOAL_HALF_W * 2)) * 340) / 2} 110 ${30 + ((replay.crossX + GOAL_HALF_W) / (GOAL_HALF_W * 2)) * 340} ${164 - (replay.crossY / GOAL_HEIGHT) * 136}`}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3"
                  strokeDasharray="6 4"
                />
                <circle
                  cx={30 + ((replay.crossX + GOAL_HALF_W) / (GOAL_HALF_W * 2)) * 340}
                  cy={164 - (replay.crossY / GOAL_HEIGHT) * 136}
                  r="10"
                  fill="#00ff88"
                />
              </svg>
            </div>
          )}

          {/* Broadcast Viewfinder Brackets */}
          <div className="pointer-events-none absolute inset-3">
            <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-white/45" />
            <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-white/45" />
            <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-white/45" />
            <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-white/45" />
          </div>

          {/* Top Camera Angle Label */}
          <div className="pointer-events-none absolute top-4 left-5 flex items-center gap-2 text-[11px] font-bold tracking-widest text-white/90 uppercase drop-shadow">
            <span>Goal-Line Broadcast Cam</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#00ff88]">{replay.placementZone}</span>
          </div>

          {/* Contrast Scrim & Goal Commentary Overlay */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#070b14] via-[#070b14]/80 to-transparent px-5 pt-12 pb-4">
            <div className="text-xs font-bold tracking-[0.18em] text-[#00ff88] uppercase">
              {replay.detail}
            </div>
            <h2 className="mt-1 text-lg sm:text-xl font-black tracking-wide text-white uppercase leading-tight">
              {replay.headline}
            </h2>
          </div>
        </div>

        {/* Strike Telemetry & Goal-Mouth Placement Strip */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5 border-t border-[#1e2940] bg-[#0d1322] px-5 py-4">
          {/* Mini Goal-Mouth Strike Diagram */}
          <div className="flex items-center gap-4">
            <svg
              viewBox="0 0 220 84"
              className="h-16 w-44 shrink-0 rounded-lg bg-[#090e1a] border border-[#1e2940]"
              aria-label={`Shot struck ${replay.placementZone}`}
            >
              {/* Net grid */}
              <line x1="62" y1="14" x2="62" y2="72" stroke="#1e2940" strokeWidth="1" />
              <line x1="110" y1="14" x2="110" y2="72" stroke="#1e2940" strokeWidth="1" />
              <line x1="158" y1="14" x2="158" y2="72" stroke="#1e2940" strokeWidth="1" />
              <line x1="14" y1="34" x2="206" y2="34" stroke="#1e2940" strokeWidth="1" />
              <line x1="14" y1="54" x2="206" y2="54" stroke="#1e2940" strokeWidth="1" />
              {/* Goalframe */}
              <polyline
                points="14,72 14,14 206,14 206,72"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="2.5"
              />
              {/* Keeper position marker */}
              <line
                x1={keeperSvgX}
                y1={70}
                x2={keeperSvgX - Math.sin(replay.keeperDiveAngle) * 18}
                y2={48}
                stroke="#ff3355"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* Ball strike point */}
              <circle cx={ballSvgX} cy={ballSvgY} r="7" fill="#00ff88" fillOpacity="0.24" />
              <circle cx={ballSvgX} cy={ballSvgY} r="4.5" fill="#00ff88" stroke="#070b14" strokeWidth="1.5" />
            </svg>

            <div className="grid grid-cols-3 gap-5 text-left">
              <div>
                <div className="text-[11px] font-medium text-[#94a3b8]">Velocity</div>
                <div className="text-base font-black text-white tabular-nums">
                  {replay.shotSpeedKmh} <span className="text-xs font-semibold text-[#94a3b8]">km/h</span>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-[#94a3b8]">Power</div>
                <div className="text-base font-black text-[#00ff88] tabular-nums">
                  {replay.powerPct}%
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-[#94a3b8]">Flight</div>
                <div className="text-base font-black text-[#38bdf8] whitespace-nowrap">
                  {replay.curveLabel}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Replay Controls */}
          <div className="flex w-full sm:w-auto items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                setHoldReplay((prev) => {
                  const next = !prev;
                  if (!next && remainingMs <= 200) {
                    setRemainingMs(AUTO_ADVANCE_MS);
                  }
                  return next;
                });
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#2c3852] bg-[#161e31] px-4 py-2.5 text-xs font-bold text-[#cbd5e1] hover:border-[#38bdf8] hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {holdReplay ? (
                <>
                  <Play className="h-3.5 w-3.5 text-[#00ff88]" />
                  <span>Resume Auto</span>
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5 text-[#38bdf8]" />
                  <span>Hold Frame</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onContinue}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#00ff88] px-5 py-2.5 text-xs font-black tracking-wide text-black uppercase hover:bg-[#22ff99] transition-colors whitespace-nowrap shrink-0"
            >
              {isFinalRound ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Final Result</span>
                </>
              ) : (
                <>
                  <span>Next Kick</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Auto-Advance Progress Track */}
        <div className="h-1 w-full bg-[#141c2e]">
          <div
            className={`h-full transition-[width] duration-100 ease-linear ${
              holdReplay ? 'bg-[#38bdf8]' : 'bg-[#00ff88]'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </motion.div>
    </div>
  );
};
