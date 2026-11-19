import type { Metadata } from 'next';
import { TacticalStadiumExplorer } from '../../components/three/TacticalStadiumExplorer';

export const metadata: Metadata = {
  title: '3D Tactical Stadium | FOOTYLive',
  description:
    'Interactive Three.js 3D football stadium, live formation simulator, exploded tier architecture, and player raycast inspector.',
};

export default function Tactical3DPage() {
  return <TacticalStadiumExplorer />;
}
