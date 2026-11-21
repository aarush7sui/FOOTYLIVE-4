'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ArrowLeft,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { buildFloodlightTower } from './penaltyScene';
import {
  ArticulatedPlayerRig,
  MatchAudioSynth,
  buildMatchPlayerRig,
  buildPitchGoalAssembly,
  createMatchAssets,
} from './fcMatchScene';

type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';
type Difficulty = 'rookie' | 'pro' | 'worldclass';

interface MatchDurationOption {
  label: string;
  seconds: number;
}

const DURATION_OPTIONS: MatchDurationOption[] = [
  { label: '90s Blitz', seconds: 90 },
  { label: '2m Match', seconds: 120 },
  { label: '3m Classic', seconds: 180 },
];

const PITCH_HALF_X = 28;
const PITCH_HALF_Z = 17;
const GOAL_HALF_W = 3.2;
const GOAL_HEIGHT = 2.3;
const BALL_RADIUS = 0.24;

interface PlayerEntity {
  id: number;
  team: 'home' | 'away';
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  name: string;
  number: number;
  pos: THREE.Vector2;
  vel: THREE.Vector2;
  basePos: THREE.Vector2;
  facing: number;
  stridePhase: number;
  kickAnim: number;
  tackleAnim: number;
  tackleCooldown: number;
  stunTimer: number;
  ignoreBallTimer: number;
  rig: ArticulatedPlayerRig;
}

interface RadarDot {
  x: number;
  z: number;
  team: 'home' | 'away';
  active: boolean;
}

// Module-scope scratch math objects (Zero GC inside render loop)
const _camGoal = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _camCurrentLook = new THREE.Vector3(0, 0.5, 0);
const _dummyObj = new THREE.Object3D();
const _tmpDir = new THREE.Vector2();
const _tmpTarget = new THREE.Vector2();

