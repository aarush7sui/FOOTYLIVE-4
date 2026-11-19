'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, History, Trophy } from 'lucide-react';
import { TournamentHistoryD3 } from '../../components/history/TournamentHistoryD3';
import {
  ParallaxScrollProgress,
  FloatingBackgroundGlows,
} from '../../components/common/ParallaxItem';

export default function TournamentHistoryPage() {
  return (
    <div className="min-h-screen bg-[#0d0e12] text-[#f3f4f6] relative overflow-x-hidden">
      <ParallaxScrollProgress />
      <FloatingBackgroundGlows />

      <header className="sticky top-0 z-40 border-b border-[#1f2433] bg-[#0d0e12]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-lg border border-[#283148] bg-[#141824] px-3 py-1.5 text-xs font-bold text-[#c0c7d5] hover:border-[#00ff88]/50 hover:text-[#00ff88] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to FOOTYLive</span>
            </Link>
            <div className="h-5 w-px bg-[#232a3d]" />
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-[#ff3355]" />
              <span className="text-sm font-black uppercase tracking-wider text-white">
                Tournament <span className="text-[#00ff88]">History</span>
              </span>
            </div>
          </div>

          <Link
            href="/world-cup-2026"
            className="flex items-center gap-1.5 rounded-lg border border-[#0055FF]/40 bg-[#0055FF]/15 px-3 py-1.5 text-xs font-bold text-[#60a5fa] hover:bg-[#0055FF] hover:text-white transition-colors"
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>World Cup &apos;26 Hub</span>
          </Link>
        </div>
        <div className="h-[1.5px] w-full bg-gradient-to-r from-[#ff3355]/50 via-[#00ff88]/30 to-transparent" />
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <TournamentHistoryD3 />
      </main>
    </div>
  );
}
