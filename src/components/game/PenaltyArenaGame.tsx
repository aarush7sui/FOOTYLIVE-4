'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Volume2,
  VolumeX,
  Pause,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Trophy,
  ArrowLeft,
  Camera,
} from 'lucide-react';
import {
  StadiumAudioSynth,
  createProceduralAssets,
  buildGoalpostAssembly,
  buildGoalkeeperRig,
  buildFloodlightTower,
} from './penaltyScene';

type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';
type ShotOutcome = 'goal' | 'saved' | 'post' | 'wide';
type CameraPreset = 'striker' | 'broadcast' | 'keeper';

interface RoundRecord {
  round: number;
  outcome: ShotOutcome | 'pending';
}

// Module-scope scratch math objects (zero GC allocations inside render loop)
const _camGoalPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _camCurrentLook = new THREE.Vector3(0, 1.3, -14);
const _dummyObj = new THREE.Object3D();

const GOAL_Z = -14;
const PENALTY_SPOT_Z = -3;
const GOAL_HALF_W = 3.66;
const GOAL_HEIGHT = 2.44;
const BALL_RADIUS = 0.22;

export const PenaltyArenaGame: React.FC = () => {
  const canvasMountRef = useRef<HTMLDivElement>(null);

  // React HUD State
  const [phase, setPhase] = useState<GamePhase>('title');
  const [round, setRound] = useState(1);
  const [goalsScored, setGoalsScored] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [powerPct, setPowerPct] = useState(0);
  const [curveDir, setCurveDir] = useState<-1 | 0 | 1>(0);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('striker');
  const [muted, setMuted] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [lastBanner, setLastBanner] = useState<string | null>(null);
  const [roundsHistory, setRoundsHistory] = useState<RoundRecord[]>(() =>
    Array.from({ length: 5 }, (_, i) => ({ round: i + 1, outcome: 'pending' }))
  );

  // Mutable simulation state accessed inside rAF without re-creating renderer
  const simRef = useRef({
    phase: 'title' as GamePhase,
    round: 1,
    goalsScored: 0,
    streak: 0,
    cameraPreset: 'striker' as CameraPreset,
    curveDir: 0 as -1 | 0 | 1,

    // Aim target in goal plane (x: -4.2..4.2, y: 0.28..2.85)
    aimX: 0,
    aimY: 1.25,

    // Shot charge & flight state
    isCharging: false,
    chargeVal: 0,
    chargeDir: 1,
    shotState: 'ready' as 'ready' | 'flying' | 'resolving',
    resolveTimer: 0,
    hitstopTimer: 0,
    shakeIntensity: 0,

    // Ball kinematics
    ballPos: new THREE.Vector3(0, BALL_RADIUS, PENALTY_SPOT_Z),
    ballVel: new THREE.Vector3(0, 0, 0),
    ballSpin: new THREE.Vector3(0, 0, 0),
    ballCurveAccel: 0,
    shotEvaluated: false,

    // Goalkeeper AI kinematics
    keeperX: 0,
    keeperTargetX: 0,
    keeperDiveAngle: 0,
    keeperTargetDive: 0,
    keeperJumpY: 0,
    keeperReactDelay: 0,

    // Held keyboard inputs
    keys: {} as Record<string, boolean>,

    // Confetti burst timer
    confettiActive: false,
    confettiTimer: 0,
  });

  const audioRef = useRef<StadiumAudioSynth | null>(null);

  const syncPhase = useCallback((nextPhase: GamePhase) => {
    simRef.current.phase = nextPhase;
    setPhase(nextPhase);
  }, []);

  const resetBallForNextKick = useCallback(() => {
    const s = simRef.current;
    s.shotState = 'ready';
    s.isCharging = false;
    s.chargeVal = 0;
    s.shotEvaluated = false;
    s.ballPos.set(0, BALL_RADIUS, PENALTY_SPOT_Z);
    s.ballVel.set(0, 0, 0);
    s.ballSpin.set(0, 0, 0);
    s.ballCurveAccel = 0;
    s.keeperTargetX = 0;
    s.keeperTargetDive = 0;
    s.keeperJumpY = 0;
    setPowerPct(0);
  }, []);

  const startNewMatch = useCallback(() => {
    const s = simRef.current;
    s.round = 1;
    s.goalsScored = 0;
    s.streak = 0;
    s.aimX = 0;
    s.aimY = 1.25;
    s.curveDir = 0;
    s.confettiActive = false;
    setRound(1);
    setGoalsScored(0);
    setStreak(0);
    setCurveDir(0);
    setLastBanner(null);
    setRoundsHistory(
      Array.from({ length: 5 }, (_, i) => ({ round: i + 1, outcome: 'pending' }))
    );
    resetBallForNextKick();
    syncPhase('playing');
    audioRef.current?.playWhistle();
  }, [resetBallForNextKick, syncPhase]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);

  // Sync camera preset & curve into simRef
  useEffect(() => {
    simRef.current.cameraPreset = cameraPreset;
  }, [cameraPreset]);

  useEffect(() => {
    simRef.current.curveDir = curveDir;
  }, [curveDir]);

  const launchShot = useCallback(() => {
    const s = simRef.current;
    if (s.shotState !== 'ready' || s.phase !== 'playing') return;

    const power = THREE.MathUtils.clamp(s.chargeVal, 0.25, 1.0);
    s.isCharging = false;
    s.shotState = 'flying';
    s.shotEvaluated = false;

    // Speed scales from 18 to 31 m/s
    const speed = 18 + power * 13;
    const dx = s.aimX - s.ballPos.x;
    const dz = GOAL_Z - s.ballPos.z;
    const horizDist = Math.hypot(dx, dz);
    const flightTime = horizDist / speed;

    // Compensate gravity (g = 9.81) + slight power loft
    const gravity = 9.81;
    const vy = (s.aimY - s.ballPos.y + 0.5 * gravity * flightTime * flightTime) / flightTime;
    const curveOffset = s.curveDir * (1.55 + power * 0.9);
    const vx = (dx - 0.5 * curveOffset * flightTime * flightTime) / flightTime;
    const vz = dz / flightTime;

    s.ballVel.set(vx, vy, vz);
    s.ballCurveAccel = curveOffset;
    s.ballSpin.set(-14 * power, s.curveDir * 18, 0);

    // Goalkeeper AI decision (difficulty scales per round)
    const difficulty = Math.min(0.92, 0.45 + (s.round - 1) * 0.11);
    const predictsCorrectly = Math.random() < difficulty;
    const guessSide = predictsCorrectly
      ? Math.sign(s.aimX || (Math.random() > 0.5 ? 1 : -1))
      : -Math.sign(s.aimX || 1);

    const diveReach = 1.65 + Math.random() * 1.35 * difficulty;
    s.keeperTargetX = THREE.MathUtils.clamp(
      predictsCorrectly ? s.aimX * 0.88 : guessSide * diveReach,
      -GOAL_HALF_W + 0.55,
      GOAL_HALF_W - 0.55
    );
    s.keeperTargetDive = -Math.sign(s.keeperTargetX) * 1.15;
    s.keeperJumpY = s.aimY > 1.55 && predictsCorrectly ? 0.55 : 0.15;
    s.keeperReactDelay = Math.max(0.03, 0.16 - s.round * 0.022);

    audioRef.current?.playKick(power);
  }, []);

  // Keyboard bindings (Enter/Space on Title, WASD/Arrows Aim, Q/E Curve, Esc Pause, H Dock)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = simRef.current;
      s.keys[e.code] = true;

      if (e.code === 'KeyH' && s.phase === 'playing') {
        setDockCollapsed((prev) => !prev);
      }

      if (e.code === 'Escape') {
        if (s.phase === 'playing') {
          syncPhase('paused');
        } else if (s.phase === 'paused') {
          syncPhase('playing');
        }
      }

      if (s.phase === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        startNewMatch();
        return;
      }

      if (s.phase === 'playing') {
        if (e.code === 'KeyQ') setCurveDir(-1);
        if (e.code === 'KeyE') setCurveDir(1);
        if (e.code === 'KeyR') setCurveDir(0);

        if (e.code === 'Space' && s.shotState === 'ready' && !s.isCharging) {
          e.preventDefault();
          s.isCharging = true;
          s.chargeVal = 0.08;
          s.chargeDir = 1;
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const s = simRef.current;
      s.keys[e.code] = false;

      if (e.code === 'Space' && s.phase === 'playing' && s.shotState === 'ready' && s.isCharging) {
        launchShot();
      }
    };

    const onBlur = () => {
      simRef.current.keys = {};
      simRef.current.isCharging = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [launchShot, startNewMatch, syncPhase]);

  // Main Three.js Mount & Simulation Effect
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const audio = new StadiumAudioSynth();
    audioRef.current = audio;

    // 1. Software WebGL probe
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(mount.clientWidth || window.innerWidth, mount.clientHeight || window.innerHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // 3. Scene, Camera, Fog & RoomEnvironment
    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x0a101d);
    scene.background = skyColor;
    scene.fog = new THREE.FogExp2(0x0a101d, 0.011);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      50,
      (mount.clientWidth || window.innerWidth) / (mount.clientHeight || window.innerHeight),
      0.1,
      240
    );
    camera.position.set(0, 2.35, 3.8);

    // 4. Studio/Stadium Lighting Rig (warm key + cool hemisphere fill)
    const hemiLight = new THREE.HemisphereLight(0x88b4ff, 0x183822, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff0d6, 2.2);
    keyLight.position.set(16, 26, 12);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 75;
    keyLight.shadow.camera.left = -18;
    keyLight.shadow.camera.right = 18;
    keyLight.shadow.camera.top = 18;
    keyLight.shadow.camera.bottom = -18;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00ff88, 0.65);
    rimLight.position.set(-14, 12, -24);
    scene.add(rimLight);

    // 5. Procedural Textures & World Assembly
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const assets = createProceduralAssets(maxAnisotropy);

    // Extended stadium pitch floor (no boxed-in wall void)
    const outerTurfGeo = new THREE.PlaneGeometry(180, 180);
    outerTurfGeo.rotateX(-Math.PI / 2);
    const outerTurfMat = new THREE.MeshStandardMaterial({
      color: 0x133e20,
      roughness: 0.92,
      metalness: 0.0,
    });
    const outerTurf = new THREE.Mesh(outerTurfGeo, outerTurfMat);
    outerTurf.position.y = -0.02;
    outerTurf.receiveShadow = true;
    scene.add(outerTurf);
    assets.disposables.push(outerTurfGeo, outerTurfMat);

    // Penalty Box Striped Pitch
    const pitchGeo = new THREE.PlaneGeometry(36, 32);
    pitchGeo.rotateX(-Math.PI / 2);
    const pitchMat = new THREE.MeshStandardMaterial({
      map: assets.pitchTexture,
      roughness: 0.88,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
    pitchMesh.position.set(0, 0, -5);
    pitchMesh.receiveShadow = true;
    scene.add(pitchMesh);
    assets.disposables.push(pitchGeo, pitchMat);

    // Goalpost & Net Assembly at GOAL_Z
    const goalGroup = buildGoalpostAssembly(assets.netTexture, assets.disposables);
    goalGroup.position.set(0, 0, GOAL_Z);
    scene.add(goalGroup);

    // Perimeter LED Ad Boards behind & flanking the goal
    const adMat = new THREE.MeshStandardMaterial({
      map: assets.adBoardTexture,
      emissive: 0x10281c,
      emissiveMap: assets.adBoardTexture,
      emissiveIntensity: 0.6,
      roughness: 0.4,
    });
    const adGeo = new THREE.BoxGeometry(34, 1.15, 0.3);
    const backAd = new THREE.Mesh(adGeo, adMat);
    backAd.position.set(0, 0.58, -21);
    scene.add(backAd);
    assets.disposables.push(adMat, adGeo);

    // 4 Stadium Floodlight Towers
    const towerCoords: Array<[number, number, number]> = [
      [-24, -26, 0.5],
      [24, -26, -0.5],
      [-28, 12, 2.3],
      [28, 12, -2.3],
    ];
    towerCoords.forEach(([tx, tz, rotY]) => {
      const tower = buildFloodlightTower(assets.disposables);
      tower.position.set(tx, 0, tz);
      tower.rotation.y = rotY;
      scene.add(tower);
    });

    // Stadium Bowl Tier + InstancedMesh Crowd (>20 repeated items)
    const tierGeo = new THREE.BoxGeometry(68, 8, 10);
    const tierMat = new THREE.MeshStandardMaterial({
      color: 0x141926,
      roughness: 0.85,
      metalness: 0.1,
    });
    const northTier = new THREE.Mesh(tierGeo, tierMat);
    northTier.position.set(0, 4, -30);
    scene.add(northTier);
    assets.disposables.push(tierGeo, tierMat);

    const crowdCount = 420;
    const seatGeo = new THREE.BoxGeometry(0.45, 0.65, 0.45);
    const seatMat = new THREE.MeshStandardMaterial({
      roughness: 0.75,
      metalness: 0.05,
    });
    const crowdMesh = new THREE.InstancedMesh(seatGeo, seatMat, crowdCount);
    const crowdPalette = [
      new THREE.Color(0x00ff88),
      new THREE.Color(0xf8fafc),
      new THREE.Color(0x38bdf8),
      new THREE.Color(0xff3355),
      new THREE.Color(0x64748b),
    ];
    for (let i = 0; i < crowdCount; i++) {
      const row = Math.floor(i / 60);
      const col = i % 60;
      _dummyObj.position.set(
        -29.5 + col * 1.0 + (Math.random() - 0.5) * 0.25,
        2.2 + row * 1.05,
        -25.5 - row * 0.9
      );
      _dummyObj.scale.setScalar(0.85 + Math.random() * 0.3);
      _dummyObj.updateMatrix();
      crowdMesh.setMatrixAt(i, _dummyObj.matrix);
      crowdMesh.setColorAt(i, crowdPalette[i % crowdPalette.length]);
    }
    crowdMesh.instanceMatrix.needsUpdate = true;
    if (crowdMesh.instanceColor) crowdMesh.instanceColor.needsUpdate = true;
    crowdMesh.computeBoundingSphere();
    scene.add(crowdMesh);
    assets.disposables.push(seatGeo, seatMat);

    // Goalkeeper Rig on Goal Line (z = GOAL_Z + 0.35)
    const keeper = buildGoalkeeperRig(assets.disposables);
    keeper.root.position.set(0, 0, GOAL_Z + 0.35);
    scene.add(keeper.root);

    // Composite Football + Soft Radial Contact Shadow Plane
    const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 28, 28);
    const ballMat = new THREE.MeshStandardMaterial({
      map: assets.ballTexture,
      roughness: 0.38,
      metalness: 0.08,
    });
    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.castShadow = true;
    ballMesh.position.copy(simRef.current.ballPos);
    scene.add(ballMesh);

    const contactGeo = new THREE.PlaneGeometry(0.9, 0.9);
    contactGeo.rotateX(-Math.PI / 2);
    const contactMat = new THREE.MeshBasicMaterial({
      map: assets.contactShadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    });
    const ballShadow = new THREE.Mesh(contactGeo, contactMat);
    ballShadow.position.set(0, 0.02, PENALTY_SPOT_Z);
    scene.add(ballShadow);
    assets.disposables.push(ballGeo, ballMat, contactGeo, contactMat);

    // Interactive Aim Reticle in Goal Plane
    const reticleGroup = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.24, 0.32, 28);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const reticleRing = new THREE.Mesh(ringGeo, ringMat);
    const dotGeo = new THREE.CircleGeometry(0.06, 16);
    const dotMesh = new THREE.Mesh(dotGeo, ringMat);
    reticleGroup.add(reticleRing, dotMesh);
    reticleGroup.position.set(0, 1.25, GOAL_Z + 0.08);
    scene.add(reticleGroup);
    assets.disposables.push(ringGeo, ringMat, dotGeo);

    // Celebration 3D Confetti InstancedMesh (60 pooled particles)
    const confettiCount = 60;
    const confettiGeo = new THREE.PlaneGeometry(0.18, 0.12);
    const confettiMat = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
    });
    const confettiMesh = new THREE.InstancedMesh(confettiGeo, confettiMat, confettiCount);
    confettiMesh.frustumCulled = false;
    confettiMesh.visible = false;
    const confettiPos = Array.from({ length: confettiCount }, () => new THREE.Vector3());
    const confettiVel = Array.from({ length: confettiCount }, () => new THREE.Vector3());
    for (let i = 0; i < confettiCount; i++) {
      confettiMesh.setColorAt(i, crowdPalette[i % crowdPalette.length]);
    }
    if (confettiMesh.instanceColor) confettiMesh.instanceColor.needsUpdate = true;
    scene.add(confettiMesh);
    assets.disposables.push(confettiGeo, confettiMat);

    const triggerGoalConfetti = () => {
      const s = simRef.current;
      s.confettiActive = true;
      s.confettiTimer = 2.0;
      confettiMesh.visible = true;
      for (let i = 0; i < confettiCount; i++) {
        confettiPos[i].set(
          (Math.random() - 0.5) * 6.5,
          0.4 + Math.random() * 1.8,
          GOAL_Z - 0.4
        );
        confettiVel[i].set(
          (Math.random() - 0.5) * 5.5,
          3.5 + Math.random() * 4.5,
          (Math.random() - 0.5) * 4.5
        );
      }
    };

    // Pre-compile shaders once on GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Pointer Aim & Click-to-Shoot on Canvas
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const goalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -GOAL_Z);
    const planeHit = new THREE.Vector3();

    const updateAimFromPointer = (clientX: number, clientY: number) => {
      const s = simRef.current;
      if (s.phase !== 'playing' || s.shotState !== 'ready') return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      if (raycaster.ray.intersectPlane(goalPlane, planeHit)) {
        s.aimX = THREE.MathUtils.clamp(planeHit.x, -4.3, 4.3);
        s.aimY = THREE.MathUtils.clamp(planeHit.y, 0.25, 3.0);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      updateAimFromPointer(e.clientX, e.clientY);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const s = simRef.current;
      if (s.phase !== 'playing' || s.shotState !== 'ready') return;
      updateAimFromPointer(e.clientX, e.clientY);
      s.isCharging = true;
      s.chargeVal = 0.1;
      s.chargeDir = 1;
    };

    const onPointerUp = () => {
      const s = simRef.current;
      if (s.phase === 'playing' && s.shotState === 'ready' && s.isCharging) {
        launchShot();
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);

    // Resize listener
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

    // Outcome Resolution Helper
    const recordOutcome = (outcome: ShotOutcome, banner: string) => {
      const s = simRef.current;
      s.shotEvaluated = true;
      s.shotState = 'resolving';
      s.resolveTimer = 1.65;
      setLastBanner(banner);

      const currentRound = s.round;
      if (outcome === 'goal') {
        s.goalsScored += 1;
        s.streak += 1;
        setGoalsScored(s.goalsScored);
        setStreak(s.streak);
        setBestStreak((b) => Math.max(b, s.streak));
        s.shakeIntensity = 0.24;
        s.hitstopTimer = 0.05;
        triggerGoalConfetti();
        audio.playGoalCheer();
      } else {
        s.streak = 0;
        setStreak(0);
        if (outcome === 'post') {
          s.shakeIntensity = 0.32;
          s.hitstopTimer = 0.055;
          audio.playPostClang();
        } else if (outcome === 'saved') {
          s.shakeIntensity = 0.16;
          s.hitstopTimer = 0.04;
          audio.playSaveThud();
        }
      }

      setRoundsHistory((prev) =>
        prev.map((item) =>
          item.round === currentRound ? { ...item, outcome } : item
        )
      );
    };

    // Main Simulation Loop with Software WebGL pacing
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

      const s = simRef.current;

      // Hitstop freeze on heavy impacts (30-60ms)
      if (s.hitstopTimer > 0) {
        s.hitstopTimer = Math.max(0, s.hitstopTimer - dt);
      } else if (s.phase !== 'paused') {
        // 1. Keyboard aim movement
        if (s.phase === 'playing' && s.shotState === 'ready') {
          const aimSpeed = 4.2;
          if (s.keys['KeyA'] || s.keys['ArrowLeft']) s.aimX -= aimSpeed * dt;
          if (s.keys['KeyD'] || s.keys['ArrowRight']) s.aimX += aimSpeed * dt;
          if (s.keys['KeyW'] || s.keys['ArrowUp']) s.aimY += aimSpeed * dt;
          if (s.keys['KeyS'] || s.keys['ArrowDown']) s.aimY -= aimSpeed * dt;
          s.aimX = THREE.MathUtils.clamp(s.aimX, -4.3, 4.3);
          s.aimY = THREE.MathUtils.clamp(s.aimY, 0.25, 3.0);

          // Power bar oscillation while charging
          if (s.isCharging) {
            s.chargeVal += s.chargeDir * dt * 1.45;
            if (s.chargeVal >= 1) {
              s.chargeVal = 1;
              s.chargeDir = -1;
            } else if (s.chargeVal <= 0.12) {
              s.chargeVal = 0.12;
              s.chargeDir = 1;
            }
            setPowerPct(Math.round(s.chargeVal * 100));
          }
        }

        // 2. Ball flight physics & collisions
        if (s.shotState === 'flying' || s.shotState === 'resolving') {
          s.ballVel.x += s.ballCurveAccel * dt;
          s.ballVel.y -= 9.81 * dt;
          s.ballPos.addScaledVector(s.ballVel, dt);

          ballMesh.rotation.x += s.ballSpin.x * dt;
          ballMesh.rotation.y += s.ballSpin.y * dt;

          // Ground bounce
          if (s.ballPos.y < BALL_RADIUS) {
            s.ballPos.y = BALL_RADIUS;
            s.ballVel.y = Math.abs(s.ballVel.y) * 0.45;
            s.ballVel.x *= 0.85;
            s.ballVel.z *= 0.85;
          }

          // Goalkeeper reaction delay & dive
          if (s.keeperReactDelay > 0) {
            s.keeperReactDelay -= dt;
          } else {
            s.keeperX = THREE.MathUtils.damp(s.keeperX, s.keeperTargetX, 7.5, dt);
            s.keeperDiveAngle = THREE.MathUtils.damp(
              s.keeperDiveAngle,
              s.keeperTargetDive,
              9.0,
              dt
            );
            keeper.root.position.y = THREE.MathUtils.damp(
              keeper.root.position.y,
              s.keeperJumpY,
              8.0,
              dt
            );
          }

          // Check goal-line plane crossing (z <= GOAL_Z + 0.35)
          if (!s.shotEvaluated && s.ballPos.z <= GOAL_Z + 0.45) {
            // Goalkeeper save check (bounding capsule around keeper body + outstretched arms)
            const keeperReachX = Math.abs(s.ballPos.x - s.keeperX);
            const keeperReachY = Math.abs(s.ballPos.y - (1.05 + keeper.root.position.y));
            if (keeperReachX < 0.72 && keeperReachY < 0.88 && s.ballPos.z > GOAL_Z - 0.3) {
              s.ballVel.z = Math.abs(s.ballVel.z) * 0.35;
              s.ballVel.x = Math.sign(s.ballPos.x - s.keeperX || 1) * 4.5;
              s.ballVel.y = 3.2;
              recordOutcome('saved', 'SAVED BY THE KEEPER!');
            }
          }

          if (!s.shotEvaluated && s.ballPos.z <= GOAL_Z) {
            const absX = Math.abs(s.ballPos.x);
            const y = s.ballPos.y;
            const hitLeftOrRightPost =
              Math.abs(absX - GOAL_HALF_W) < 0.22 && y <= GOAL_HEIGHT + 0.18;
            const hitCrossbar =
              absX <= GOAL_HALF_W + 0.18 && Math.abs(y - GOAL_HEIGHT) < 0.22;

            if (hitLeftOrRightPost || hitCrossbar) {
              s.ballVel.z = Math.abs(s.ballVel.z) * 0.45;
              s.ballVel.y = 3.5;
              recordOutcome('post', 'OFF THE WOODWORK!');
            } else if (absX < GOAL_HALF_W - 0.12 && y < GOAL_HEIGHT - 0.1) {
              recordOutcome('goal', 'GOAL! TOP CLASS FINISH!');
            } else {
              recordOutcome('wide', 'OFF TARGET! WIDE OF THE POST');
            }
          }

          // Net backstop
          if (s.shotEvaluated && s.ballPos.z < GOAL_Z - 1.95 && Math.abs(s.ballPos.x) < GOAL_HALF_W) {
            s.ballPos.z = GOAL_Z - 1.95;
            s.ballVel.multiplyScalar(0.25);
          }

          if (s.shotState === 'resolving') {
            s.resolveTimer -= dt;
            if (s.resolveTimer <= 0) {
              if (s.round >= 5) {
                syncPhase('gameover');
              } else {
                s.round += 1;
                setRound(s.round);
                setLastBanner(null);
                resetBallForNextKick();
                audio.playWhistle();
              }
            }
          }
        } else {
          // Idle goalkeeper sway before shot
          s.keeperX = THREE.MathUtils.damp(
            s.keeperX,
            Math.sin(elapsed * 2.4) * 0.45,
            5,
            dt
          );
          s.keeperDiveAngle = THREE.MathUtils.damp(s.keeperDiveAngle, 0, 7, dt);
          keeper.root.position.y = THREE.MathUtils.damp(keeper.root.position.y, 0, 7, dt);
        }

        // Update Keeper Articulation
        keeper.root.position.x = s.keeperX;
        keeper.root.rotation.z = s.keeperDiveAngle;
        const armRaise = Math.abs(s.keeperDiveAngle) > 0.25 ? 2.4 : 0.45 + Math.sin(elapsed * 4) * 0.12;
        keeper.leftArmPivot.rotation.z = -armRaise;
        keeper.rightArmPivot.rotation.z = armRaise;

        // Update Confetti
        if (s.confettiActive) {
          s.confettiTimer -= dt;
          for (let i = 0; i < confettiCount; i++) {
            confettiVel[i].y -= 6.5 * dt;
            confettiPos[i].addScaledVector(confettiVel[i], dt);
            _dummyObj.position.copy(confettiPos[i]);
            _dummyObj.rotation.set(elapsed * 5 + i, elapsed * 3 + i, 0);
            _dummyObj.scale.setScalar(1);
            _dummyObj.updateMatrix();
            confettiMesh.setMatrixAt(i, _dummyObj.matrix);
          }
          confettiMesh.instanceMatrix.needsUpdate = true;
          if (s.confettiTimer <= 0) {
            s.confettiActive = false;
            confettiMesh.visible = false;
          }
        }
      }

      // Sync Ball & Contact Shadow
      ballMesh.position.copy(s.ballPos);
      ballShadow.position.set(s.ballPos.x, 0.02, s.ballPos.z);
      const heightRatio = THREE.MathUtils.clamp(1 - (s.ballPos.y - BALL_RADIUS) / 4.0, 0.25, 1);
      ballShadow.scale.setScalar(0.85 + (1 - heightRatio) * 0.8);
      contactMat.opacity = 0.55 * heightRatio;

      // Sync Aim Reticle
      reticleGroup.visible = s.phase === 'playing' && s.shotState === 'ready';
      reticleGroup.position.set(s.aimX, s.aimY, GOAL_Z + 0.08);
      reticleRing.rotation.z = elapsed * 1.2;

      // Damped Camera Presets + Title Screen Pan + Shake
      if (s.phase === 'title') {
        _camGoalPos.set(Math.sin(elapsed * 0.28) * 6.5, 3.2, 4.8 + Math.cos(elapsed * 0.22) * 1.5);
        _camLookTarget.set(0, 1.3, GOAL_Z + 4);
      } else if (s.cameraPreset === 'broadcast') {
        _camGoalPos.set(8.5, 5.2, -1.5);
        _camLookTarget.set(0, 1.1, GOAL_Z + 2);
      } else if (s.cameraPreset === 'keeper') {
        _camGoalPos.set(0, 1.85, GOAL_Z - 3.6);
        _camLookTarget.set(0, 0.8, PENALTY_SPOT_Z);
      } else {
        _camGoalPos.set(s.aimX * 0.22, 2.25, 3.6);
        _camLookTarget.set(s.aimX * 0.35, 1.25, GOAL_Z);
      }

      camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoalPos.x, 4.5, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoalPos.y, 4.5, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoalPos.z, 4.5, dt);

      _camCurrentLook.x = THREE.MathUtils.damp(_camCurrentLook.x, _camLookTarget.x, 5.5, dt);
      _camCurrentLook.y = THREE.MathUtils.damp(_camCurrentLook.y, _camLookTarget.y, 5.5, dt);
      _camCurrentLook.z = THREE.MathUtils.damp(_camCurrentLook.z, _camLookTarget.z, 5.5, dt);

      if (s.shakeIntensity > 0.002) {
        camera.position.x += (Math.random() - 0.5) * s.shakeIntensity;
        camera.position.y += (Math.random() - 0.5) * s.shakeIntensity;
        s.shakeIntensity *= Math.exp(-8 * dt);
      }

      camera.lookAt(_camCurrentLook);
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
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      audio.dispose();
      envTarget.dispose();
      assets.disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [launchShot, resetBallForNextKick, syncPhase]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a101d] select-none">
      {/* Isolated WebGL Mount */}
      <div ref={canvasMountRef} className="absolute inset-0 h-full w-full" />

      {/* TOP PERIMETER HUD (pointer-events: none, tabular-nums, no backdrop-filter) */}
      {phase !== 'title' && (
        <div className="pointer-events-none absolute top-4 left-4 right-4 z-20 flex items-start justify-between">
          {/* Score & Round Cluster */}
          <div className="flex items-center gap-4 rounded-xl border border-[#28344d] bg-[rgba(11,15,25,0.88)] px-4 py-2.5 text-white">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8fa0bd]">
                Goals
              </div>
              <div className="text-xl font-black text-[#00ff88] tabular-nums">
                {goalsScored} <span className="text-xs text-[#8fa0bd]">/ 5</span>
              </div>
            </div>
            <div className="h-7 w-px bg-[#253047]" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8fa0bd]">
                Round
              </div>
              <div className="text-xl font-black text-white tabular-nums">
                {round} <span className="text-xs text-[#8fa0bd]">/ 5</span>
              </div>
            </div>
            <div className="h-7 w-px bg-[#253047]" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8fa0bd]">
                Streak
              </div>
              <div className="text-xl font-black text-[#38bdf8] tabular-nums">
                {streak}
              </div>
            </div>
          </div>

          {/* 5-Kick Shootout Tally */}
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-[#28344d] bg-[rgba(11,15,25,0.88)] px-3.5 py-2.5">
            {roundsHistory.map((item) => {
              const colorClass =
                item.outcome === 'goal'
                  ? 'bg-[#00ff88] border-[#00ff88]'
                  : item.outcome === 'pending'
                  ? 'bg-[#192133] border-[#33415d]'
                  : 'bg-[#ff3355] border-[#ff3355]';
              return (
                <div
                  key={item.round}
                  className={`h-3.5 w-3.5 rounded-full border ${colorClass}`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Shot Power Meter & Outcome Banner (Playing) */}
      {phase === 'playing' && (
        <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          {lastBanner && (
            <div className="rounded-xl border border-[#00ff88]/50 bg-[rgba(10,14,22,0.92)] px-5 py-2 text-sm font-black tracking-wider text-white uppercase">
              {lastBanner}
            </div>
          )}
          {powerPct > 0 && (
            <div className="w-56 rounded-lg border border-[#2a364f] bg-[rgba(10,14,22,0.9)] p-1.5">
              <div className="flex justify-between text-[10px] font-bold text-[#9fb0cc] mb-1">
                <span>SHOT POWER</span>
                <span className="tabular-nums text-[#00ff88]">{powerPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded bg-[#1a2234]">
                <div
                  className="h-full bg-[#00ff88]"
                  style={{ width: `${powerPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* COLLAPSIBLE BOTTOM CONTROL DOCK (<= 15% footprint, solid rgba, no backdrop-filter) */}
      {phase === 'playing' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center max-w-[94vw]">
          <button
            onClick={() => setDockCollapsed((v) => !v)}
            className="mb-1 flex items-center gap-1 rounded-t-lg border border-b-0 border-[#28344d] bg-[rgba(11,15,25,0.92)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#9fb0cc] hover:text-white"
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
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-[#28344d] bg-[rgba(11,15,25,0.92)] px-3.5 py-2 text-xs text-white">
              {/* Curve Selector */}
              <div className="flex items-center gap-1 border-r border-[#242e44] pr-2.5">
                <span className="text-[10px] font-bold uppercase text-[#8fa0bd] mr-1">
                  Curve
                </span>
                {(
                  [
                    { val: -1, label: 'Left (Q)' },
                    { val: 0, label: 'Straight' },
                    { val: 1, label: 'Right (E)' },
                  ] as const
                ).map((c) => (
                  <button
                    key={c.val}
                    onClick={() => setCurveDir(c.val)}
                    className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
                      curveDir === c.val
                        ? 'bg-[#00ff88] text-black'
                        : 'bg-[#182032] text-[#b4c0d4] hover:text-white'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Camera Angle Selector */}
              <div className="flex items-center gap-1 border-r border-[#242e44] pr-2.5">
                <Camera className="h-3.5 w-3.5 text-[#00ff88] mr-0.5" />
                {(['striker', 'broadcast', 'keeper'] as const).map((cam) => (
                  <button
                    key={cam}
                    onClick={() => setCameraPreset(cam)}
                    className={`rounded-md px-2 py-1 text-[11px] font-bold capitalize transition-colors ${
                      cameraPreset === cam
                        ? 'bg-[#38bdf8] text-black'
                        : 'bg-[#182032] text-[#b4c0d4] hover:text-white'
                    }`}
                  >
                    {cam}
                  </button>
                ))}
              </div>

              {/* Audio & Pause */}
              <button
                onClick={toggleMute}
                className="flex items-center gap-1 rounded-md bg-[#182032] px-2.5 py-1 text-[11px] font-bold text-[#c6d1e3] hover:text-white"
                title="Toggle Stadium Sound"
              >
                {muted ? <VolumeX className="h-3.5 w-3.5 text-[#ff3355]" /> : <Volume2 className="h-3.5 w-3.5 text-[#00ff88]" />}
                <span>{muted ? 'Muted' : 'Audio'}</span>
              </button>

              <button
                onClick={() => syncPhase('paused')}
                className="flex items-center gap-1 rounded-md bg-[#182032] px-2.5 py-1 text-[11px] font-bold text-[#c6d1e3] hover:text-white"
              >
                <Pause className="h-3.5 w-3.5" />
                <span>Pause</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TITLE SCREEN OVERLAY */}
      {phase === 'title' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-between px-6 py-10 bg-[rgba(8,12,20,0.42)]">
          <div className="w-full max-w-4xl flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-xl border border-[#2c3852] bg-[rgba(11,15,25,0.9)] px-3.5 py-2 text-xs font-bold text-[#c6d1e3] hover:border-[#00ff88] hover:text-[#00ff88] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to FOOTYLive</span>
            </Link>

            <button
              onClick={toggleMute}
              className="flex items-center gap-1.5 rounded-xl border border-[#2c3852] bg-[rgba(11,15,25,0.9)] px-3 py-2 text-xs font-bold text-[#c6d1e3] hover:text-white"
            >
              {muted ? <VolumeX className="h-4 w-4 text-[#ff3355]" /> : <Volume2 className="h-4 w-4 text-[#00ff88]" />}
              <span>{muted ? 'Sound Off' : 'Sound On'}</span>
            </button>
          </div>

          {/* Bespoke Inline SVG Title Lockup over calm negative space */}
          <div className="flex flex-col items-center text-center max-w-2xl">
            <svg
              viewBox="0 0 640 140"
              className="w-full max-w-lg mb-4"
              aria-label="Penalty Arena 3D"
            >
              <rect
                x="140"
                y="8"
                width="360"
                height="26"
                rx="6"
                fill="rgba(0, 255, 136, 0.14)"
                stroke="#00ff88"
                strokeWidth="1.5"
              />
              <text
                x="320"
                y="26"
                textAnchor="middle"
                fill="#00ff88"
                fontSize="12"
                fontWeight="800"
                letterSpacing="4"
              >
                FOOTYLIVE 3D STADIUM EDITION
              </text>
              <text
                x="320"
                y="86"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="52"
                fontWeight="900"
                letterSpacing="2"
              >
                PENALTY <tspan fill="#00ff88">ARENA</tspan>
              </text>
              <line
                x1="120"
                y1="108"
                x2="520"
                y2="108"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="2"
              />
              <text
                x="320"
                y="130"
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="14"
                fontWeight="600"
                letterSpacing="3"
              >
                5-ROUND WORLD CUP SHOOTOUT
              </text>
            </svg>

            <button
              onClick={startNewMatch}
              className="mt-2 flex items-center gap-2.5 rounded-2xl bg-[#00ff88] px-8 py-4 text-base font-black uppercase tracking-wider text-black hover:bg-[#1dff98] transition-transform hover:scale-105 active:scale-95"
            >
              <Play className="h-5 w-5 fill-current" />
              <span>Kick Off Shootout</span>
            </button>
          </div>

          {/* Single Flat Control-Hint Line */}
          <div className="rounded-xl border border-[#28344d] bg-[rgba(11,15,25,0.9)] px-5 py-2.5 text-xs font-medium text-[#cbd5e1]">
            Aim: Mouse or WASD/Arrows · Hold Click or Space: Power &amp; Shoot · Q/E: Curve · Esc: Pause
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {phase === 'paused' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(6,9,16,0.75)] px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#2c3852] bg-[#101522] p-6 text-center space-y-5">
            <h2 className="text-xl font-black uppercase tracking-wider text-white">
              Match Paused
            </h2>
            <div className="space-y-2.5">
              <button
                onClick={() => syncPhase('playing')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00ff88] py-3 text-sm font-black text-black hover:bg-[#1dff98]"
              >
                <Play className="h-4 w-4 fill-current" />
                Resume Shootout
              </button>
              <button
                onClick={startNewMatch}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#2e3a54] bg-[#171f33] py-3 text-sm font-bold text-white hover:border-[#00ff88]"
              >
                <RotateCcw className="h-4 w-4" />
                Restart Match
              </button>
              <Link
                href="/"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#2e3a54] bg-[#121726] py-3 text-sm font-semibold text-[#b4c0d4] hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Exit to FOOTYLive
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY / GAME OVER MODAL */}
      {phase === 'gameover' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(6,9,16,0.78)] px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#2c3852] bg-[#101522] p-7 text-center space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00ff88]/15 border border-[#00ff88]/40 text-[#00ff88]">
              <Trophy className="h-7 w-7" />
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-[#00ff88]">
                {goalsScored >= 3 ? 'Shootout Victory' : 'Full Time'}
              </div>
              <h2 className="mt-1 text-2xl font-black text-white">
                {goalsScored >= 4
                  ? 'World Champion Finisher!'
                  : goalsScored >= 3
                  ? 'Clutch Shootout Win!'
                  : 'Keeper Held the Line'}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#232d45] bg-[#141a2b] p-4">
              <div>
                <div className="text-[11px] font-semibold text-[#8fa0bd]">
                  Final Score
                </div>
                <div className="text-2xl font-black text-[#00ff88] tabular-nums">
                  {goalsScored} / 5
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-[#8fa0bd]">
                  Best Streak
                </div>
                <div className="text-2xl font-black text-[#38bdf8] tabular-nums">
                  {bestStreak}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={startNewMatch}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00ff88] py-3 text-sm font-black text-black hover:bg-[#1dff98]"
              >
                <RotateCcw className="h-4 w-4" />
                Play Again
              </button>
              <Link
                href="/"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#2e3a54] bg-[#171f33] py-3 text-sm font-bold text-white hover:border-[#00ff88]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to FOOTYLive
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