export const FcMatchGame: React.FC = () => {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const joystickPadRef = useRef<HTMLDivElement>(null);
  const joystickPointerIdRef = useRef<number | null>(null);

  // React HUD state
  const [phase, setPhase] = useState<GamePhase>('title');
  const [difficulty, setDifficulty] = useState<Difficulty>('pro');
  const [durationSec, setDurationSec] = useState<number>(120);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [matchMinute, setMatchMinute] = useState(0);
  const [shotsHome, setShotsHome] = useState(0);
  const [shotsAway, setShotsAway] = useState(0);
  const [isAttacking, setIsAttacking] = useState(true);
  const [activePlayerName, setActivePlayerName] = useState('K. VELLOR');
  const [shotPowerPct, setShotPowerPct] = useState(0);
  const [staminaPct, setStaminaPct] = useState(100);
  const [secondDefActive, setSecondDefActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [goalBanner, setGoalBanner] = useState<{
    team: 'home' | 'away';
    scorer: string;
    minute: number;
  } | null>(null);
  const [stickUi, setStickUi] = useState({ x: 0, y: 0 });
  const [radarDots, setRadarDots] = useState<{
    players: RadarDot[];
    ball: { x: number; z: number };
  }>({ players: [], ball: { x: 0, z: 0 } });

  const audioRef = useRef<MatchAudioSynth | null>(null);

  // Mutable simulation ref read inside rAF
  const simRef = useRef({
    phase: 'title' as GamePhase,
    difficulty: 'pro' as Difficulty,
    durationSec: 120,
    elapsedMatchSec: 0,
    homeScore: 0,
    awayScore: 0,
    shotsHome: 0,
    shotsAway: 0,
    activeHomeIdx: 5,
    ballCarrierIdx: null as number | null,
    lastTouchTeam: 'home' as 'home' | 'away',
    lastTouchName: 'K. VELLOR',

    // Ball 3D kinematics
    ballPos: new THREE.Vector3(0, BALL_RADIUS, 0),
    ballVel: new THREE.Vector3(0, 0, 0),
    ballSpin: new THREE.Vector3(0, 0, 0),

    // Continuous inputs (Keyboard + Touch Virtual Stick)
    keys: {} as Record<string, boolean>,
    stickX: 0,
    stickY: 0,
    sprintHeld: false,
    secondDefHeld: false,
    stamina: 100,

    // Shot charging
    isChargingShot: false,
    shotCharge: 0,
    skillBoostTimer: 0,

    // Edge-triggered actions queued for simulation tick
    queuedPass: false,
    queuedThrough: false,
    queuedSwitch: false,
    queuedTackle: false,
    queuedSkill: false,
    queuedShootRelease: false,
    queuedShootPower: 0.6,

    // Celebration / Reset / Feel
    goalFreezeTimer: 0,
    hitstopTimer: 0,
    shakeIntensity: 0,
    aiPassCooldown: 0.4,
    aiKickoffDone: false,
    confettiActive: false,
    confettiTimer: 0,
    confettiOriginX: 28,
    radarAccumulator: 0,
    needsMatchReset: false,
  });

  const syncPhase = useCallback((next: GamePhase) => {
    simRef.current.phase = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    simRef.current.difficulty = difficulty;
  }, [difficulty]);

  useEffect(() => {
    simRef.current.durationSec = durationSec;
  }, [durationSec]);

  const startNewMatch = useCallback(() => {
    const s = simRef.current;
    s.elapsedMatchSec = 0;
    s.homeScore = 0;
    s.awayScore = 0;
    s.shotsHome = 0;
    s.shotsAway = 0;
    s.activeHomeIdx = 5;
    s.ballCarrierIdx = 5;
    s.lastTouchTeam = 'home';
    s.lastTouchName = 'K. VELLOR';
    s.stamina = 100;
    s.isChargingShot = false;
    s.shotCharge = 0;
    s.goalFreezeTimer = 0;
    s.hitstopTimer = 0;
    s.shakeIntensity = 0;
    s.confettiActive = false;
    s.secondDefHeld = false;
    s.needsMatchReset = true;

    setHomeScore(0);
    setAwayScore(0);
    setMatchMinute(0);
    setShotsHome(0);
    setShotsAway(0);
    setIsAttacking(true);
    setActivePlayerName('K. VELLOR');
    setShotPowerPct(0);
    setStaminaPct(100);
    setSecondDefActive(false);
    setGoalBanner(null);
    syncPhase('playing');
    audioRef.current?.playWhistle(true);
  }, [syncPhase]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);

  // Context-sensitive FC Mobile Action Handlers (shared by Touch Buttons & Keyboard)
  const triggerPassOrSwitch = useCallback(() => {
    const s = simRef.current;
    if (s.phase !== 'playing' || s.goalFreezeTimer > 0) return;
    const carrierIsHome =
      s.ballCarrierIdx !== null && s.ballCarrierIdx < 6;
    if (carrierIsHome) {
      s.queuedPass = true;
    } else {
      s.queuedSwitch = true;
    }
  }, []);

  const triggerThroughOrPress = useCallback((pressed: boolean) => {
    const s = simRef.current;
    if (s.phase !== 'playing') return;
    const carrierIsHome =
      s.ballCarrierIdx !== null && s.ballCarrierIdx < 6;
    if (carrierIsHome) {
      if (pressed && s.goalFreezeTimer <= 0) {
        s.queuedThrough = true;
      }
      s.secondDefHeld = false;
      setSecondDefActive(false);
    } else {
      s.secondDefHeld = pressed;
      setSecondDefActive(pressed);
    }
  }, []);

  const startShootOrTackle = useCallback(() => {
    const s = simRef.current;
    if (s.phase !== 'playing' || s.goalFreezeTimer > 0) return;
    const carrierIsHome =
      s.ballCarrierIdx !== null && s.ballCarrierIdx < 6;
    if (carrierIsHome) {
      if (!s.isChargingShot) {
        s.isChargingShot = true;
        s.shotCharge = 0.22;
      }
    } else {
      s.queuedTackle = true;
    }
  }, []);

  const releaseShoot = useCallback(() => {
    const s = simRef.current;
    if (!s.isChargingShot) return;
    s.queuedShootPower = THREE.MathUtils.clamp(s.shotCharge, 0.25, 1.0);
    s.queuedShootRelease = true;
    s.isChargingShot = false;
    s.shotCharge = 0;
    setShotPowerPct(0);
  }, []);

  const triggerSprintOrSkill = useCallback((pressed: boolean) => {
    const s = simRef.current;
    s.sprintHeld = pressed;
    if (pressed && s.phase === 'playing' && s.goalFreezeTimer <= 0) {
      const carrierIsHome =
        s.ballCarrierIdx !== null && s.ballCarrierIdx < 6;
      if (carrierIsHome) {
        s.queuedSkill = true;
      }
    }
  }, []);

  // Virtual Analog Stick Handlers (Left Thumb Control)
  const updateStickFromClient = useCallback((clientX: number, clientY: number) => {
    const pad = joystickPadRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxRadius = rect.width * 0.42;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxRadius);
    const nx = dist > 2 ? (dx / dist) * (clamped / maxRadius) : 0;
    const ny = dist > 2 ? (dy / dist) * (clamped / maxRadius) : 0;
    simRef.current.stickX = nx;
    simRef.current.stickY = ny;
    setStickUi({ x: nx, y: ny });
  }, []);

  const resetStick = useCallback(() => {
    joystickPointerIdRef.current = null;
    simRef.current.stickX = 0;
    simRef.current.stickY = 0;
    setStickUi({ x: 0, y: 0 });
  }, []);

  // Keyboard Bindings (WASD/Arrows + K Pass/Switch + I Through/Press + Space/J Shoot/Tackle + Shift/L Sprint/Skill + Q Switch)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = simRef.current;
      s.keys[e.code] = true;

      if (e.code === 'Escape') {
        if (s.phase === 'playing') syncPhase('paused');
        else if (s.phase === 'paused') syncPhase('playing');
        return;
      }

      if (s.phase === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        startNewMatch();
        return;
      }

      if (s.phase !== 'playing') return;

      if (e.code === 'Space' || e.code === 'KeyJ') {
        e.preventDefault();
        if (!e.repeat) startShootOrTackle();
      } else if (e.code === 'KeyK' && !e.repeat) {
        triggerPassOrSwitch();
      } else if (e.code === 'KeyQ' && !e.repeat) {
        s.queuedSwitch = true;
      } else if (e.code === 'KeyI' && !e.repeat) {
        triggerThroughOrPress(true);
      } else if (
        (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyL') &&
        !e.repeat
      ) {
        triggerSprintOrSkill(true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const s = simRef.current;
      s.keys[e.code] = false;

      if (e.code === 'Space' || e.code === 'KeyJ') {
        releaseShoot();
      } else if (e.code === 'KeyI') {
        triggerThroughOrPress(false);
      } else if (
        e.code === 'ShiftLeft' ||
        e.code === 'ShiftRight' ||
        e.code === 'KeyL'
      ) {
        triggerSprintOrSkill(false);
      }
    };

    const onBlur = () => {
      const s = simRef.current;
      s.keys = {};
      s.sprintHeld = false;
      s.secondDefHeld = false;
      s.isChargingShot = false;
      s.shotCharge = 0;
      setShotPowerPct(0);
      setSecondDefActive(false);
      resetStick();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [
    releaseShoot,
    resetStick,
    startNewMatch,
    startShootOrTackle,
    syncPhase,
    triggerPassOrSwitch,
    triggerSprintOrSkill,
    triggerThroughOrPress,
  ]);

  // Main Three.js Mount & 60fps Simulation Loop
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const audio = new MatchAudioSynth();
    audioRef.current = audio;

    // 1. Software WebGL detection
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

    // 2. WebGLRenderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(
      mount.clientWidth || window.innerWidth,
      mount.clientHeight || window.innerHeight
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    // 3. Scene, Camera, RoomEnvironment & Fog
    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x090f1c);
    scene.background = skyColor;
    scene.fog = new THREE.FogExp2(0x090f1c, 0.0085);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      44,
      (mount.clientWidth || window.innerWidth) /
        (mount.clientHeight || window.innerHeight),
      0.2,
      260
    );
    camera.position.set(0, 18.5, 29);

    // 4. Warm Key + Cool Hemisphere Fill + Emerald Rim
    const hemiLight = new THREE.HemisphereLight(0x8db8ff, 0x163820, 0.78);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.25);
    keyLight.position.set(14, 34, 20);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 4;
    keyLight.shadow.camera.far = 95;
    keyLight.shadow.camera.left = -36;
    keyLight.shadow.camera.right = 36;
    keyLight.shadow.camera.top = 26;
    keyLight.shadow.camera.bottom = -26;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00ff88, 0.55);
    rimLight.position.set(-18, 16, -24);
    scene.add(rimLight);

    // 5. Pitch, Stadium Stands & Floodlights
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const assets = createMatchAssets(maxAnisotropy);

    // Extended surrounding turf apron (no indoor void wall)
    const outerTurfGeo = new THREE.PlaneGeometry(240, 200);
    outerTurfGeo.rotateX(-Math.PI / 2);
    const outerTurfMat = new THREE.MeshStandardMaterial({
      color: 0x10331c,
      roughness: 0.94,
    });
    const outerTurf = new THREE.Mesh(outerTurfGeo, outerTurfMat);
    outerTurf.position.y = -0.03;
    outerTurf.receiveShadow = true;
    scene.add(outerTurf);

    // Main playable stadium pitch (60m x 36.4m with painted margin)
    const pitchGeo = new THREE.PlaneGeometry(60.6, 36.8);
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
    pitchMesh.receiveShadow = true;
    scene.add(pitchMesh);
    assets.disposables.push(outerTurfGeo, outerTurfMat, pitchGeo, pitchMat);

    // Goals at X = -28 (Home Defends) and X = +28 (Away Defends)
    const homeGoal = buildPitchGoalAssembly(assets.netTexture, assets.disposables, 1);
    homeGoal.position.set(-PITCH_HALF_X, 0, 0);
    scene.add(homeGoal);

    const awayGoal = buildPitchGoalAssembly(assets.netTexture, assets.disposables, -1);
    awayGoal.position.set(PITCH_HALF_X, 0, 0);
    scene.add(awayGoal);

    // LED Perimeter Boards along North Touchline & Behind Both Goals
    const adMat = new THREE.MeshStandardMaterial({
      map: assets.adBoardTexture,
      emissive: 0x0b2016,
      emissiveMap: assets.adBoardTexture,
      emissiveIntensity: 0.55,
      roughness: 0.4,
    });
    const northAdGeo = new THREE.BoxGeometry(58, 1.0, 0.3);
    const northAd = new THREE.Mesh(northAdGeo, adMat);
    northAd.position.set(0, 0.5, -PITCH_HALF_Z - 2.6);
    scene.add(northAd);

    const endAdGeo = new THREE.BoxGeometry(0.3, 1.0, 34);
    const leftEndAd = new THREE.Mesh(endAdGeo, adMat);
    leftEndAd.position.set(-PITCH_HALF_X - 3.6, 0.5, 0);
    const rightEndAd = new THREE.Mesh(endAdGeo, adMat);
    rightEndAd.position.set(PITCH_HALF_X + 3.6, 0.5, 0);
    scene.add(leftEndAd, rightEndAd);

    // Stadium North Stand Tier + Instanced Crowd (360 spectators)
    const standGeo = new THREE.BoxGeometry(74, 7.5, 9);
    const standMat = new THREE.MeshStandardMaterial({
      color: 0x131926,
      roughness: 0.86,
      metalness: 0.1,
    });
    const northStand = new THREE.Mesh(standGeo, standMat);
    northStand.position.set(0, 3.7, -PITCH_HALF_Z - 9.2);
    scene.add(northStand);

    const crowdCount = 360;
    const seatGeo = new THREE.BoxGeometry(0.45, 0.65, 0.45);
    const seatMat = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.04 });
    const crowdMesh = new THREE.InstancedMesh(seatGeo, seatMat, crowdCount);
    const crowdColors = [
      new THREE.Color(0x00ff88),
      new THREE.Color(0xf8fafc),
      new THREE.Color(0xff3355),
      new THREE.Color(0x38bdf8),
      new THREE.Color(0x64748b),
    ];
    for (let i = 0; i < crowdCount; i++) {
      const row = Math.floor(i / 60);
      const col = i % 60;
      _dummyObj.position.set(
        -32.5 + col * 1.1 + (Math.random() - 0.5) * 0.25,
        2.0 + row * 0.95,
        -PITCH_HALF_Z - 5.4 - row * 0.9
      );
      _dummyObj.scale.setScalar(0.85 + Math.random() * 0.25);
      _dummyObj.updateMatrix();
      crowdMesh.setMatrixAt(i, _dummyObj.matrix);
      crowdMesh.setColorAt(i, crowdColors[i % crowdColors.length]);
    }
    crowdMesh.instanceMatrix.needsUpdate = true;
    if (crowdMesh.instanceColor) crowdMesh.instanceColor.needsUpdate = true;
    crowdMesh.computeBoundingSphere();
    scene.add(crowdMesh);
    assets.disposables.push(adMat, northAdGeo, endAdGeo, standGeo, standMat, seatGeo, seatMat);

    // 4 Corner Stadium Floodlight Towers
    const towerSpots: Array<[number, number, number]> = [
      [-35, -24, 0.6],
      [35, -24, -0.6],
      [-35, 24, 2.5],
      [35, 24, -2.5],
    ];
    towerSpots.forEach(([tx, tz, rot]) => {
      const tower = buildFloodlightTower(assets.disposables);
      tower.position.set(tx, 0, tz);
      tower.rotation.y = rot;
      scene.add(tower);
    });

    // 6. Match Football + Ground Shadow
    const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 24, 24);
    const ballMat = new THREE.MeshStandardMaterial({
      map: assets.ballTexture,
      roughness: 0.36,
      metalness: 0.08,
    });
    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.castShadow = true;
    scene.add(ballMesh);

    const bShadowGeo = new THREE.PlaneGeometry(0.85, 0.85);
    bShadowGeo.rotateX(-Math.PI / 2);
    const bShadowMat = new THREE.MeshBasicMaterial({
      map: assets.contactShadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.52,
    });
    const ballShadow = new THREE.Mesh(bShadowGeo, bShadowMat);
    ballShadow.position.y = 0.025;
    scene.add(ballShadow);
    assets.disposables.push(ballGeo, ballMat, bShadowGeo, bShadowMat);

    // 7. Confetti InstancedMesh on Goals
    const confettiCount = 56;
    const confettiGeo = new THREE.PlaneGeometry(0.22, 0.14);
    const confettiMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const confettiMesh = new THREE.InstancedMesh(confettiGeo, confettiMat, confettiCount);
    confettiMesh.frustumCulled = false;
    confettiMesh.visible = false;
    const confettiPos = Array.from({ length: confettiCount }, () => new THREE.Vector3());
    const confettiVel = Array.from({ length: confettiCount }, () => new THREE.Vector3());
    for (let i = 0; i < confettiCount; i++) {
      confettiMesh.setColorAt(i, crowdColors[i % crowdColors.length]);
    }
    if (confettiMesh.instanceColor) confettiMesh.instanceColor.needsUpdate = true;
    scene.add(confettiMesh);
    assets.disposables.push(confettiGeo, confettiMat);

    // 8. 6v6 Roster Setup (Home: Emerald #00ff88, Away: Crimson #ff3355)
    const skinTones = [0xf1c27d, 0xc68642, 0x8d5524, 0xe0ac69, 0xf5cfa0, 0x7a4928];
    const hairTones = [0x111827, 0x3b2314, 0x0f172a, 0x6b4423, 0x1e293b, 0x111111];

    const rosterDefs: Array<{
      team: 'home' | 'away';
      role: 'GK' | 'DEF' | 'MID' | 'FWD';
      name: string;
      num: number;
      bx: number;
      bz: number;
    }> = [
      { team: 'home', role: 'GK', name: 'M. COSTA', num: 1, bx: -26.4, bz: 0 },
      { team: 'home', role: 'DEF', name: 'R. DIAS', num: 4, bx: -14.5, bz: -5.6 },
      { team: 'home', role: 'DEF', name: 'L. SALIBA', num: 2, bx: -14.5, bz: 5.6 },
      { team: 'home', role: 'MID', name: 'J. BELLING', num: 8, bx: -4.5, bz: 0 },
      { team: 'home', role: 'FWD', name: 'L. YAMAL', num: 19, bx: 5.5, bz: 7.4 },
      { team: 'home', role: 'FWD', name: 'K. VELLOR', num: 9, bx: 4.5, bz: -3.2 },

      { team: 'away', role: 'GK', name: 'T. COURTO', num: 1, bx: 26.4, bz: 0 },
      { team: 'away', role: 'DEF', name: 'E. MILITAO', num: 3, bx: 14.5, bz: -5.6 },
      { team: 'away', role: 'DEF', name: 'A. RUDIGER', num: 22, bx: 14.5, bz: 5.6 },
      { team: 'away', role: 'MID', name: 'F. VALVERD', num: 15, bx: 4.5, bz: 0 },
      { team: 'away', role: 'FWD', name: 'V. JUNIOR', num: 7, bx: -5.5, bz: -7.4 },
      { team: 'away', role: 'FWD', name: 'K. MBAPPO', num: 10, bx: -4.5, bz: 3.2 },
    ];

    const players: PlayerEntity[] = rosterDefs.map((def, idx) => {
      const isHome = def.team === 'home';
      const isGk = def.role === 'GK';
      const jersey = isGk
        ? isHome
          ? 0xf59e0b
          : 0x38bdf8
        : isHome
        ? 0x059669
        : 0xe11d48;
      const shorts = isHome ? 0x0f172a : 0xf8fafc;
      const accent = isHome ? 0x00ff88 : 0xffccd5;
      const ring = isHome ? 0x00ff88 : 0xff3355;

      const rig = buildMatchPlayerRig(
        assets.disposables,
        assets.contactShadowTexture,
        jersey,
        shorts,
        accent,
        skinTones[idx % skinTones.length],
        hairTones[idx % hairTones.length],
        ring
      );
      scene.add(rig.root);

      return {
        id: idx,
        team: def.team,
        role: def.role,
        name: def.name,
        number: def.num,
        pos: new THREE.Vector2(def.bx, def.bz),
        vel: new THREE.Vector2(0, 0),
        basePos: new THREE.Vector2(def.bx, def.bz),
        facing: isHome ? Math.PI / 2 : -Math.PI / 2,
        stridePhase: Math.random() * Math.PI * 2,
        kickAnim: 0,
        tackleAnim: 0,
        tackleCooldown: 0,
        stunTimer: 0,
        ignoreBallTimer: 0,
        rig,
      };
    });

    const resetKickoffPositions = (kickoffTeam: 'home' | 'away') => {
      const s = simRef.current;
      players.forEach((p) => {
        // Pull forwards behind halfway line on kickoff
        let startX = p.basePos.x;
        let startZ = p.basePos.y;
        if (p.team === 'home' && startX > -1.2) startX = -3.8;
        if (p.team === 'away' && startX < 1.2) startX = 3.8;
        if (p.id === 5 && kickoffTeam === 'home') {
          startX = -0.5;
          startZ = 0;
        }
        if (p.id === 11 && kickoffTeam === 'away') {
          startX = 0.5;
          startZ = 0;
        }
        p.pos.set(startX, startZ);
        p.vel.set(0, 0);
        p.facing = p.team === 'home' ? Math.PI / 2 : -Math.PI / 2;
        p.kickAnim = 0;
        p.tackleAnim = 0;
        p.stunTimer = 0;
        p.ignoreBallTimer = 0;
      });
      s.ballPos.set(0, BALL_RADIUS, 0);
      s.ballVel.set(0, 0, 0);
      s.ballSpin.set(0, 0, 0);
      s.activeHomeIdx = 5;
      s.ballCarrierIdx = kickoffTeam === 'home' ? 5 : 11;
      s.aiPassCooldown = 0.55;
      setActivePlayerName(players[5].name);
      setIsAttacking(kickoffTeam === 'home');
    };

    resetKickoffPositions('home');

    const triggerGoalConfetti = (goalX: number) => {
      const s = simRef.current;
      s.confettiActive = true;
      s.confettiTimer = 2.0;
      s.confettiOriginX = goalX;
      confettiMesh.visible = true;
      for (let i = 0; i < confettiCount; i++) {
        confettiPos[i].set(
          goalX,
          0.6 + Math.random() * 1.8,
          (Math.random() - 0.5) * 6.8
        );
        confettiVel[i].set(
          (goalX > 0 ? -1 : 1) * (1.5 + Math.random() * 4.5),
          4.2 + Math.random() * 4.8,
          (Math.random() - 0.5) * 5.2
        );
      }
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const onResize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    };
    window.addEventListener('resize', onResize);

    // Helper: pick best Home/Away pass target
    const findPassTarget = (
      passer: PlayerEntity,
      aimX: number,
      aimZ: number,
      preferForward: boolean
    ): PlayerEntity => {
      const hasStickAim = Math.hypot(aimX, aimZ) > 0.25;
      let best: PlayerEntity | null = null;
      let bestScore = -Infinity;

      for (const cand of players) {
        if (cand.team !== passer.team || cand.id === passer.id) continue;
        if (cand.role === 'GK' && preferForward) continue;
        const dx = cand.pos.x - passer.pos.x;
        const dz = cand.pos.y - passer.pos.y;
        const dist = Math.hypot(dx, dz);
        if (dist < 2.2) continue;

        let dirScore = 0;
        if (hasStickAim) {
          dirScore = (dx * aimX + dz * aimZ) / dist;
        } else {
          const attackDir = passer.team === 'home' ? 1 : -1;
          dirScore = (dx * attackDir) / dist;
        }

        const distPenalty = Math.abs(dist - 11) * 0.045;
        const roleBonus = cand.role === 'FWD' && preferForward ? 0.35 : 0;
        const score = dirScore * 2.1 + roleBonus - distPenalty;
        if (score > bestScore) {
          bestScore = score;
          best = cand;
        }
      }
      return best || players.find((p) => p.team === passer.team && p.id !== passer.id)!;
    };

    const kickBall = (
      kicker: PlayerEntity,
      tx: number,
      tz: number,
      speed: number,
      loftY: number
    ) => {
      const s = simRef.current;
      const dx = tx - s.ballPos.x;
      const dz = tz - s.ballPos.z;
      const len = Math.max(0.01, Math.hypot(dx, dz));
      s.ballVel.set((dx / len) * speed, loftY, (dz / len) * speed);
      s.ballSpin.set((dz / len) * 12, 0, -(dx / len) * 12);
      s.ballCarrierIdx = null;
      s.lastTouchTeam = kicker.team;
      s.lastTouchName = kicker.name;
      kicker.ignoreBallTimer = 0.22;
      kicker.kickAnim = 0.28;
      kicker.facing = Math.atan2(dx, dz);
      audio.playKick(Math.min(1, speed / 26));
    };

    // Main Loop with Software WebGL Pacing
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

      if (s.needsMatchReset) {
        s.needsMatchReset = false;
        resetKickoffPositions('home');
      }

      if (s.hitstopTimer > 0) {
        s.hitstopTimer = Math.max(0, s.hitstopTimer - dt);
      } else if (s.phase === 'playing') {
        // Handle Goal Freeze Celebration -> Reset to Kickoff
        if (s.goalFreezeTimer > 0) {
          s.goalFreezeTimer -= dt;
          if (s.goalFreezeTimer <= 0) {
            const concedingTeam = s.lastTouchTeam === 'home' ? 'away' : 'home';
            setGoalBanner(null);
            resetKickoffPositions(concedingTeam);
            audio.playWhistle(false);
          }
        } else {
          // 1. Match Clock Progression (0 -> 90 minutes)
          s.elapsedMatchSec += dt;
          const minuteNow = Math.min(
            90,
            Math.floor((s.elapsedMatchSec / s.durationSec) * 90)
          );
          setMatchMinute(minuteNow);
          if (s.elapsedMatchSec >= s.durationSec) {
            syncPhase('gameover');
            audio.playWhistle(true);
          }

          // 2. Shot Charge & Skill Burst Timers
          if (s.isChargingShot) {
            s.shotCharge = Math.min(1.0, s.shotCharge + dt * 1.45);
            setShotPowerPct(Math.round(s.shotCharge * 100));
          }
          if (s.skillBoostTimer > 0) s.skillBoostTimer = Math.max(0, s.skillBoostTimer - dt);

          // Combined Left Stick + Keyboard Directional Input
          let keyX = 0;
          let keyZ = 0;
          if (s.keys['KeyA'] || s.keys['ArrowLeft']) keyX -= 1;
          if (s.keys['KeyD'] || s.keys['ArrowRight']) keyX += 1;
          if (s.keys['KeyW'] || s.keys['ArrowUp']) keyZ -= 1;
          if (s.keys['KeyS'] || s.keys['ArrowDown']) keyZ += 1;
          const inX = Math.abs(s.stickX) > 0.08 ? s.stickX : keyX;
          const inZ = Math.abs(s.stickY) > 0.08 ? s.stickY : keyZ;
          const inLen = Math.hypot(inX, inZ);
          const dirX = inLen > 1 ? inX / inLen : inX;
          const dirZ = inLen > 1 ? inZ / inLen : inZ;

          // Stamina update
          const wantsSprint = s.sprintHeld && inLen > 0.15 && s.stamina > 2;
          if (wantsSprint) {
            s.stamina = Math.max(0, s.stamina - dt * 24);
          } else {
            s.stamina = Math.min(100, s.stamina + dt * 16);
          }
          setStaminaPct(Math.round(s.stamina));

          // Auto-switch to nearest Home fielder if loose ball approaches a different Home player
          if (s.ballCarrierIdx === null) {
            let bestHome = s.activeHomeIdx;
            let bestDist = Infinity;
            for (let i = 1; i < 6; i++) {
              const d = Math.hypot(
                players[i].pos.x - s.ballPos.x,
                players[i].pos.y - s.ballPos.z
              );
              if (d < bestDist) {
                bestDist = d;
                bestHome = i;
              }
            }
            if (bestHome !== s.activeHomeIdx && bestDist < 4.0) {
              s.activeHomeIdx = bestHome;
              setActivePlayerName(players[bestHome].name);
            }
          }

          // Edge-triggered player actions
          const activePlayer = players[s.activeHomeIdx];

          if (s.queuedSwitch) {
            s.queuedSwitch = false;
            let bestIdx = s.activeHomeIdx;
            let bestD = Infinity;
            for (let i = 1; i < 6; i++) {
              if (i === s.activeHomeIdx) continue;
              const d = Math.hypot(
                players[i].pos.x - s.ballPos.x,
                players[i].pos.y - s.ballPos.z
              );
              if (d < bestD) {
                bestD = d;
                bestIdx = i;
              }
            }
            s.activeHomeIdx = bestIdx;
            setActivePlayerName(players[bestIdx].name);
          }

          if (s.queuedSkill && s.ballCarrierIdx === activePlayer.id) {
            s.queuedSkill = false;
            s.skillBoostTimer = 0.28;
          } else {
            s.queuedSkill = false;
          }

          if (s.queuedPass && s.ballCarrierIdx !== null && s.ballCarrierIdx < 6) {
            s.queuedPass = false;
            const passer = players[s.ballCarrierIdx];
            const target = findPassTarget(passer, dirX, dirZ, false);
            const dist = passer.pos.distanceTo(target.pos);
            kickBall(
              passer,
              target.pos.x + target.vel.x * 0.25,
              target.pos.y + target.vel.y * 0.25,
              THREE.MathUtils.clamp(12.5 + dist * 0.65, 14, 23),
              0.4
            );
            s.activeHomeIdx = target.id;
            setActivePlayerName(target.name);
          } else {
            s.queuedPass = false;
          }

          if (s.queuedThrough && s.ballCarrierIdx !== null && s.ballCarrierIdx < 6) {
            s.queuedThrough = false;
            const passer = players[s.ballCarrierIdx];
            const target = findPassTarget(passer, dirX, dirZ, true);
            const leadX = Math.min(PITCH_HALF_X - 3, target.pos.x + 5.2);
            const leadZ = THREE.MathUtils.clamp(target.pos.y + dirZ * 2.2, -PITCH_HALF_Z + 2, PITCH_HALF_Z - 2);
            const dist = Math.hypot(leadX - passer.pos.x, leadZ - passer.pos.y);
            kickBall(
              passer,
              leadX,
              leadZ,
              THREE.MathUtils.clamp(15.5 + dist * 0.62, 17, 26),
              1.1
            );
            s.activeHomeIdx = target.id;
            setActivePlayerName(target.name);
          } else {
            s.queuedThrough = false;
          }

          if (s.queuedShootRelease && s.ballCarrierIdx !== null && s.ballCarrierIdx < 6) {
            s.queuedShootRelease = false;
            const shooter = players[s.ballCarrierIdx];
            const pwr = s.queuedShootPower;
            const aimCornerZ = THREE.MathUtils.clamp(
              dirZ * 3.0 + (shooter.pos.y > 0 ? -0.9 : 0.9),
              -GOAL_HALF_W + 0.35,
              GOAL_HALF_W - 0.35
            );
            kickBall(
              shooter,
              PITCH_HALF_X + 0.6,
              aimCornerZ,
              21 + pwr * 12.5,
              1.8 + pwr * 4.4
            );
            s.shotsHome += 1;
            setShotsHome(s.shotsHome);
            s.shakeIntensity = 0.14 * pwr;
          } else {
            s.queuedShootRelease = false;
          }

          if (s.queuedTackle) {
            s.queuedTackle = false;
            if (activePlayer.tackleCooldown <= 0 && s.ballCarrierIdx !== activePlayer.id) {
              activePlayer.tackleAnim = 0.28;
              activePlayer.tackleCooldown = 0.65;
              const toBallX = s.ballPos.x - activePlayer.pos.x;
              const toBallZ = s.ballPos.z - activePlayer.pos.y;
              const len = Math.max(0.01, Math.hypot(toBallX, toBallZ));
              activePlayer.vel.set((toBallX / len) * 14.5, (toBallZ / len) * 14.5);
              activePlayer.facing = Math.atan2(toBallX, toBallZ);
              audio.playTackle();
            }
          }

          // 3. Update All 12 Players (User Controlled + Teammates + Away AI + Goalkeepers)
          const diffMult =
            s.difficulty === 'rookie' ? 0.78 : s.difficulty === 'pro' ? 0.94 : 1.08;
          const ballX = s.ballPos.x;
          const ballZ = s.ballPos.z;
          const homeHasBall = s.ballCarrierIdx !== null && s.ballCarrierIdx < 6;
          const awayHasBall = s.ballCarrierIdx !== null && s.ballCarrierIdx >= 6;
          setIsAttacking(homeHasBall || s.ballCarrierIdx === null);

          if (s.aiPassCooldown > 0) s.aiPassCooldown -= dt;

          // Closest away defender to ball for pressing
          let closestAwayIdx = 9;
          let minAwayDist = Infinity;
          for (let i = 7; i < 12; i++) {
            const d = Math.hypot(players[i].pos.x - ballX, players[i].pos.y - ballZ);
            if (d < minAwayDist) {
              minAwayDist = d;
              closestAwayIdx = i;
            }
          }

          // Optional 2nd Home Defender press
          let secondHomePressIdx = -1;
          if (s.secondDefHeld && !homeHasBall) {
            let bestD = Infinity;
            for (let i = 1; i < 6; i++) {
              if (i === s.activeHomeIdx) continue;
              const d = Math.hypot(players[i].pos.x - ballX, players[i].pos.y - ballZ);
              if (d < bestD) {
                bestD = d;
                secondHomePressIdx = i;
              }
            }
          }

          for (const p of players) {
            if (p.kickAnim > 0) p.kickAnim = Math.max(0, p.kickAnim - dt);
            if (p.tackleAnim > 0) p.tackleAnim = Math.max(0, p.tackleAnim - dt);
            if (p.tackleCooldown > 0) p.tackleCooldown = Math.max(0, p.tackleCooldown - dt);
            if (p.stunTimer > 0) p.stunTimer = Math.max(0, p.stunTimer - dt);
            if (p.ignoreBallTimer > 0) p.ignoreBallTimer = Math.max(0, p.ignoreBallTimer - dt);

            if (p.tackleAnim > 0) {
              p.pos.addScaledVector(p.vel, dt);
              p.vel.multiplyScalar(Math.exp(-5 * dt));
            } else if (p.stunTimer > 0) {
              p.vel.multiplyScalar(Math.exp(-8 * dt));
              p.pos.addScaledVector(p.vel, dt);
            } else if (p.id === s.activeHomeIdx) {
              // User-controlled active player
              const dribblePenalty = s.ballCarrierIdx === p.id ? 0.93 : 1.0;
              const sprintMult = wantsSprint ? 1.38 : 1.0;
              const skillMult = s.skillBoostTimer > 0 ? 1.32 : 1.0;
              const topSpeed = 7.6 * dribblePenalty * sprintMult * skillMult;
              _tmpDir.set(dirX * topSpeed, dirZ * topSpeed);
              p.vel.x = THREE.MathUtils.damp(p.vel.x, _tmpDir.x, 12, dt);
              p.vel.y = THREE.MathUtils.damp(p.vel.y, _tmpDir.y, 12, dt);
              p.pos.addScaledVector(p.vel, dt);
            } else if (p.role === 'GK') {
              // Goalkeeper positioning & reaction
              const goalX = p.team === 'home' ? -PITCH_HALF_X + 1.3 : PITCH_HALF_X - 1.3;
              const trackZ = THREE.MathUtils.clamp(ballZ * 0.42, -GOAL_HALF_W + 0.55, GOAL_HALF_W - 0.55);
              _tmpTarget.set(goalX, trackZ);
              const dx = _tmpTarget.x - p.pos.x;
              const dz = _tmpTarget.y - p.pos.y;
              const gkSpeed = p.team === 'away' ? 6.2 * diffMult : 6.0;
              p.vel.x = THREE.MathUtils.damp(p.vel.x, THREE.MathUtils.clamp(dx * 5, -gkSpeed, gkSpeed), 10, dt);
              p.vel.y = THREE.MathUtils.damp(p.vel.y, THREE.MathUtils.clamp(dz * 5, -gkSpeed, gkSpeed), 10, dt);
              p.pos.addScaledVector(p.vel, dt);

              // GK auto-clear if holding ball
              if (s.ballCarrierIdx === p.id && s.aiPassCooldown <= 0) {
                const mate = findPassTarget(p, p.team === 'home' ? 1 : -1, 0, false);
                kickBall(p, mate.pos.x, mate.pos.y, 18.5, 2.2);
                if (p.team === 'home') {
                  s.activeHomeIdx = mate.id;
                  setActivePlayerName(mate.name);
                }
                s.aiPassCooldown = 0.6;
              }
            } else if (p.team === 'home') {
              // Home Teammate Tactical AI
              let tx = p.basePos.x + ballX * 0.36;
              let tz = p.basePos.y;
              let pace = 6.6;

              if (p.id === secondHomePressIdx) {
                tx = ballX;
                tz = ballZ;
                pace = 7.7;
              } else if (homeHasBall) {
                if (p.role === 'FWD') {
                  tx = Math.min(PITCH_HALF_X - 4.2, Math.max(ballX + 5.5, p.basePos.x + 11));
                  tz = p.basePos.y + Math.sin(elapsed * 1.1 + p.id) * 1.8;
                  pace = 7.4;
                } else if (p.role === 'MID') {
                  tx = THREE.MathUtils.clamp(ballX + 1.5, -12, 18);
                  tz = p.pos.y > 0 ? 4.2 : -4.2;
                } else {
                  tx = THREE.MathUtils.clamp(ballX - 11, -21, 3);
                }
              } else {
                tx = THREE.MathUtils.clamp(p.basePos.x + ballX * 0.45, -24, 14);
                tz = THREE.MathUtils.clamp(p.basePos.y + ballZ * 0.35, -PITCH_HALF_Z + 2, PITCH_HALF_Z - 2);
              }

              const dx = tx - p.pos.x;
              const dz = tz - p.pos.y;
              const d = Math.hypot(dx, dz);
              if (d > 0.6) {
                _tmpDir.set((dx / d) * pace, (dz / d) * pace);
              } else {
                _tmpDir.set(0, 0);
              }
              p.vel.x = THREE.MathUtils.damp(p.vel.x, _tmpDir.x, 8, dt);
              p.vel.y = THREE.MathUtils.damp(p.vel.y, _tmpDir.y, 8, dt);
              p.pos.addScaledVector(p.vel, dt);
            } else {
              // Away Team AI
              let tx = p.basePos.x;
              let tz = p.basePos.y;
              let pace = 6.5 * diffMult;

              if (s.ballCarrierIdx === p.id) {
                // Away carrier dribbles toward Home goal (-28, 0), dodges or passes or shoots
                tx = -PITCH_HALF_X + 4.5;
                tz = THREE.MathUtils.clamp(Math.sin(elapsed * 1.6 + p.id) * 3.8, -6.5, 6.5);
                pace = 6.9 * diffMult;

                // Shoot if in range!
                if (p.pos.x < -12.5 && s.aiPassCooldown <= 0) {
                  const targetZ = THREE.MathUtils.clamp(
                    (Math.random() - 0.5) * 4.8,
                    -GOAL_HALF_W + 0.4,
                    GOAL_HALF_W - 0.4
                  );
                  kickBall(p, -PITCH_HALF_X - 0.6, targetZ, 21 * diffMult + 2, 2.2 + Math.random() * 2.5);
                  s.shotsAway += 1;
                  setShotsAway(s.shotsAway);
                  s.aiPassCooldown = 0.7;
                } else if (s.aiPassCooldown <= 0) {
                  // Check if pressed closely by a Home player -> pass forward
                  let pressed = false;
                  for (let h = 1; h < 6; h++) {
                    if (players[h].pos.distanceTo(p.pos) < 3.0) {
                      pressed = true;
                      break;
                    }
                  }
                  if (pressed && Math.random() < 0.08 * diffMult) {
                    const mate = findPassTarget(p, -1, 0, true);
                    kickBall(p, mate.pos.x - 1.5, mate.pos.y, 17, 0.5);
                    s.aiPassCooldown = 0.75;
                  }
                }
              } else if (p.id === closestAwayIdx && !awayHasBall) {
                // Press ball carrier
                tx = ballX;
                tz = ballZ;
                pace = 7.2 * diffMult;
                if (
                  homeHasBall &&
                  p.tackleCooldown <= 0 &&
                  p.pos.distanceTo(players[s.ballCarrierIdx!].pos) < 1.35 &&
                  Math.random() < 0.045 * diffMult
                ) {
                  p.tackleAnim = 0.25;
                  p.tackleCooldown = 1.1;
                  const toBX = ballX - p.pos.x;
                  const toBZ = ballZ - p.pos.y;
                  const len = Math.max(0.01, Math.hypot(toBX, toBZ));
                  p.vel.set((toBX / len) * 12.2, (toBZ / len) * 12.2);
                  audio.playTackle();
                }
              } else if (awayHasBall) {
                if (p.role === 'FWD') {
                  tx = Math.max(-PITCH_HALF_X + 4.5, ballX - 6.5);
                  tz = p.basePos.y + Math.cos(elapsed + p.id) * 2.0;
                } else {
                  tx = THREE.MathUtils.clamp(ballX + 8, -14, 21);
                  tz = p.basePos.y;
                }
              } else {
                tx = THREE.MathUtils.clamp(p.basePos.x + ballX * 0.42, -16, 24);
                tz = THREE.MathUtils.clamp(p.basePos.y + ballZ * 0.35, -PITCH_HALF_Z + 2, PITCH_HALF_Z - 2);
              }

              const dx = tx - p.pos.x;
              const dz = tz - p.pos.y;
              const d = Math.hypot(dx, dz);
              if (d > 0.55) {
                _tmpDir.set((dx / d) * pace, (dz / d) * pace);
              } else {
                _tmpDir.set(0, 0);
              }
              p.vel.x = THREE.MathUtils.damp(p.vel.x, _tmpDir.x, 7.5, dt);
              p.vel.y = THREE.MathUtils.damp(p.vel.y, _tmpDir.y, 7.5, dt);
              p.pos.addScaledVector(p.vel, dt);
            }

            // Clamp players within pitch boundaries
            p.pos.x = THREE.MathUtils.clamp(p.pos.x, -PITCH_HALF_X + 0.6, PITCH_HALF_X - 0.6);
            p.pos.y = THREE.MathUtils.clamp(p.pos.y, -PITCH_HALF_Z + 0.6, PITCH_HALF_Z - 0.6);

            // Facing angle smooth turn
            const speed = p.vel.length();
            if (speed > 0.35) {
              const targetAngle = Math.atan2(p.vel.x, p.vel.y);
              let diff = targetAngle - p.facing;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              p.facing += diff * Math.min(1, dt * 12);
            }
          }

          // Gentle player-to-player body separation
          for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
              const a = players[i];
              const b = players[j];
              const dx = b.pos.x - a.pos.x;
              const dz = b.pos.y - a.pos.y;
              const dist = Math.hypot(dx, dz);
              if (dist > 0.001 && dist < 0.95) {
                const push = (0.95 - dist) * 0.5;
                const nx = dx / dist;
                const nz = dz / dist;
                a.pos.x -= nx * push;
                a.pos.y -= nz * push;
                b.pos.x += nx * push;
                b.pos.y += nz * push;
              }
            }
          }

          // 4. Ball Dribbling, Interceptions & 3D Ball Physics
          if (s.ballCarrierIdx !== null) {
            const carrier = players[s.ballCarrierIdx];
            const fx = Math.sin(carrier.facing);
            const fz = Math.cos(carrier.facing);
            s.ballPos.set(
              carrier.pos.x + fx * 0.62,
              BALL_RADIUS,
              carrier.pos.y + fz * 0.62
            );
            s.ballVel.set(carrier.vel.x, 0, carrier.vel.y);
            s.ballSpin.set(carrier.vel.y * 2.5, 0, -carrier.vel.x * 2.5);

            // Check tackle / steal from opposite team
            for (const opp of players) {
              if (opp.team === carrier.team || opp.stunTimer > 0) continue;
              const stealDist = opp.tackleAnim > 0 ? 1.15 : opp.role === 'GK' ? 1.05 : 0.78;
              const distToBall = Math.hypot(
                opp.pos.x - s.ballPos.x,
                opp.pos.y - s.ballPos.z
              );
              if (distToBall < stealDist) {
                carrier.stunTimer = 0.55;
                carrier.ignoreBallTimer = 0.55;
                s.ballCarrierIdx = opp.id;
                s.lastTouchTeam = opp.team;
                s.lastTouchName = opp.name;
                s.aiPassCooldown = 0.45;
                if (opp.team === 'home') {
                  s.activeHomeIdx = opp.id;
                  setActivePlayerName(opp.name);
                }
                audio.playTackle();
                break;
              }
            }
          } else {
            // Free flight / rolling physics
            s.ballVel.y -= 14.5 * dt;
            s.ballPos.addScaledVector(s.ballVel, dt);

            if (s.ballPos.y <= BALL_RADIUS) {
              s.ballPos.y = BALL_RADIUS;
              if (s.ballVel.y < -1.8) {
                s.ballVel.y = -s.ballVel.y * 0.52;
              } else {
                s.ballVel.y = 0;
              }
              const grassDrag = Math.exp(-1.55 * dt);
              s.ballVel.x *= grassDrag;
              s.ballVel.z *= grassDrag;
            }

            // Check Goal Line Crossing & Goalpost Collisions
            const inGoalZ = Math.abs(s.ballPos.z) < GOAL_HALF_W - 0.14;
            const underBar = s.ballPos.y < GOAL_HEIGHT - 0.12;
            const hitPostZ = Math.abs(Math.abs(s.ballPos.z) - GOAL_HALF_W) < 0.24 && s.ballPos.y < GOAL_HEIGHT + 0.18;
            const hitCrossbarY = Math.abs(s.ballPos.z) <= GOAL_HALF_W + 0.2 && Math.abs(s.ballPos.y - GOAL_HEIGHT) < 0.24;

            if (s.ballPos.x >= PITCH_HALF_X) {
              if (inGoalZ && underBar) {
                // HOME SCORES!
                s.homeScore += 1;
                setHomeScore(s.homeScore);
                s.goalFreezeTimer = 2.3;
                s.hitstopTimer = 0.055;
                s.shakeIntensity = 0.34;
                s.ballVel.multiplyScalar(0.3);
                triggerGoalConfetti(PITCH_HALF_X);
                audio.playGoalCheer();
                setGoalBanner({
                  team: 'home',
                  scorer: s.lastTouchTeam === 'home' ? s.lastTouchName : 'K. VELLOR',
                  minute: Math.max(1, minuteNow),
                });
              } else if (hitPostZ || hitCrossbarY) {
                s.ballPos.x = PITCH_HALF_X - 0.25;
                s.ballVel.x = -Math.abs(s.ballVel.x) * 0.62;
                s.shakeIntensity = 0.22;
                audio.playPostClang();
              } else {
                // Rebound off end-boards to keep arcade match flowing smoothly
                s.ballPos.x = PITCH_HALF_X - 0.35;
                s.ballVel.x = -Math.max(4.5, Math.abs(s.ballVel.x) * 0.45);
              }
            } else if (s.ballPos.x <= -PITCH_HALF_X) {
              if (inGoalZ && underBar) {
                // AWAY SCORES!
                s.awayScore += 1;
                setAwayScore(s.awayScore);
                s.goalFreezeTimer = 2.3;
                s.hitstopTimer = 0.055;
                s.shakeIntensity = 0.34;
                s.ballVel.multiplyScalar(0.3);
                triggerGoalConfetti(-PITCH_HALF_X);
                audio.playGoalCheer();
                setGoalBanner({
                  team: 'away',
                  scorer: s.lastTouchTeam === 'away' ? s.lastTouchName : 'K. MBAPPO',
                  minute: Math.max(1, minuteNow),
                });
              } else if (hitPostZ || hitCrossbarY) {
                s.ballPos.x = -PITCH_HALF_X + 0.25;
                s.ballVel.x = Math.abs(s.ballVel.x) * 0.62;
                s.shakeIntensity = 0.22;
                audio.playPostClang();
              } else {
                s.ballPos.x = -PITCH_HALF_X + 0.35;
                s.ballVel.x = Math.max(4.5, Math.abs(s.ballVel.x) * 0.45);
              }
            }

            // Touchline soft boards keep play brisk like FC Mobile Rush/Blitz
            if (Math.abs(s.ballPos.z) > PITCH_HALF_Z) {
              s.ballPos.z = Math.sign(s.ballPos.z) * PITCH_HALF_Z;
              s.ballVel.z *= -0.68;
            }

            // Check any player collecting loose ball
            if (s.goalFreezeTimer <= 0 && s.ballPos.y < 1.35) {
              for (const p of players) {
                if (p.ignoreBallTimer > 0 || p.stunTimer > 0) continue;
                const collectR = p.role === 'GK' ? 1.15 : 0.85;
                const d = Math.hypot(p.pos.x - s.ballPos.x, p.pos.y - s.ballPos.z);
                if (d < collectR) {
                  s.ballCarrierIdx = p.id;
                  s.lastTouchTeam = p.team;
                  s.lastTouchName = p.name;
                  s.aiPassCooldown = p.role === 'GK' ? 0.45 : 0.3;
                  if (p.team === 'home') {
                    s.activeHomeIdx = p.id;
                    setActivePlayerName(p.name);
                  }
                  break;
                }
              }
            }
          }
        }

        // Update 3D Confetti Burst
        if (s.confettiActive) {
          s.confettiTimer -= dt;
          for (let i = 0; i < confettiCount; i++) {
            confettiVel[i].y -= 7.5 * dt;
            confettiPos[i].addScaledVector(confettiVel[i], dt);
            _dummyObj.position.copy(confettiPos[i]);
            _dummyObj.rotation.set(elapsed * 5 + i, elapsed * 4 + i, 0);
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

      // Sync Player Rigs & Procedural Running / Kicking / Tackling Animation
      for (const p of players) {
        p.rig.root.position.set(p.pos.x, 0, p.pos.y);
        p.rig.root.rotation.y = p.facing;
        p.rig.selectionRing.visible =
          s.phase === 'playing' && p.id === s.activeHomeIdx;

        const spd = p.vel.length();
        if (p.tackleAnim > 0) {
          p.rig.bodyGroup.rotation.x = -0.78;
          p.rig.bodyGroup.position.y = -0.25;
          p.rig.rightLegPivot.rotation.x = -0.95;
          p.rig.leftLegPivot.rotation.x = 0.55;
        } else {
          p.rig.bodyGroup.rotation.x = THREE.MathUtils.clamp(spd * 0.032, 0, 0.24);
          p.rig.bodyGroup.position.y = spd > 0.4 ? Math.abs(Math.sin(p.stridePhase * 2)) * 0.06 : 0;

          if (spd > 0.35) {
            p.stridePhase += dt * (4.2 + spd * 1.15);
            const swing = Math.sin(p.stridePhase) * THREE.MathUtils.clamp(spd * 0.11, 0.2, 0.92);
            p.rig.leftLegPivot.rotation.x = swing;
            p.rig.rightLegPivot.rotation.x = -swing;
            p.rig.leftArmPivot.rotation.x = -swing * 0.75;
            p.rig.rightArmPivot.rotation.x = swing * 0.75;
          } else {
            p.rig.leftLegPivot.rotation.x = THREE.MathUtils.damp(p.rig.leftLegPivot.rotation.x, 0, 10, dt);
            p.rig.rightLegPivot.rotation.x = THREE.MathUtils.damp(p.rig.rightLegPivot.rotation.x, 0, 10, dt);
            p.rig.leftArmPivot.rotation.x = THREE.MathUtils.damp(p.rig.leftArmPivot.rotation.x, 0, 10, dt);
            p.rig.rightArmPivot.rotation.x = THREE.MathUtils.damp(p.rig.rightArmPivot.rotation.x, 0, 10, dt);
          }

          if (p.kickAnim > 0) {
            p.rig.rightLegPivot.rotation.x = -1.15 * Math.sin((p.kickAnim / 0.28) * Math.PI);
          }
        }
      }

      // Sync Match Ball & Shadow
      ballMesh.position.copy(s.ballPos);
      ballMesh.rotation.x += s.ballSpin.x * dt;
      ballMesh.rotation.z += s.ballSpin.z * dt;
      ballShadow.position.set(s.ballPos.x, 0.025, s.ballPos.z);
      const hRatio = THREE.MathUtils.clamp(1 - (s.ballPos.y - BALL_RADIUS) / 4.5, 0.25, 1);
      ballShadow.scale.setScalar(0.85 + (1 - hRatio) * 0.85);
      bShadowMat.opacity = 0.52 * hRatio;

      // Update Mini Radar Dots ~12Hz to avoid React churn
      if (s.phase === 'playing') {
        s.radarAccumulator += dt;
        if (s.radarAccumulator >= 0.08) {
          s.radarAccumulator = 0;
          setRadarDots({
            players: players.map((pl) => ({
              x: ((pl.pos.x + PITCH_HALF_X) / (PITCH_HALF_X * 2)) * 100,
              z: ((pl.pos.y + PITCH_HALF_Z) / (PITCH_HALF_Z * 2)) * 100,
              team: pl.team,
              active: pl.id === s.activeHomeIdx,
            })),
            ball: {
              x: ((s.ballPos.x + PITCH_HALF_X) / (PITCH_HALF_X * 2)) * 100,
              z: ((s.ballPos.z + PITCH_HALF_Z) / (PITCH_HALF_Z * 2)) * 100,
            },
          });
        }
      }

      // Camera Choreography (Live stadium flyover on Title, FC Mobile Tele Broadcast during Match)
      if (s.phase === 'title') {
        _camGoal.set(
          Math.sin(elapsed * 0.22) * 16,
          14.5 + Math.cos(elapsed * 0.18) * 2.5,
          26.5 + Math.sin(elapsed * 0.16) * 4
        );
        _camLookTarget.set(Math.sin(elapsed * 0.14) * 5, 0.8, 0);
      } else {
        const focusX = THREE.MathUtils.clamp(s.ballPos.x * 0.72, -16.5, 16.5);
        const focusZ = THREE.MathUtils.clamp(s.ballPos.z * 0.35, -5.5, 5.5);
        _camGoal.set(focusX, 17.8, 28.2 + focusZ * 0.4);
        _camLookTarget.set(focusX, 0.5, focusZ * 0.65);
      }

      camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoal.x, 4.8, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoal.y, 4.8, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoal.z, 4.8, dt);

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
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      audio.dispose();
      envTarget.dispose();
      assets.disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [syncPhase]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#090f1c] select-none touch-none">
      {/* Isolated WebGL Mount */}
      <div ref={canvasMountRef} className="absolute inset-0 h-full w-full" />

      {/* TOP BROADCAST SCOREBUG HUD (pointer-events: none, no backdrop-filter, tabular-nums) */}
      {phase !== 'title' && (
        <div className="pointer-events-none absolute top-3 left-4 right-4 z-20 flex items-start justify-between">
          {/* Active Player Stamina Indicator */}
          <div className="hidden sm:flex items-center gap-3 rounded-xl border border-[#28344d] bg-[rgba(10,14,23,0.9)] px-3.5 py-2 text-white">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                Active Player
              </div>
              <div className="text-xs font-black tracking-wide text-[#00ff88] whitespace-nowrap">
                {activePlayerName}
              </div>
            </div>
            <div className="w-20">
              <div className="flex justify-between text-[10px] font-semibold text-[#94a3b8] mb-1">
                <span>Pace</span>
                <span className="tabular-nums">{staminaPct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded bg-[#1a2234]">
                <div
                  className={`h-full ${staminaPct > 28 ? 'bg-[#00ff88]' : 'bg-[#ff3355]'}`}
                  style={{ width: `${staminaPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* FC Broadcast Match Scorebug */}
          <div className="mx-auto sm:mx-0 flex items-center gap-3 rounded-xl border border-[#28344d] bg-[rgba(10,14,23,0.92)] px-4 py-2 text-white">
            <div className="flex items-center gap-2">
              <span className="h-3 w-1.5 rounded-sm bg-[#00ff88]" />
              <span className="text-xs font-black tracking-wider">FOOTY FC</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-[#141c2e] px-3 py-1 text-lg font-black tabular-nums">
              <span className="text-[#00ff88]">{homeScore}</span>
              <span className="text-xs text-[#64748b]">-</span>
              <span className="text-[#ff3355]">{awayScore}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider">APEX XI</span>
              <span className="h-3 w-1.5 rounded-sm bg-[#ff3355]" />
            </div>
            <div className="h-5 w-px bg-[#253047]" />
            <div className="text-sm font-black text-[#38bdf8] tabular-nums w-8 text-center">
              {matchMinute}&apos;
            </div>
          </div>

          {/* Audio & Pause Buttons */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#28344d] bg-[rgba(10,14,23,0.9)] text-[#cbd5e1] hover:border-[#00ff88] hover:text-white transition-colors"
              title={muted ? 'Unmute Audio' : 'Mute Audio'}
              aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {muted ? (
                <VolumeX className="h-4 w-4 text-[#ff3355]" />
              ) : (
                <Volume2 className="h-4 w-4 text-[#00ff88]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => syncPhase('paused')}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-[#28344d] bg-[rgba(10,14,23,0.9)] px-3.5 text-xs font-bold text-[#cbd5e1] hover:border-[#00ff88] hover:text-white transition-colors whitespace-nowrap"
            >
              <Pause className="h-4 w-4" />
              <span className="hidden sm:inline">Pause</span>
            </button>
          </div>
        </div>
      )}

      {/* GOAL CELEBRATION BANNER */}
      {phase === 'playing' && goalBanner && (
        <div className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
          <div
            className={`rounded-2xl border bg-[rgba(8,12,20,0.94)] px-8 py-4 text-center ${
              goalBanner.team === 'home'
                ? 'border-[#00ff88]'
                : 'border-[#ff3355]'
            }`}
          >
            <div
              className={`text-xs font-black tracking-[0.25em] uppercase ${
                goalBanner.team === 'home' ? 'text-[#00ff88]' : 'text-[#ff3355]'
              }`}
            >
              {goalBanner.team === 'home' ? 'FOOTY FC SCORES!' : 'APEX XI SCORES!'}
            </div>
            <div className="mt-1 text-3xl sm:text-4xl font-black tracking-tight text-white">
              GOAL!
            </div>
            <div className="mt-1 text-xs font-bold text-[#cbd5e1] tabular-nums">
              {goalBanner.scorer} · {goalBanner.minute}&apos;
            </div>
          </div>
        </div>
      )}

      {/* FC MOBILE VIRTUAL CONTROLS & MINI PITCH RADAR (Playing) */}
      {phase === 'playing' && (
        <>
          {/* Left Virtual Analog Stick */}
          <div className="pointer-events-auto fixed bottom-5 left-5 z-30 flex flex-col items-center gap-1.5">
            <div
              ref={joystickPadRef}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                joystickPointerIdRef.current = e.pointerId;
                updateStickFromClient(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (joystickPointerIdRef.current === e.pointerId) {
                  updateStickFromClient(e.clientX, e.clientY);
                }
              }}
              onPointerUp={(e) => {
                if (joystickPointerIdRef.current === e.pointerId) {
                  resetStick();
                }
              }}
              onPointerCancel={resetStick}
              className="relative flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center rounded-full border-2 border-white/20 bg-[rgba(10,14,23,0.72)] cursor-grab active:cursor-grabbing"
              aria-label="Virtual movement stick"
            >
              <div className="h-14 w-14 rounded-full border border-white/10" />
              <div
                className="absolute h-11 w-11 rounded-full border-2 border-[#00ff88] bg-[#162135] shadow-lg"
                style={{
                  transform: `translate(${stickUi.x * 36}px, ${stickUi.y * 36}px)`,
                }}
              />
            </div>
            <span className="text-[10px] font-bold tracking-wider text-[#94a3b8] uppercase">
              Move · WASD
            </span>
          </div>

          {/* Bottom-Center Mini Pitch Radar */}
          <div className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 z-20 hidden sm:flex flex-col items-center gap-1">
            <div className="relative h-20 w-36 rounded-lg border border-[#2c3852] bg-[rgba(12,48,25,0.88)] overflow-hidden">
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
              <div className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
              <div className="absolute left-0 top-1/2 h-9 w-3.5 -translate-y-1/2 border border-l-0 border-white/25" />
              <div className="absolute right-0 top-1/2 h-9 w-3.5 -translate-y-1/2 border border-r-0 border-white/25" />

              {radarDots.players.map((dot, idx) => (
                <div
                  key={idx}
                  className={`absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                    dot.team === 'home'
                      ? dot.active
                        ? 'bg-[#00ff88] ring-2 ring-white'
                        : 'bg-[#10b981]'
                      : 'bg-[#ff3355]'
                  }`}
                  style={{ left: `${dot.x}%`, top: `${dot.z}%` }}
                />
              ))}
              <div
                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-1 ring-black"
                style={{
                  left: `${radarDots.ball.x}%`,
                  top: `${radarDots.ball.z}%`,
                }}
              />
            </div>
          </div>

          {/* Right FC Mobile Context Action Diamond (Attack vs Defense) */}
          <div className="pointer-events-auto fixed bottom-5 right-5 z-30 flex flex-col items-end gap-2">
            {shotPowerPct > 0 && (
              <div className="w-40 rounded-lg border border-[#2a364f] bg-[rgba(10,14,23,0.92)] px-2.5 py-1.5">
                <div className="flex justify-between text-[10px] font-bold text-[#cbd5e1] mb-1">
                  <span>SHOT POWER</span>
                  <span className="tabular-nums text-[#00ff88]">{shotPowerPct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded bg-[#1a2234]">
                  <div
                    className="h-full bg-[#00ff88]"
                    style={{ width: `${shotPowerPct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="relative h-40 w-44 sm:h-44 sm:w-48">
              {/* Top Button: SPRINT / SKILL (Shift / L) */}
              <button
                type="button"
                onPointerDown={() => triggerSprintOrSkill(true)}
                onPointerUp={() => triggerSprintOrSkill(false)}
                onPointerCancel={() => triggerSprintOrSkill(false)}
                onPointerLeave={() => triggerSprintOrSkill(false)}
                className="absolute top-0 right-4 flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 border-[#38bdf8]/75 bg-[rgba(15,23,42,0.9)] text-white active:scale-95 transition-transform"
                title="Sprint & Skill Burst (Shift)"
              >
                <Zap className="h-4 w-4 text-[#38bdf8]" />
                <span className="text-[9px] font-black tracking-tight uppercase">
                  {isAttacking ? 'Sprint' : 'Sprint'}
                </span>
                <span className="text-[8px] text-[#94a3b8]">Shift</span>
              </button>

              {/* Top-Left Arc Button: THROUGH / 2ND DEF (I) */}
              <button
                type="button"
                onPointerDown={() => triggerThroughOrPress(true)}
                onPointerUp={() => triggerThroughOrPress(false)}
                onPointerCancel={() => triggerThroughOrPress(false)}
                className={`absolute top-6 left-1 flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 active:scale-95 transition-transform ${
                  !isAttacking && secondDefActive
                    ? 'border-[#ff3355] bg-[#ff3355] text-white'
                    : 'border-amber-400/75 bg-[rgba(15,23,42,0.9)] text-white'
                }`}
                title={isAttacking ? 'Through Ball (I)' : '2nd Defender Press (I)'}
              >
                <span className="text-[9px] font-black tracking-tight uppercase">
                  {isAttacking ? 'Through' : '2nd Def'}
                </span>
                <span className="text-[8px] text-[#94a3b8]">I</span>
              </button>

              {/* Bottom-Left Arc Button: PASS / SWITCH (K) */}
              <button
                type="button"
                onClick={triggerPassOrSwitch}
                className="absolute bottom-2 left-0 flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 border-[#00ff88]/80 bg-[rgba(15,23,42,0.92)] text-white active:scale-95 transition-transform"
                title={isAttacking ? 'Pass (K)' : 'Switch Player (K / Q)'}
              >
                <span className="text-[10px] font-black tracking-wider uppercase text-[#00ff88]">
                  {isAttacking ? 'Pass' : 'Switch'}
                </span>
                <span className="text-[8px] text-[#94a3b8]">
                  {isAttacking ? 'K' : 'K / Q'}
                </span>
              </button>

              {/* Primary Bottom-Right Button: SHOOT / TACKLE (Space / J) */}
              <button
                type="button"
                onPointerDown={startShootOrTackle}
                onPointerUp={releaseShoot}
                onPointerCancel={releaseShoot}
                className={`absolute bottom-0 right-1 flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 font-black active:scale-95 transition-transform ${
                  isAttacking
                    ? 'border-[#ff3355] bg-[#e11d48] text-white shadow-lg'
                    : 'border-[#38bdf8] bg-[#0284c7] text-white shadow-lg'
                }`}
                title={isAttacking ? 'Hold & Release to Shoot (Space)' : 'Tackle (Space)'}
              >
                <span className="text-xs font-black tracking-wider uppercase">
                  {isAttacking ? 'Shoot' : 'Tackle'}
                </span>
                <span className="text-[9px] text-white/80">Space</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* TITLE SCREEN OVERLAY */}
      {phase === 'title' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-between px-6 py-8 sm:py-10 bg-[rgba(7,11,20,0.48)]">
          <div className="w-full max-w-4xl flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-xl border border-[#2c3852] bg-[rgba(10,14,23,0.92)] px-4 py-2 text-xs font-bold text-[#cbd5e1] hover:border-[#00ff88] hover:text-[#00ff88] transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to FOOTYLive</span>
            </Link>

            <button
              type="button"
              onClick={toggleMute}
              className="flex items-center gap-2 rounded-xl border border-[#2c3852] bg-[rgba(10,14,23,0.92)] px-4 py-2 text-xs font-bold text-[#cbd5e1] hover:text-white whitespace-nowrap"
            >
              {muted ? (
                <VolumeX className="h-4 w-4 text-[#ff3355]" />
              ) : (
                <Volume2 className="h-4 w-4 text-[#00ff88]" />
              )}
              <span>{muted ? 'Sound Off' : 'Sound On'}</span>
            </button>
          </div>

          {/* Center Title Lockup & Match Config */}
          <div className="flex flex-col items-center text-center max-w-2xl">
            <svg
              viewBox="0 0 640 132"
              className="w-full max-w-lg mb-3"
              aria-label="FC Matchday 3D"
            >
              <rect
                x="145"
                y="6"
                width="350"
                height="26"
                rx="6"
                fill="rgba(0, 255, 136, 0.14)"
                stroke="#00ff88"
                strokeWidth="1.5"
              />
              <text
                x="320"
                y="24"
                textAnchor="middle"
                fill="#00ff88"
                fontSize="12"
                fontWeight="800"
                letterSpacing="4"
              >
                6V6 TELE BROADCAST EDITION
              </text>
              <text
                x="320"
                y="84"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="50"
                fontWeight="900"
                letterSpacing="2"
              >
                FC <tspan fill="#00ff88">MATCHDAY</tspan>
              </text>
              <line
                x1="120"
                y1="104"
                x2="520"
                y2="104"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
              />
              <text
                x="320"
                y="126"
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="13"
                fontWeight="600"
                letterSpacing="2.5"
              >
                FOOTY FC (EMERALD) VS APEX XI (CRIMSON)
              </text>
            </svg>

            {/* Quick Match Settings */}
            <div className="mb-5 flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center gap-1 rounded-xl border border-[#28344d] bg-[rgba(10,14,23,0.9)] p-1">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.seconds}
                    type="button"
                    onClick={() => setDurationSec(opt.seconds)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
                      durationSec === opt.seconds
                        ? 'bg-[#00ff88] text-black'
                        : 'text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 rounded-xl border border-[#28344d] bg-[rgba(10,14,23,0.9)] p-1">
                {(
                  [
                    { id: 'rookie', label: 'Rookie' },
                    { id: 'pro', label: 'Pro' },
                    { id: 'worldclass', label: 'World Class' },
                  ] as const
                ).map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setDifficulty(lvl.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
                      difficulty === lvl.id
                        ? 'bg-[#ff3355] text-white'
                        : 'text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={startNewMatch}
              className="flex items-center gap-2.5 rounded-2xl bg-[#00ff88] px-8 py-4 text-base font-black uppercase tracking-wider text-black hover:bg-[#22ff99] transition-transform hover:scale-105 active:scale-95 whitespace-nowrap"
            >
              <Play className="h-5 w-5 fill-current" />
              <span>Kick Off Match</span>
            </button>
          </div>

          {/* Single Flat Control-Hint Line */}
          <div className="rounded-xl border border-[#28344d] bg-[rgba(10,14,23,0.92)] px-5 py-2.5 text-xs font-medium text-[#cbd5e1] text-center">
            Move: Left Stick or WASD · Pass/Switch: K · Through/2nd Def: I · Shoot/Tackle: Space or J · Sprint/Skill: Shift · Esc: Pause
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {phase === 'paused' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(6,9,16,0.78)] px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#2c3852] bg-[#101522] p-6 text-center space-y-5">
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider text-white">
                Match Paused
              </h2>
              <p className="mt-1 text-xs font-semibold text-[#94a3b8] tabular-nums">
                FOOTY FC {homeScore} - {awayScore} APEX XI · {matchMinute}&apos;
              </p>
            </div>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => syncPhase('playing')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00ff88] py-3 text-sm font-black text-black hover:bg-[#22ff99]"
              >
                <Play className="h-4 w-4 fill-current" />
                Resume Match
              </button>
              <button
                type="button"
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

      {/* FULL TIME / RESULT MODAL */}
      {phase === 'gameover' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(6,9,16,0.82)] px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#2c3852] bg-[#101522] p-7 text-center space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00ff88]/15 border border-[#00ff88]/40 text-[#00ff88]">
              <Trophy className="h-7 w-7" />
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-[#00ff88]">
                Full Time · 90&apos;
              </div>
              <h2 className="mt-1 text-2xl font-black text-white">
                {homeScore > awayScore
                  ? 'Matchday Victory!'
                  : homeScore === awayScore
                  ? 'Hard-Fought Draw'
                  : 'Apex XI Take the Win'}
              </h2>
            </div>

            <div className="grid grid-cols-3 items-center rounded-xl border border-[#232d45] bg-[#141a2b] p-4">
              <div>
                <div className="text-[11px] font-bold text-[#00ff88]">FOOTY FC</div>
                <div className="text-3xl font-black text-white tabular-nums">
                  {homeScore}
                </div>
                <div className="text-[10px] text-[#94a3b8] tabular-nums">
                  {shotsHome} shots
                </div>
              </div>
              <div className="text-xs font-black tracking-widest text-[#64748b] uppercase">
                FT
              </div>
              <div>
                <div className="text-[11px] font-bold text-[#ff3355]">APEX XI</div>
                <div className="text-3xl font-black text-white tabular-nums">
                  {awayScore}
                </div>
                <div className="text-[10px] text-[#94a3b8] tabular-nums">
                  {shotsAway} shots
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={startNewMatch}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00ff88] py-3 text-sm font-black text-black hover:bg-[#22ff99]"
              >
                <RotateCcw className="h-4 w-4" />
                Rematch
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
