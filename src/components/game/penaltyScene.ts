import * as THREE from 'three';

export interface ProceduralAssets {
  pitchTexture: THREE.CanvasTexture;
  ballTexture: THREE.CanvasTexture;
  netTexture: THREE.CanvasTexture;
  adBoardTexture: THREE.CanvasTexture;
  contactShadowTexture: THREE.CanvasTexture;
  disposables: Array<{ dispose: () => void }>;
}

export interface GoalkeeperRig {
  root: THREE.Group;
  torsoPivot: THREE.Group;
  torsoMesh: THREE.Mesh;
  leftArmPivot: THREE.Group;
  leftGlove: THREE.Mesh;
  rightArmPivot: THREE.Group;
  rightGlove: THREE.Mesh;
  leftLegPivot: THREE.Group;
  leftBoot: THREE.Mesh;
  rightLegPivot: THREE.Group;
  rightBoot: THREE.Mesh;
  headGroup: THREE.Group;
}

export class StadiumAudioSynth {
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

  public playWhistle() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2850, now);
    osc.frequency.exponentialRampToValueAtTime(2950, now + 0.12);

    lfo.frequency.setValueAtTime(38, now);
    lfoGain.gain.setValueAtTime(110, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.36);
    lfo.stop(now + 0.36);
  }

  public playKick(powerRatio: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    const startFreq = 140 + powerRatio * 65;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.14);

    gain.gain.setValueAtTime(0.28 * (0.6 + powerRatio * 0.4), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playPostClang() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [410, 625, 980].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.14 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.56);
    });
  }

  public playGoalCheer() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 1.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.7;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, now);
    filter.frequency.linearRampToValueAtTime(1100, now + 0.35);
    filter.Q.setValueAtTime(0.9, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 1.08);
  }

  public playSaveThud() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.18);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public dispose() {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export function createProceduralAssets(
  maxAnisotropy: number
): ProceduralAssets {
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. Pitch grass stripes + crisp white penalty box markings
  const pitchCanvas = document.createElement('canvas');
  pitchCanvas.width = 1024;
  pitchCanvas.height = 1024;
  const pCtx = pitchCanvas.getContext('2d')!;

  const stripeCount = 14;
  const stripeH = pitchCanvas.height / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    pCtx.fillStyle = i % 2 === 0 ? '#185c2b' : '#1e6c34';
    pCtx.fillRect(0, i * stripeH, pitchCanvas.width, stripeH);
  }

  // Subtle turf grain
  for (let i = 0; i < 6500; i++) {
    const gx = Math.random() * pitchCanvas.width;
    const gy = Math.random() * pitchCanvas.height;
    pCtx.fillStyle =
      Math.random() > 0.5
        ? 'rgba(255,255,255,0.035)'
        : 'rgba(0,0,0,0.045)';
    pCtx.fillRect(gx, gy, 2, 4);
  }

  // Crisp field lines (goal is near top of UV, penalty spot lower)
  pCtx.strokeStyle = 'rgba(245, 250, 248, 0.94)';
  pCtx.lineWidth = 6;
  // Goal line (top margin y=110)
  pCtx.beginPath();
  pCtx.moveTo(40, 110);
  pCtx.lineTo(984, 110);
  pCtx.stroke();
  // Penalty box (18-yard box)
  pCtx.strokeRect(180, 110, 664, 410);
  // 6-yard goal area
  pCtx.strokeRect(342, 110, 340, 150);
  // Penalty arc (D-arc)
  pCtx.beginPath();
  pCtx.arc(512, 390, 155, 0.22 * Math.PI, 0.78 * Math.PI);
  pCtx.stroke();
  // Penalty spot
  pCtx.fillStyle = '#ffffff';
  pCtx.beginPath();
  pCtx.arc(512, 390, 9, 0, Math.PI * 2);
  pCtx.fill();

  const pitchTexture = new THREE.CanvasTexture(pitchCanvas);
  pitchTexture.colorSpace = THREE.SRGBColorSpace;
  pitchTexture.anisotropy = maxAnisotropy;
  disposables.push(pitchTexture);

  // 2. Match Football Pentagon/Hexagon Texture
  const ballCanvas = document.createElement('canvas');
  ballCanvas.width = 512;
  ballCanvas.height = 256;
  const bCtx = ballCanvas.getContext('2d')!;
  bCtx.fillStyle = '#f5f7fa';
  bCtx.fillRect(0, 0, 512, 256);
  // Dynamic modern geometric match-ball panels
  const cols = 8;
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * (512 / cols);
      const cy = (r + 0.5) * (256 / rows);
      bCtx.fillStyle = (r + c) % 2 === 0 ? '#111622' : '#00ff88';
      bCtx.beginPath();
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2 - Math.PI / 2;
        const rad = (r + c) % 2 === 0 ? 22 : 12;
        const px = cx + Math.cos(ang) * rad;
        const py = cy + Math.sin(ang) * rad;
        if (k === 0) bCtx.moveTo(px, py);
        else bCtx.lineTo(px, py);
      }
      bCtx.closePath();
      bCtx.fill();

      bCtx.strokeStyle = '#9aa5b8';
      bCtx.lineWidth = 2;
      bCtx.stroke();
    }
  }
  const ballTexture = new THREE.CanvasTexture(ballCanvas);
  ballTexture.colorSpace = THREE.SRGBColorSpace;
  ballTexture.anisotropy = maxAnisotropy;
  disposables.push(ballTexture);

  // 3. Woven Goal Net Texture
  const netCanvas = document.createElement('canvas');
  netCanvas.width = 128;
  netCanvas.height = 128;
  const nCtx = netCanvas.getContext('2d')!;
  nCtx.clearRect(0, 0, 128, 128);
  nCtx.strokeStyle = 'rgba(235, 245, 255, 0.78)';
  nCtx.lineWidth = 3;
  for (let i = -128; i <= 256; i += 24) {
    nCtx.beginPath();
    nCtx.moveTo(i, 0);
    nCtx.lineTo(i + 128, 128);
    nCtx.stroke();
    nCtx.beginPath();
    nCtx.moveTo(i + 128, 0);
    nCtx.lineTo(i, 128);
    nCtx.stroke();
  }
  const netTexture = new THREE.CanvasTexture(netCanvas);
  netTexture.colorSpace = THREE.SRGBColorSpace;
  netTexture.wrapS = THREE.RepeatWrapping;
  netTexture.wrapT = THREE.RepeatWrapping;
  netTexture.repeat.set(14, 5);
  netTexture.anisotropy = maxAnisotropy;
  disposables.push(netTexture);

  // 4. Perimeter LED Ad Board Texture
  const adCanvas = document.createElement('canvas');
  adCanvas.width = 1024;
  adCanvas.height = 128;
  const aCtx = adCanvas.getContext('2d')!;
  aCtx.fillStyle = '#090d16';
  aCtx.fillRect(0, 0, 1024, 128);
  aCtx.fillStyle = '#00ff88';
  aCtx.fillRect(0, 0, 1024, 8);
  aCtx.fillRect(0, 120, 1024, 8);
  aCtx.font = 'bold 44px sans-serif';
  aCtx.textBaseline = 'middle';
  aCtx.fillStyle = '#ffffff';
  aCtx.fillText('FOOTYLIVE 4K HDR', 40, 66);
  aCtx.fillStyle = '#00ff88';
  aCtx.fillText('•  WORLD CUP 26  •', 470, 66);
  aCtx.fillStyle = '#38bdf8';
  aCtx.fillText('PENALTY ARENA', 840, 66);
  const adBoardTexture = new THREE.CanvasTexture(adCanvas);
  adBoardTexture.colorSpace = THREE.SRGBColorSpace;
  adBoardTexture.wrapS = THREE.RepeatWrapping;
  adBoardTexture.repeat.set(3, 1);
  adBoardTexture.anisotropy = maxAnisotropy;
  disposables.push(adBoardTexture);

  // 5. Soft Radial Contact Shadow Texture
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
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

