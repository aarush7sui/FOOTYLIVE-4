import * as THREE from 'three';

export interface MatchAssets {
  pitchTexture: THREE.CanvasTexture;
  ballTexture: THREE.CanvasTexture;
  netTexture: THREE.CanvasTexture;
  adBoardTexture: THREE.CanvasTexture;
  contactShadowTexture: THREE.CanvasTexture;
  disposables: Array<{ dispose: () => void }>;
}

export interface ArticulatedPlayerRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  torsoMesh: THREE.Mesh;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  headGroup: THREE.Group;
  shadowMesh: THREE.Mesh;
  selectionRing: THREE.Mesh;
}

export class MatchAudioSynth {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playWhistle(long = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = long ? 0.55 : 0.28;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2820, now);
    osc.frequency.exponentialRampToValueAtTime(2960, now + dur * 0.4);

    lfo.frequency.setValueAtTime(36, now);
    lfoGain.gain.setValueAtTime(95, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + dur + 0.02);
    lfo.stop(now + dur + 0.02);
  }

  public playKick(powerRatio: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    const startFreq = 125 + powerRatio * 75;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.13);

    gain.gain.setValueAtTime(0.22 * (0.55 + powerRatio * 0.45), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playTackle() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.11);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playPostClang() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [430, 680, 1020].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.12 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    });
  }

  public playGoalCheer() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 1.15);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.72;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(620, now);
    filter.frequency.linearRampToValueAtTime(1180, now + 0.4);
    filter.Q.setValueAtTime(0.85, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 1.15);
  }

  public dispose() {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export function createMatchAssets(maxAnisotropy: number): MatchAssets {
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. Full Horizontal Pitch Texture (2048x1280 -> X: length, Z: width)
  const pitchCanvas = document.createElement('canvas');
  pitchCanvas.width = 2048;
  pitchCanvas.height = 1280;
  const ctx = pitchCanvas.getContext('2d')!;

  const stripeCount = 18;
  const stripeW = pitchCanvas.width / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#165a2a' : '#1b6a33';
    ctx.fillRect(i * stripeW, 0, stripeW, pitchCanvas.height);
  }

  // Subtle turf blades grain
  for (let i = 0; i < 9000; i++) {
    const gx = Math.random() * pitchCanvas.width;
    const gy = Math.random() * pitchCanvas.height;
    ctx.fillStyle =
      Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(gx, gy, 3, 2);
  }

  const mX = 76;
  const mY = 64;
  const fW = pitchCanvas.width - mX * 2;
  const fH = pitchCanvas.height - mY * 2;
  const midX = pitchCanvas.width / 2;
  const midY = pitchCanvas.height / 2;

  ctx.strokeStyle = 'rgba(246, 252, 249, 0.94)';
  ctx.lineWidth = 7;

  // Touchlines & goal lines
  ctx.strokeRect(mX, mY, fW, fH);

  // Halfway line & center circle
  ctx.beginPath();
  ctx.moveTo(midX, mY);
  ctx.lineTo(midX, mY + fH);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(midX, midY, 150, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(midX, midY, 10, 0, Math.PI * 2);
  ctx.fill();

  // Left Penalty Box & 6-yard Box
  const penW = 300;
  const penH = 620;
  const sixW = 105;
  const sixH = 290;
  ctx.strokeRect(mX, midY - penH / 2, penW, penH);
  ctx.strokeRect(mX, midY - sixH / 2, sixW, sixH);
  ctx.beginPath();
  ctx.arc(mX + 205, midY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(mX + 205, midY, 130, -0.34 * Math.PI, 0.34 * Math.PI);
  ctx.stroke();

  // Right Penalty Box & 6-yard Box
  ctx.strokeRect(mX + fW - penW, midY - penH / 2, penW, penH);
  ctx.strokeRect(mX + fW - sixW, midY - sixH / 2, sixW, sixH);
  ctx.beginPath();
  ctx.arc(mX + fW - 205, midY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(mX + fW - 205, midY, 130, 0.66 * Math.PI, 1.34 * Math.PI);
  ctx.stroke();

  // Corner arcs
  const cR = 26;
  ctx.beginPath();
  ctx.arc(mX, mY, cR, 0, Math.PI * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mX + fW, mY, cR, Math.PI * 0.5, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mX + fW, mY + fH, cR, Math.PI, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mX, mY + fH, cR, Math.PI * 1.5, Math.PI * 2);
  ctx.stroke();

  const pitchTexture = new THREE.CanvasTexture(pitchCanvas);
  pitchTexture.colorSpace = THREE.SRGBColorSpace;
  pitchTexture.anisotropy = maxAnisotropy;
  disposables.push(pitchTexture);

  // 2. Match Football Texture
  const ballCanvas = document.createElement('canvas');
  ballCanvas.width = 512;
  ballCanvas.height = 256;
  const bCtx = ballCanvas.getContext('2d')!;
  bCtx.fillStyle = '#f8fafc';
  bCtx.fillRect(0, 0, 512, 256);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 8; c++) {
      const cx = (c + 0.5) * 64;
      const cy = (r + 0.5) * 64;
      bCtx.fillStyle = (r + c) % 2 === 0 ? '#0f172a' : '#00ff88';
      bCtx.beginPath();
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2 - Math.PI / 2;
        const rad = (r + c) % 2 === 0 ? 20 : 10;
        const px = cx + Math.cos(ang) * rad;
        const py = cy + Math.sin(ang) * rad;
        if (k === 0) bCtx.moveTo(px, py);
        else bCtx.lineTo(px, py);
      }
      bCtx.closePath();
      bCtx.fill();
    }
  }
  const ballTexture = new THREE.CanvasTexture(ballCanvas);
  ballTexture.colorSpace = THREE.SRGBColorSpace;
  ballTexture.anisotropy = maxAnisotropy;
  disposables.push(ballTexture);

  // 3. Goal Net Alpha Mesh Texture
  const netCanvas = document.createElement('canvas');
  netCanvas.width = 128;
  netCanvas.height = 128;
  const nCtx = netCanvas.getContext('2d')!;
  nCtx.clearRect(0, 0, 128, 128);
  nCtx.strokeStyle = 'rgba(241, 245, 249, 0.72)';
  nCtx.lineWidth = 2;
  for (let x = 0; x <= 128; x += 16) {
    nCtx.beginPath();
    nCtx.moveTo(x, 0);
    nCtx.lineTo(x, 128);
    nCtx.stroke();
  }
  for (let y = 0; y <= 128; y += 16) {
    nCtx.beginPath();
    nCtx.moveTo(0, y);
    nCtx.lineTo(128, y);
    nCtx.stroke();
  }
  const netTexture = new THREE.CanvasTexture(netCanvas);
  netTexture.wrapS = THREE.RepeatWrapping;
  netTexture.wrapT = THREE.RepeatWrapping;
  netTexture.repeat.set(6, 3);
  netTexture.colorSpace = THREE.SRGBColorSpace;
  disposables.push(netTexture);

  // 4. Perimeter LED Ad Board Texture (FOOTYLive branded)
  const adCanvas = document.createElement('canvas');
  adCanvas.width = 1024;
  adCanvas.height = 128;
  const aCtx = adCanvas.getContext('2d')!;
  aCtx.fillStyle = '#090d16';
  aCtx.fillRect(0, 0, 1024, 128);
  aCtx.fillStyle = '#00ff88';
  aCtx.fillRect(0, 0, 1024, 8);
  aCtx.fillRect(0, 120, 1024, 8);
  aCtx.font = '900 40px sans-serif';
  aCtx.textAlign = 'center';
  aCtx.textBaseline = 'middle';
  aCtx.fillStyle = '#ffffff';
  aCtx.fillText('FOOTYLIVE', 200, 64);
  aCtx.fillStyle = '#ff3355';
  aCtx.fillText('MATCHDAY', 520, 64);
  aCtx.fillStyle = '#00ff88';
  aCtx.fillText('WORLD TOUR', 840, 64);

  const adBoardTexture = new THREE.CanvasTexture(adCanvas);
  adBoardTexture.wrapS = THREE.RepeatWrapping;
  adBoardTexture.colorSpace = THREE.SRGBColorSpace;
  adBoardTexture.anisotropy = maxAnisotropy;
  disposables.push(adBoardTexture);

  // 5. Contact Shadow Radial Gradient Texture
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.24)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadowTexture = new THREE.CanvasTexture(shadowCanvas);
  disposables.push(contactShadowTexture);

  return {
    pitchTexture,
    ballTexture,
    netTexture,
    adBoardTexture,
    contactShadowTexture,
    disposables,
  };
}

