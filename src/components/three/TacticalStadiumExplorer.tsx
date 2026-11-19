'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Layers,
  Play,
  Pause,
  Sun,
  Moon,
  Sunset,
  Camera,
  X,
  Gamepad2,
} from 'lucide-react';
import { buildTacticalStadium, TacticalPlayerNode } from './stadiumModels';

type FormationKey = '4-3-3' | '4-2-3-1' | '3-5-2';
type PlayMode = 'buildup' | 'counter' | 'press' | 'idle';
type AtmosphereMode = 'night' | 'sunset' | 'daylight';
type CameraView = 'broadcast' | 'overhead' | 'touchline' | 'center';

interface SelectedPlayerInfo {
  id: string;
  name: string;
  number: number;
  team: 'home' | 'away';
  role: string;
  rating: number;
}

// Formation coordinates for 11 players (x: -22..22, z: -15..15)
const HOME_FORMATIONS: Record<FormationKey, Array<[number, number]>> = {
  '4-3-3': [
    [-21.2, 0],
    [-14, 10.5],
    [-15, 3.8],
    [-15, -3.8],
    [-14, -10.5],
    [-8.5, 0],
    [-5.5, 6.5],
    [-5.5, -6.5],
    [-1.2, 11],
    [-1.2, -11],
    [1.5, 0],
  ],
  '4-2-3-1': [
    [-21.2, 0],
    [-14.5, 10.2],
    [-15.5, 3.6],
    [-15.5, -3.6],
    [-14.5, -10.2],
    [-10, 4.2],
    [-10, -4.2],
    [-3.5, 0],
    [-4, 9.5],
    [-4, -9.5],
    [2.2, 0],
  ],
  '3-5-2': [
    [-21.2, 0],
    [-15, 7.5],
    [-16, 0],
    [-15, -7.5],
    [-8.5, 0],
    [-6.5, 12.2],
    [-6.5, -12.2],
    [-4.5, 4.5],
    [-4.5, -4.5],
    [1.8, 3.4],
    [1.8, -3.4],
  ],
};

const AWAY_DEFAULT: Array<[number, number]> = [
  [21.2, 0],
  [14.5, -10],
  [15.5, -3.6],
  [15.5, 3.6],
  [14.5, 10],
  [9, -4],
  [9, 4],
  [4, 0],
  [4.5, -9.8],
  [4.5, 9.8],
  [-1.5, 0],
];

const CAMERA_PRESETS: Record<
  CameraView,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  broadcast: { pos: [0, 24, 34], target: [0, 1, 0] },
  overhead: { pos: [0, 46, 8], target: [0, 0, 0] },
  touchline: { pos: [-28, 7.5, 22], target: [2, 1.2, 0] },
  center: { pos: [-9, 4.2, 11], target: [2, 1.2, -1] },
};

const ATMOSPHERES: Record<
  AtmosphereMode,
  {
    sky: number;
    fogDensity: number;
    keyColor: number;
    keyIntensity: number;
    hemiSky: number;
    hemiGround: number;
  }
> = {
  night: {
    sky: 0x070c18,
    fogDensity: 0.0068,
    keyColor: 0xfff3dc,
    keyIntensity: 2.3,
    hemiSky: 0x6ea8ff,
    hemiGround: 0x163220,
  },
  sunset: {
    sky: 0x1d1427,
    fogDensity: 0.0075,
    keyColor: 0xffa65c,
    keyIntensity: 2.6,
    hemiSky: 0xff8a7a,
    hemiGround: 0x241d2e,
  },
  daylight: {
    sky: 0x6fa8dc,
    fogDensity: 0.0042,
    keyColor: 0xfffbe6,
    keyIntensity: 2.8,
    hemiSky: 0xdbeafe,
    hemiGround: 0x1f4d2e,
  },
};

// Module-scope scratch math objects (zero allocations in rAF loop)
const _targetCamPos = new THREE.Vector3(0, 24, 34);
const _targetLookAt = new THREE.Vector3(0, 1, 0);
const _targetSkyColor = new THREE.Color(0x070c18);
const _targetKeyColor = new THREE.Color(0xfff3dc);
const _targetHemiSky = new THREE.Color(0x6ea8ff);
const _ballA = new THREE.Vector3();
const _ballB = new THREE.Vector3();

