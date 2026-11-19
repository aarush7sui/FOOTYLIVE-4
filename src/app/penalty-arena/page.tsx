import type { Metadata } from 'next';
import { PenaltyArenaGame } from '../../components/game/PenaltyArenaGame';

export const metadata: Metadata = {
  title: '3D Penalty Arena | FOOTYLive',
  description:
    'Interactive Three.js 3D football penalty shootout stadium game on FOOTYLive.',
};

export default function PenaltyArenaPage() {
  return <PenaltyArenaGame />;
}