export function buildPitchGoalAssembly(
  netTexture: THREE.CanvasTexture,
  disposables: Array<{ dispose: () => void }>,
  facingDir: 1 | -1,
  halfWidth = 3.2,
  height = 2.3,
  depth = 1.6
): THREE.Group {
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.25,
    metalness: 0.72,
  });
  const netMat = new THREE.MeshStandardMaterial({
    map: netTexture,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
    roughness: 0.9,
  });
  disposables.push(postMat, netMat);

  // Goal sits along X = 0 local, extending back into -facingDir * depth, posts along Z = +-halfWidth
  const postGeo = new THREE.CylinderGeometry(0.065, 0.065, height, 14);
  const leftPost = new THREE.Mesh(postGeo, postMat);
  leftPost.position.set(0, height / 2, -halfWidth);
  leftPost.castShadow = true;

  const rightPost = new THREE.Mesh(postGeo, postMat);
  rightPost.position.set(0, height / 2, halfWidth);
  rightPost.castShadow = true;

  const barGeo = new THREE.CylinderGeometry(0.065, 0.065, halfWidth * 2 + 0.13, 14);
  barGeo.rotateX(Math.PI / 2);
  const crossbar = new THREE.Mesh(barGeo, postMat);
  crossbar.position.set(0, height, 0);
  crossbar.castShadow = true;

  const backX = -facingDir * depth;
  const stanchionGeo = new THREE.CylinderGeometry(0.035, 0.035, depth, 10);
  stanchionGeo.rotateZ(Math.PI / 2);
  const topLeftBar = new THREE.Mesh(stanchionGeo, postMat);
  topLeftBar.position.set(backX / 2, height, -halfWidth);
  const topRightBar = new THREE.Mesh(stanchionGeo, postMat);
  topRightBar.position.set(backX / 2, height, halfWidth);

  const backPostGeo = new THREE.CylinderGeometry(0.035, 0.035, height, 10);
  const backLeftPost = new THREE.Mesh(backPostGeo, postMat);
  backLeftPost.position.set(backX, height / 2, -halfWidth);
  const backRightPost = new THREE.Mesh(backPostGeo, postMat);
  backRightPost.position.set(backX, height / 2, halfWidth);

  const backNetGeo = new THREE.PlaneGeometry(halfWidth * 2, height);
  backNetGeo.rotateY(Math.PI / 2);
  const backNet = new THREE.Mesh(backNetGeo, netMat);
  backNet.position.set(backX, height / 2, 0);

  const topNetGeo = new THREE.PlaneGeometry(depth, halfWidth * 2);
  topNetGeo.rotateX(Math.PI / 2);
  const topNet = new THREE.Mesh(topNetGeo, netMat);
  topNet.position.set(backX / 2, height, 0);

  const sideNetGeo = new THREE.PlaneGeometry(depth, height);
  const leftSideNet = new THREE.Mesh(sideNetGeo, netMat);
  leftSideNet.position.set(backX / 2, height / 2, -halfWidth);
  const rightSideNet = new THREE.Mesh(sideNetGeo, netMat);
  rightSideNet.position.set(backX / 2, height / 2, halfWidth);

  group.add(
    leftPost,
    rightPost,
    crossbar,
    topLeftBar,
    topRightBar,
    backLeftPost,
    backRightPost,
    backNet,
    topNet,
    leftSideNet,
    rightSideNet
  );

  disposables.push(
    postGeo,
    barGeo,
    stanchionGeo,
    backPostGeo,
    backNetGeo,
    topNetGeo,
    sideNetGeo
  );

  return group;
}