export function buildGoalpostAssembly(
  netTexture: THREE.CanvasTexture,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  // Official scaled goal: 7.32m wide (x: -3.66..3.66), 2.44m tall (y: 0..2.44), depth 2.2m (z: -14..-16.2)
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({
    color: 0xf4f7fb,
    metalness: 0.55,
    roughness: 0.25,
  });
  const bracketMat = new THREE.MeshStandardMaterial({
    color: 0x1b2230,
    metalness: 0.8,
    roughness: 0.35,
  });
  const netMat = new THREE.MeshStandardMaterial({
    map: netTexture,
    transparent: true,
    alphaTest: 0.12,
    side: THREE.DoubleSide,
    roughness: 0.85,
    metalness: 0.05,
    depthWrite: false,
  });
  disposables.push(postMat, bracketMat, netMat);

  const halfW = 3.66;
  const height = 2.44;
  const depth = 2.2;
  const postR = 0.075;

  // Left & Right Upright Posts
  const uprightGeo = new THREE.CylinderGeometry(postR, postR, height, 18);
  const leftPost = new THREE.Mesh(uprightGeo, postMat);
  leftPost.position.set(-halfW, height / 2, 0);
  leftPost.castShadow = true;

  const rightPost = new THREE.Mesh(uprightGeo, postMat);
  rightPost.position.set(halfW, height / 2, 0);
  rightPost.castShadow = true;

  // Crossbar
  const crossbarGeo = new THREE.CylinderGeometry(
    postR,
    postR,
    halfW * 2 + postR * 2,
    18
  );
  crossbarGeo.rotateZ(Math.PI / 2);
  const crossbar = new THREE.Mesh(crossbarGeo, postMat);
  crossbar.position.set(0, height, 0);
  crossbar.castShadow = true;

  // Corner joint sleeves + base floor plates (accent detail)
  const jointGeo = new THREE.SphereGeometry(postR * 1.22, 14, 14);
  const leftJoint = new THREE.Mesh(jointGeo, bracketMat);
  leftJoint.position.set(-halfW, height, 0);
  const rightJoint = new THREE.Mesh(jointGeo, bracketMat);
  rightJoint.position.set(halfW, height, 0);

  const baseGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.06, 16);
  const leftBase = new THREE.Mesh(baseGeo, bracketMat);
  leftBase.position.set(-halfW, 0.03, 0);
  const rightBase = new THREE.Mesh(baseGeo, bracketMat);
  rightBase.position.set(halfW, 0.03, 0);

  // Back Stanchion Curved Tubes (TubeGeometry)
  const stanchionLeftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-halfW, height, 0),
    new THREE.Vector3(-halfW, height - 0.12, -depth * 0.65),
    new THREE.Vector3(-halfW, 0.04, -depth),
  ]);
  const stanchionRightCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(halfW, height, 0),
    new THREE.Vector3(halfW, height - 0.12, -depth * 0.65),
    new THREE.Vector3(halfW, 0.04, -depth),
  ]);
  const stanchionLeftGeo = new THREE.TubeGeometry(stanchionLeftCurve, 20, 0.04, 10, false);
  const stanchionRightGeo = new THREE.TubeGeometry(stanchionRightCurve, 20, 0.04, 10, false);
  const stanchionLeft = new THREE.Mesh(stanchionLeftGeo, bracketMat);
  const stanchionRight = new THREE.Mesh(stanchionRightGeo, bracketMat);

  // Rear ground bar
  const rearBarGeo = new THREE.CylinderGeometry(0.04, 0.04, halfW * 2, 12);
  rearBarGeo.rotateZ(Math.PI / 2);
  const rearBar = new THREE.Mesh(rearBarGeo, bracketMat);
  rearBar.position.set(0, 0.04, -depth);

  // Net planes (back, top, left, right)
  const backNetGeo = new THREE.PlaneGeometry(halfW * 2, height);
  const backNet = new THREE.Mesh(backNetGeo, netMat);
  backNet.position.set(0, height / 2, -depth);

  const topNetGeo = new THREE.PlaneGeometry(halfW * 2, depth);
  topNetGeo.rotateX(Math.PI / 2);
  const topNet = new THREE.Mesh(topNetGeo, netMat);
  topNet.position.set(0, height - 0.04, -depth / 2);

  const sideNetGeo = new THREE.PlaneGeometry(depth, height);
  sideNetGeo.rotateY(Math.PI / 2);
  const leftNet = new THREE.Mesh(sideNetGeo, netMat);
  leftNet.position.set(-halfW, height / 2, -depth / 2);
  const rightNet = new THREE.Mesh(sideNetGeo, netMat);
  rightNet.position.set(halfW, height / 2, -depth / 2);

  disposables.push(
    uprightGeo,
    crossbarGeo,
    jointGeo,
    baseGeo,
    stanchionLeftGeo,
    stanchionRightGeo,
    rearBarGeo,
    backNetGeo,
    topNetGeo,
    sideNetGeo
  );

  group.add(
    leftPost,
    rightPost,
    crossbar,
    leftJoint,
    rightJoint,
    leftBase,
    rightBase,
    stanchionLeft,
    stanchionRight,
    rearBar,
    backNet,
    topNet,
    leftNet,
    rightNet
  );

  return group;
}

