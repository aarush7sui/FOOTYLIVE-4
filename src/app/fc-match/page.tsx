import type { Metadata } from 'next';
import { FcMatchGame } from '../../components/game/FcMatchGame';

export const metadata: Metadata = {
  title: 'FC Matchday 3D | FOOTYLive',
  description:
    'Play a 6v6 3D football match with virtual stick and FC Mobile-style attack and defense controls on FOOTYLive.',
};

export default function FcMatchPage() {
  return <FcMatchGame />;
}