export function buildMatchPlayerRig(
  disposables: Array<{ dispose: () => void }>,
  contactShadowTexture: THREE.CanvasTexture,
  jerseyHex: number,
  shortsHex: number,
  accentHex: number,
  skinHex: number,
  hairHex: number,
  ringHex: number
): ArticulatedPlayerRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const jerseyMat = new THREE.MeshStandardMaterial({
    color: jerseyHex,
    roughness: 0.72,
    metalness: 0.05,
  });
  const shortsMat = new THREE.MeshStandardMaterial({
    color: shortsHex,
    roughness: 0.76,
    metalness: 0.04,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    roughness: 0.45,
    metalness: 0.25,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinHex,
    roughness: 0.62,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: hairHex,
    roughness: 0.85,
    metalness: 0.05,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.3,
  });

  // Ground contact shadow
  const shadowGeo = new THREE.PlaneGeometry(1.1, 1.1);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.52,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.025;
  root.add(shadowMesh);

  // Active player selection ring on pitch
  const ringGeo = new THREE.RingGeometry(0.55, 0.74, 28);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: ringHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const selectionRing = new THREE.Mesh(ringGeo, ringMat);
  selectionRing.position.y = 0.032;
  selectionRing.visible = false;
  root.add(selectionRing);

  // Torso + collar accent + shorts (facing +Z in local rig)
  const torsoGeo = new THREE.BoxGeometry(0.52, 0.64, 0.3);
  const torsoMesh = new THREE.Mesh(torsoGeo, jerseyMat);
  torsoMesh.position.y = 1.18;
  torsoMesh.castShadow = true;

  const stripeGeo = new THREE.BoxGeometry(0.54, 0.11, 0.31);
  const chestStripe = new THREE.Mesh(stripeGeo, trimMat);
  chestStripe.position.y = 1.28;

  const shortsGeo = new THREE.BoxGeometry(0.48, 0.26, 0.28);
  const shortsMesh = new THREE.Mesh(shortsGeo, shortsMat);
  shortsMesh.position.y = 0.76;
  shortsMesh.castShadow = true;

  bodyGroup.add(torsoMesh, chestStripe, shortsMesh);

  // Head + hair cap
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.66, 0);
  const headGeo = new THREE.SphereGeometry(0.175, 16, 16);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.castShadow = true;
  const hairGeo = new THREE.SphereGeometry(0.184, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const hairMesh = new THREE.Mesh(hairGeo, hairMat);
  hairMesh.position.y = 0.02;
  headGroup.add(headMesh, hairMesh);
  bodyGroup.add(headGroup);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.14, 0.52, 0.14);
  const handGeo = new THREE.SphereGeometry(0.08, 10, 10);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.34, 1.44, 0);
  const lArm = new THREE.Mesh(armGeo, jerseyMat);
  lArm.position.y = -0.24;
  lArm.castShadow = true;
  const lHand = new THREE.Mesh(handGeo, skinMat);
  lHand.position.y = -0.52;
  leftArmPivot.add(lArm, lHand);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.34, 1.44, 0);
  const rArm = new THREE.Mesh(armGeo, jerseyMat);
  rArm.position.y = -0.24;
  rArm.castShadow = true;
  const rHand = new THREE.Mesh(handGeo, skinMat);
  rHand.position.y = -0.52;
  rightArmPivot.add(rArm, rHand);
  bodyGroup.add(leftArmPivot, rightArmPivot);

  // Legs + socks + cleats
  const legGeo = new THREE.BoxGeometry(0.17, 0.58, 0.17);
  const bootGeo = new THREE.BoxGeometry(0.19, 0.11, 0.3);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.14, 0.68, 0);
  const lLeg = new THREE.Mesh(legGeo, skinMat);
  lLeg.position.y = -0.29;
  lLeg.castShadow = true;
  const lBoot = new THREE.Mesh(bootGeo, bootMat);
  lBoot.position.set(0, -0.62, 0.05);
  lBoot.castShadow = true;
  leftLegPivot.add(lLeg, lBoot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.14, 0.68, 0);
  const rLeg = new THREE.Mesh(legGeo, skinMat);
  rLeg.position.y = -0.29;
  rLeg.castShadow = true;
  const rBoot = new THREE.Mesh(bootGeo, bootMat);
  rBoot.position.set(0, -0.62, 0.05);
  rBoot.castShadow = true;
  rightLegPivot.add(rLeg, rBoot);

  bodyGroup.add(leftLegPivot, rightLegPivot);

  disposables.push(
    jerseyMat,
    shortsMat,
    trimMat,
    skinMat,
    hairMat,
    bootMat,
    shadowGeo,
    shadowMat,
    ringGeo,
    ringMat,
    torsoGeo,
    stripeGeo,
    shortsGeo,
    headGeo,
    hairGeo,
    armGeo,
    handGeo,
    legGeo,
    bootGeo
  );

  return {
    root,
    bodyGroup,
    torsoMesh,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    headGroup,
    shadowMesh,
    selectionRing,
  };
}