export function buildGoalkeeperRig(
  disposables: Array<{ dispose: () => void }>
): GoalkeeperRig {
  // Composite 9-part articulated goalkeeper grounded at y = 0
  const root = new THREE.Group();

  const jerseyMat = new THREE.MeshStandardMaterial({
    color: 0xff3355,
    roughness: 0.78,
    metalness: 0.05,
  });
  const shortsMat = new THREE.MeshStandardMaterial({
    color: 0x161b26,
    roughness: 0.8,
    metalness: 0.05,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd99b72,
    roughness: 0.65,
    metalness: 0.02,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    roughness: 0.42,
    metalness: 0.15,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x0d1018,
    roughness: 0.35,
    metalness: 0.35,
  });
  disposables.push(jerseyMat, shortsMat, skinMat, gloveMat, bootMat);

  // Torso pivot (pelvis height ~0.92m)
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.92, 0);
  root.add(torsoPivot);

  // Torso chest + jersey stripe
  const torsoGeo = new THREE.CapsuleGeometry(0.24, 0.42, 6, 14);
  const torsoMesh = new THREE.Mesh(torsoGeo, jerseyMat);
  torsoMesh.position.set(0, 0.36, 0);
  torsoMesh.scale.set(1.15, 1, 0.75);
  torsoMesh.castShadow = true;
  torsoPivot.add(torsoMesh);

  const bibGeo = new THREE.BoxGeometry(0.38, 0.14, 0.38);
  const bibMesh = new THREE.Mesh(bibGeo, shortsMat);
  bibMesh.position.set(0, 0.05, 0);
  torsoPivot.add(bibMesh);

  // Head + visor/hair cap
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.78, 0);
  const headGeo = new THREE.SphereGeometry(0.145, 16, 16);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.castShadow = true;
  const capGeo = new THREE.SphereGeometry(0.152, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const capMesh = new THREE.Mesh(capGeo, bootMat);
  capMesh.rotation.x = -0.15;
  headGroup.add(headMesh, capMesh);
  torsoPivot.add(headGroup);

  // Arms + Neon Goalkeeper Gloves
  const armGeo = new THREE.CapsuleGeometry(0.068, 0.44, 5, 10);
  const gloveGeo = new THREE.BoxGeometry(0.13, 0.17, 0.08);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.34, 0.58, 0);
  const leftArm = new THREE.Mesh(armGeo, jerseyMat);
  leftArm.position.set(0, -0.24, 0);
  leftArm.castShadow = true;
  const leftGlove = new THREE.Mesh(gloveGeo, gloveMat);
  leftGlove.position.set(0, -0.54, 0.02);
  leftGlove.castShadow = true;
  leftArmPivot.add(leftArm, leftGlove);
  torsoPivot.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.34, 0.58, 0);
  const rightArm = new THREE.Mesh(armGeo, jerseyMat);
  rightArm.position.set(0, -0.24, 0);
  rightArm.castShadow = true;
  const rightGlove = new THREE.Mesh(gloveGeo, gloveMat);
  rightGlove.position.set(0, -0.54, 0.02);
  rightGlove.castShadow = true;
  rightArmPivot.add(rightArm, rightGlove);
  torsoPivot.add(rightArmPivot);

  // Legs + Cleats grounded at y = 0
  const legGeo = new THREE.CapsuleGeometry(0.085, 0.62, 5, 10);
  const bootGeo = new THREE.BoxGeometry(0.14, 0.1, 0.24);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.14, 0.92, 0);
  const leftLeg = new THREE.Mesh(legGeo, shortsMat);
  leftLeg.position.set(0, -0.44, 0);
  leftLeg.castShadow = true;
  const leftBoot = new THREE.Mesh(bootGeo, bootMat);
  leftBoot.position.set(0, -0.87, 0.05);
  leftBoot.castShadow = true;
  leftLegPivot.add(leftLeg, leftBoot);
  root.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.14, 0.92, 0);
  const rightLeg = new THREE.Mesh(legGeo, shortsMat);
  rightLeg.position.set(0, -0.44, 0);
  rightLeg.castShadow = true;
  const rightBoot = new THREE.Mesh(bootGeo, bootMat);
  rightBoot.position.set(0, -0.87, 0.05);
  rightBoot.castShadow = true;
  rightLegPivot.add(rightLeg, rightBoot);
  root.add(rightLegPivot);

  disposables.push(torsoGeo, bibGeo, headGeo, capGeo, armGeo, gloveGeo, legGeo, bootGeo);

  return {
    root,
    torsoPivot,
    torsoMesh,
    leftArmPivot,
    leftGlove,
    rightArmPivot,
    rightGlove,
    leftLegPivot,
    leftBoot,
    rightLegPivot,
    rightBoot,
    headGroup,
  };
}