export const TacticalStadiumExplorer: React.FC = () => {
  const canvasMountRef = useRef<HTMLDivElement>(null);

  const [formation, setFormation] = useState<FormationKey>('4-3-3');
  const [playMode, setPlayMode] = useState<PlayMode>('buildup');
  const [explodePct, setExplodePct] = useState<number>(0);
  const [atmosphere, setAtmosphere] = useState<AtmosphereMode>('night');
  const [cameraView, setCameraView] = useState<CameraView>('broadcast');
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [selectedPlayer, setSelectedPlayer] =
    useState<SelectedPlayerInfo | null>(null);

  const stateRef = useRef({
    formation: '4-3-3' as FormationKey,
    playMode: 'buildup' as PlayMode,
    explodeRatio: 0,
    atmosphere: 'night' as AtmosphereMode,
    cameraTransitionActive: false,
    selectedPlayerId: null as string | null,
  });

  const applyCameraPreset = useCallback((view: CameraView) => {
    setCameraView(view);
    const preset = CAMERA_PRESETS[view];
    _targetCamPos.set(...preset.pos);
    _targetLookAt.set(...preset.target);
    stateRef.current.cameraTransitionActive = true;
  }, []);

  useEffect(() => {
    stateRef.current.formation = formation;
  }, [formation]);

  useEffect(() => {
    stateRef.current.playMode = playMode;
  }, [playMode]);

  useEffect(() => {
    stateRef.current.explodeRatio = explodePct / 100;
  }, [explodePct]);

  useEffect(() => {
    stateRef.current.atmosphere = atmosphere;
  }, [atmosphere]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') {
        setDockCollapsed((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    // Software WebGL guard
    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(
      mount.clientWidth || window.innerWidth,
      mount.clientHeight || window.innerHeight
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const initialBg = new THREE.Color(ATMOSPHERES.night.sky);
    scene.background = initialBg;
    const fog = new THREE.FogExp2(
      ATMOSPHERES.night.sky,
      ATMOSPHERES.night.fogDensity
    );
    scene.fog = fog;

    // Studio RoomEnvironment reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      48,
      (mount.clientWidth || window.innerWidth) /
        (mount.clientHeight || window.innerHeight),
      0.1,
      320
    );
    camera.position.set(0, 24, 34);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 8;
    controls.maxDistance = 82;
    controls.target.set(0, 1, 0);

    // Cancel scripted camera presets immediately when user interacts
    controls.addEventListener('start', () => {
      stateRef.current.cameraTransitionActive = false;
    });

    // Warm key + cool hemisphere lighting rig
    const hemiLight = new THREE.HemisphereLight(
      ATMOSPHERES.night.hemiSky,
      ATMOSPHERES.night.hemiGround,
      0.75
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(
      ATMOSPHERES.night.keyColor,
      ATMOSPHERES.night.keyIntensity
    );
    keyLight.position.set(22, 34, 18);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 4;
    keyLight.shadow.camera.far = 110;
    keyLight.shadow.camera.left = -32;
    keyLight.shadow.camera.right = 32;
    keyLight.shadow.camera.top = 32;
    keyLight.shadow.camera.bottom = -32;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const stadium = buildTacticalStadium(
      renderer.capabilities.getMaxAnisotropy()
    );
    scene.add(stadium.root);

    // Initialize player positions
    const homePlayers = stadium.players.filter((p) => p.team === 'home');
    const awayPlayers = stadium.players.filter((p) => p.team === 'away');
    HOME_FORMATIONS['4-3-3'].forEach(([x, z], idx) => {
      const p = homePlayers[idx];
      if (p) {
        p.baseX = x;
        p.baseZ = z;
        p.targetX = x;
        p.targetZ = z;
        p.group.position.set(x, 0, z);
      }
    });
    AWAY_DEFAULT.forEach(([x, z], idx) => {
      const p = awayPlayers[idx];
      if (p) {
        p.baseX = x;
        p.baseZ = z;
        p.targetX = x;
        p.targetZ = z;
        p.group.position.set(x, 0, z);
      }
    });

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Layer-1 Raycasting for player picking & throttled hover cursor
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNdc = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverCheck = 0;

    const findPlayerById = (id: string): TacticalPlayerNode | undefined =>
      stadium.players.find((p) => p.id === id);

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(stadium.hitboxes, false);
      renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(
        e.clientX - pointerDownPos.x,
        e.clientY - pointerDownPos.y
      );
      if (moved > 6) return; // Ignore orbit drags

      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(stadium.hitboxes, false);

      if (hits.length > 0) {
        const playerId = hits[0].object.userData.playerId as string;
        const player = findPlayerById(playerId);
        if (player) {
          stateRef.current.selectedPlayerId = player.id;
          stadium.selectionRing.visible = true;
          setSelectedPlayer({
            id: player.id,
            name: player.name,
            number: player.number,
            team: player.team,
            role: player.role,
            rating: player.rating,
          });
          _targetLookAt.set(player.group.position.x, 1.1, player.group.position.z);
          _targetCamPos.set(
            player.group.position.x + (player.team === 'home' ? -9 : 9),
            6.5,
            player.group.position.z + 11
          );
          stateRef.current.cameraTransitionActive = true;
        }
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(
        isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
      );
    };
    window.addEventListener('resize', onResize);

    // Passing sequence indices for home build-up / counter / press
    const passSequences: Record<PlayMode, number[]> = {
      buildup: [0, 2, 5, 7, 10, 8, 7, 9],
      counter: [0, 5, 8, 10, 9],
      press: [5, 6, 7, 10, 8, 6],
      idle: [7],
    };

    let frameId = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick(now: number) {
      if (disposed) return;
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      elapsed += dt;

      const s = stateRef.current;

      // 1. Update Formation Targets & Tactical Movement
      const formationCoords = HOME_FORMATIONS[s.formation];
      homePlayers.forEach((p, idx) => {
        const [bx, bz] = formationCoords[idx] || [0, 0];
        let offsetX = 0;
        let offsetZ = 0;
        if (s.playMode === 'buildup') {
          offsetX = Math.sin(elapsed * 0.9 + idx) * 1.4;
          offsetZ = Math.cos(elapsed * 0.8 + idx) * 1.1;
        } else if (s.playMode === 'counter') {
          const surge = idx >= 6 ? Math.max(0, Math.sin(elapsed * 0.7)) * 7.5 : 1.5;
          offsetX = surge;
          offsetZ = Math.sin(elapsed * 1.2 + idx) * 0.8;
        } else if (s.playMode === 'press') {
          const push = idx >= 4 ? 5.2 + Math.sin(elapsed * 1.4) * 2.2 : 2.5;
          offsetX = push;
          offsetZ = Math.cos(elapsed * 1.5 + idx) * 1.3;
        }
        p.targetX = bx + offsetX;
        p.targetZ = bz + offsetZ;
      });

      awayPlayers.forEach((p, idx) => {
        const [bx, bz] = AWAY_DEFAULT[idx] || [0, 0];
        const swayX =
          s.playMode === 'idle' ? 0 : Math.sin(elapsed * 0.75 + idx) * 1.6;
        const swayZ =
          s.playMode === 'idle' ? 0 : Math.cos(elapsed * 0.65 + idx) * 1.2;
        p.targetX = bx + swayX;
        p.targetZ = bz + swayZ;
      });

      // Damped player locomotion + leg stride
      stadium.players.forEach((p, idx) => {
        const prevX = p.group.position.x;
        const prevZ = p.group.position.z;
        p.group.position.x = THREE.MathUtils.damp(
          p.group.position.x,
          p.targetX,
          3.4,
          dt
        );
        p.group.position.z = THREE.MathUtils.damp(
          p.group.position.z,
          p.targetZ,
          3.4,
          dt
        );
        const speed =
          Math.hypot(p.group.position.x - prevX, p.group.position.z - prevZ) /
          dt;
        const stride = Math.min(0.45, speed * 0.14) * Math.sin(elapsed * 7 + idx);
        p.leftLeg.rotation.z = stride;
        p.rightLeg.rotation.z = -stride;

        if (s.selectedPlayerId === p.id) {
          stadium.selectionRing.position.set(
            p.group.position.x,
            0.04,
            p.group.position.z
          );
        }
      });

      // 2. Animated Match Ball along Passing Chain
      const seq = passSequences[s.playMode];
      if (seq.length > 1 && s.playMode !== 'idle') {
        const passSpeed = s.playMode === 'counter' ? 1.1 : 0.78;
        const totalProg = (elapsed * passSpeed) % seq.length;
        const legIdx = Math.floor(totalProg);
        const t = totalProg - legIdx;
        const pFrom = homePlayers[seq[legIdx]] || homePlayers[0];
        const pTo = homePlayers[seq[(legIdx + 1) % seq.length]] || homePlayers[1];
        _ballA.set(pFrom.group.position.x + 0.45, 0.28, pFrom.group.position.z);
        _ballB.set(pTo.group.position.x + 0.45, 0.28, pTo.group.position.z);
        stadium.ballMesh.position.lerpVectors(_ballA, _ballB, t);
        const arcH = Math.sin(t * Math.PI) * (s.playMode === 'counter' ? 2.4 : 0.65);
        stadium.ballMesh.position.y = 0.28 + arcH;
        stadium.ballMesh.rotation.z -= dt * 8;
      } else {
        stadium.ballMesh.position.set(0, 0.28, 0);
      }

      stadium.ballShadow.position.set(
        stadium.ballMesh.position.x,
        0.03,
        stadium.ballMesh.position.z
      );
      const ballHeightRatio = THREE.MathUtils.clamp(
        1 - (stadium.ballMesh.position.y - 0.28) / 3.0,
        0.3,
        1
      );
      stadium.ballShadow.scale.setScalar(0.85 + (1 - ballHeightRatio) * 0.7);
      stadium.ballShadowMat.opacity = 0.55 * ballHeightRatio;

      // 3. Exploded Stadium Tiers & Roof Separation
      const targetRoofY = s.explodeRatio * 14.5;
      const targetUpperY = s.explodeRatio * 5.2;
      stadium.roofGroup.position.y = THREE.MathUtils.damp(
        stadium.roofGroup.position.y,
        targetRoofY,
        5.5,
        dt
      );
      stadium.upperBowlGroup.position.y = THREE.MathUtils.damp(
        stadium.upperBowlGroup.position.y,
        targetUpperY,
        5.5,
        dt
      );

      // 4. Atmosphere Color Damping
      const atm = ATMOSPHERES[s.atmosphere];
      _targetSkyColor.setHex(atm.sky);
      _targetKeyColor.setHex(atm.keyColor);
      _targetHemiSky.setHex(atm.hemiSky);
      if (scene.background instanceof THREE.Color) {
        scene.background.lerp(_targetSkyColor, 1 - Math.exp(-4 * dt));
        fog.color.copy(scene.background);
      }
      fog.density = THREE.MathUtils.damp(fog.density, atm.fogDensity, 4, dt);
      keyLight.color.lerp(_targetKeyColor, 1 - Math.exp(-4 * dt));
      keyLight.intensity = THREE.MathUtils.damp(
        keyLight.intensity,
        atm.keyIntensity,
        4,
        dt
      );
      hemiLight.color.lerp(_targetHemiSky, 1 - Math.exp(-4 * dt));

      // 5. Damped Scripted Camera Preset Transitions (clears on arrival or user drag)
      if (s.cameraTransitionActive) {
        const dampLambda = 4.8;
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          _targetCamPos.x,
          dampLambda,
          dt
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          _targetCamPos.y,
          dampLambda,
          dt
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          _targetCamPos.z,
          dampLambda,
          dt
        );
        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          _targetLookAt.x,
          dampLambda,
          dt
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          _targetLookAt.y,
          dampLambda,
          dt
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          _targetLookAt.z,
          dampLambda,
          dt
        );
        if (
          camera.position.distanceTo(_targetCamPos) < 0.15 &&
          controls.target.distanceTo(_targetLookAt) < 0.15
        ) {
          s.cameraTransitionActive = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(() => tick(performance.now()));
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      envRT.dispose();
      stadium.disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070c18] select-none">
      {/* Full-Bleed WebGL Container */}
      <div ref={canvasMountRef} className="absolute inset-0 h-full w-full" />

      {/* Top-Left Minimal Title & Back Nav (solid rgba, zero backdrop-filter, zero pulsing dots) */}
      <div className="pointer-events-none absolute top-4 left-4 right-4 z-20 flex items-start justify-between gap-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[#28344d] bg-[rgba(10,14,24,0.9)] px-3.5 py-2 text-white">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg bg-[#161e30] px-2.5 py-1 text-xs font-bold text-[#cbd5e1] hover:text-[#00ff88] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>FOOTYLive</span>
          </Link>
          <div className="h-5 w-px bg-[#28344d]" />
          <div>
            <div className="text-xs font-black tracking-wider uppercase text-white">
              3D TACTICAL <span className="text-[#00ff88]">STADIUM</span>
            </div>
            <div className="text-[10px] text-[#94a3b8]">
              Drag to orbit · Scroll to zoom · Click any player to inspect
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <Link
            href="/penalty-arena"
            className="flex items-center gap-1.5 rounded-xl border border-[#00ff88]/50 bg-[rgba(10,14,24,0.9)] px-3.5 py-2 text-xs font-bold text-[#00ff88] hover:bg-[#00ff88] hover:text-black transition-colors"
          >
            <Gamepad2 className="h-3.5 w-3.5" />
            <span>Play 3D Penalty Arena</span>
          </Link>
        </div>
      </div>

      {/* Selected Player Inspection Badge (only shown when a 3D player is clicked) */}
      {selectedPlayer && (
        <div className="absolute top-20 left-4 z-20 w-64 rounded-xl border border-[#facc15]/60 bg-[rgba(10,14,24,0.92)] p-3.5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${
                  selectedPlayer.team === 'home'
                    ? 'bg-[#00ff88] text-black'
                    : 'bg-[#ff3355] text-white'
                }`}
              >
                {selectedPlayer.team === 'home' ? 'Home XI' : 'Away XI'} · #
                {selectedPlayer.number}
              </span>
              <h3 className="mt-1 text-sm font-black">{selectedPlayer.name}</h3>
              <p className="text-[11px] text-[#94a3b8]">{selectedPlayer.role}</p>
            </div>
            <button
              onClick={() => {
                stateRef.current.selectedPlayerId = null;
                setSelectedPlayer(null);
              }}
              className="rounded-md p-1 text-[#94a3b8] hover:text-white"
              title="Close player card"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-[#222d44] pt-2 text-xs">
            <span className="text-[#94a3b8]">Match Rating</span>
            <span className="font-black text-[#00ff88] tabular-nums">
              {selectedPlayer.rating.toFixed(1)}
            </span>
          </div>
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock (<= 15% footprint, zero backdrop-filter) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center max-w-[95vw]">
        <button
          onClick={() => setDockCollapsed((v) => !v)}
          className="mb-1 flex items-center gap-1 rounded-t-lg border border-b-0 border-[#28344d] bg-[rgba(10,14,24,0.92)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#9fb0cc] hover:text-white"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3 w-3" /> Show Controls (H)
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> Hide Controls (H)
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-[#28344d] bg-[rgba(10,14,24,0.92)] px-4 py-2.5 text-xs text-white">
            {/* Formation Selector */}
            <div className="flex items-center gap-1 border-r border-[#242e44] pr-3">
              <span className="text-[10px] font-bold uppercase text-[#8fa0bd] mr-1">
                Shape
              </span>
              {(['4-3-3', '4-2-3-1', '3-5-2'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormation(fmt)}
                  className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
                    formation === fmt
                      ? 'bg-[#00ff88] text-black'
                      : 'bg-[#172033] text-[#b4c0d4] hover:text-white'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>

            {/* Play Simulation */}
            <div className="flex items-center gap-1 border-r border-[#242e44] pr-3">
              {(
                [
                  { id: 'buildup', label: 'Build-Up' },
                  { id: 'counter', label: 'Counter' },
                  { id: 'press', label: 'Press' },
                  { id: 'idle', label: 'Freeze' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPlayMode(m.id)}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
                    playMode === m.id
                      ? 'bg-[#38bdf8] text-black'
                      : 'bg-[#172033] text-[#b4c0d4] hover:text-white'
                  }`}
                >
                  {m.id === 'idle' ? (
                    <Pause className="h-3 w-3" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            {/* Exploded Stadium Slider */}
            <div className="flex items-center gap-2 border-r border-[#242e44] pr-3">
              <Layers className="h-3.5 w-3.5 text-[#00ff88]" />
              <span className="text-[10px] font-bold uppercase text-[#8fa0bd]">
                Explode
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={explodePct}
                onChange={(e) => setExplodePct(Number(e.target.value))}
                className="w-20 accent-[#00ff88] cursor-pointer"
                aria-label="Explode stadium tiers"
              />
              <span className="w-8 text-[11px] font-bold tabular-nums text-[#00ff88]">
                {explodePct}%
              </span>
            </div>

            {/* Atmosphere */}
            <div className="flex items-center gap-1 border-r border-[#242e44] pr-3">
              {(
                [
                  { id: 'night', icon: Moon, label: 'Night' },
                  { id: 'sunset', icon: Sunset, label: 'Sunset' },
                  { id: 'daylight', icon: Sun, label: 'Day' },
                ] as const
              ).map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    onClick={() => setAtmosphere(a.id)}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
                      atmosphere === a.id
                        ? 'bg-[#facc15] text-black'
                        : 'bg-[#172033] text-[#b4c0d4] hover:text-white'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{a.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Camera Views */}
            <div className="flex items-center gap-1">
              <Camera className="h-3.5 w-3.5 text-[#00ff88] mr-0.5" />
              {(['broadcast', 'overhead', 'touchline', 'center'] as const).map(
                (view) => (
                  <button
                    key={view}
                    onClick={() => applyCameraPreset(view)}
                    className={`rounded-md px-2 py-1 text-[11px] font-bold capitalize transition-colors ${
                      cameraView === view
                        ? 'bg-[#00ff88] text-black'
                        : 'bg-[#172033] text-[#b4c0d4] hover:text-white'
                    }`}
                  >
                    {view}
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