export function buildFloodlightTower(
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const tower = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x3b4459,
    metalness: 0.78,
    roughness: 0.35,
  });
  const lampHousingMat = new THREE.MeshStandardMaterial({
    color: 0x161a24,
    metalness: 0.5,
    roughness: 0.5,
  });
  const emitterMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff5dc,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  disposables.push(steelMat, lampHousingMat, emitterMat);

  // Concrete base
  const baseGeo = new THREE.CylinderGeometry(0.9, 1.2, 1.4, 8);
  const base = new THREE.Mesh(baseGeo, lampHousingMat);
  base.position.y = 0.7;

  // Tapered mast
  const mastGeo = new THREE.CylinderGeometry(0.32, 0.65, 22, 10);
  const mast = new THREE.Mesh(mastGeo, steelMat);
  mast.position.y = 11.7;

  // Lamp array frame + emissive LED face
  const frameGeo = new THREE.BoxGeometry(5.6, 2.8, 0.6);
  const frame = new THREE.Mesh(frameGeo, lampHousingMat);
  frame.position.set(0, 22.8, 0.2);
  frame.rotation.x = 0.38;

  const faceGeo = new THREE.PlaneGeometry(5.1, 2.3);
  const face = new THREE.Mesh(faceGeo, emitterMat);
  face.position.set(0, 22.8, 0.52);
  face.rotation.x = 0.38;

  disposables.push(baseGeo, mastGeo, frameGeo, faceGeo);
  tower.add(base, mast, frame, face);
  return tower;
}
