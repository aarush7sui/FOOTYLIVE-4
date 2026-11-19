import * as THREE from 'three';

export interface TacticalPlayerNode {
  id: string;
  team: 'home' | 'away';
  number: number;
  name: string;
  role: string;
  rating: number;
  group: THREE.Group;
  hitbox: THREE.Mesh;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  baseX: number;
  baseZ: number;
  targetX: number;
  targetZ: number;
}

export interface StadiumAssembly {
  root: THREE.Group;
  roofGroup: THREE.Group;
  upperBowlGroup: THREE.Group;
  ballMesh: THREE.Mesh;
  ballShadow: THREE.Mesh;
  ballShadowMat: THREE.MeshBasicMaterial;
  selectionRing: THREE.Mesh;
  players: TacticalPlayerNode[];
  hitboxes: THREE.Mesh[];
  disposables: Array<{ dispose: () => void }>;
}

export function createStadiumTextures(maxAnisotropy: number) {
  const disposables: Array<{ dispose: () => void }> = [];

  // Full FIFA Pitch Canvas Texture (52m x 36m aspect)
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1408;
  const ctx = canvas.getContext('2d')!;

  const stripes = 18;
  const sw = canvas.width / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#165a2a' : '#1b6a32';
    ctx.fillRect(i * sw, 0, sw, canvas.height);
  }

  // Subtle mowing grain
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle =
      Math.random() > 0.5
        ? 'rgba(255,255,255,0.03)'
        : 'rgba(0,0,0,0.04)';
    ctx.fillRect(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      3,
      2
    );
  }

  // Crisp White Pitch Markings
  ctx.strokeStyle = 'rgba(246, 252, 249, 0.94)';
  ctx.lineWidth = 7;

  const padX = 110;
  const padY = 90;
  const fieldW = canvas.width - padX * 2;
  const fieldH = canvas.height - padY * 2;
  const midX = canvas.width / 2;
  const midY = canvas.height / 2;

  // Touchlines & Goal lines
  ctx.strokeRect(padX, padY, fieldW, fieldH);

  // Halfway line & Center Circle
  ctx.beginPath();
  ctx.moveTo(midX, padY);
  ctx.lineTo(midX, padY + fieldH);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(midX, midY, 155, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(midX, midY, 10, 0, Math.PI * 2);
  ctx.fill();

  // Left & Right Penalty Boxes + 6-yard boxes + arcs
  const penW = 285;
  const penH = 680;
  const sixW = 100;
  const sixH = 310;

  // Left
  ctx.strokeRect(padX, midY - penH / 2, penW, penH);
  ctx.strokeRect(padX, midY - sixH / 2, sixW, sixH);
  ctx.beginPath();
  ctx.arc(padX + 205, midY, 130, -0.34 * Math.PI, 0.34 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(padX + 205, midY, 8, 0, Math.PI * 2);
  ctx.fill();

  // Right
  ctx.strokeRect(padX + fieldW - penW, midY - penH / 2, penW, penH);
  ctx.strokeRect(padX + fieldW - sixW, midY - sixH / 2, sixW, sixH);
  ctx.beginPath();
  ctx.arc(
    padX + fieldW - 205,
    midY,
    130,
    Math.PI - 0.34 * Math.PI,
    Math.PI + 0.34 * Math.PI
  );
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(padX + fieldW - 205, midY, 8, 0, Math.PI * 2);
  ctx.fill();

  // Corner arcs
  const cr = 30;
  [
    [padX, padY, 0, Math.PI / 2],
    [padX + fieldW, padY, Math.PI / 2, Math.PI],
    [padX + fieldW, padY + fieldH, Math.PI, Math.PI * 1.5],
    [padX, padY + fieldH, Math.PI * 1.5, Math.PI * 2],
  ].forEach(([cx, cy, a1, a2]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, cr, a1, a2);
    ctx.stroke();
  });

  const pitchTex = new THREE.CanvasTexture(canvas);
  pitchTex.colorSpace = THREE.SRGBColorSpace;
  pitchTex.anisotropy = maxAnisotropy;
  disposables.push(pitchTex);

  // Match Ball Texture
  const bCanvas = document.createElement('canvas');
  bCanvas.width = 256;
  bCanvas.height = 128;
  const bCtx = bCanvas.getContext('2d')!;
  bCtx.fillStyle = '#f8fafc';
  bCtx.fillRect(0, 0, 256, 128);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 8; c++) {
      bCtx.fillStyle = (r + c) % 2 === 0 ? '#0f172a' : '#00ff88';
      bCtx.beginPath();
      bCtx.arc((c + 0.5) * 32, (r + 0.5) * 32, 8, 0, Math.PI * 2);
      bCtx.fill();
    }
  }
  const ballTex = new THREE.CanvasTexture(bCanvas);
  ballTex.colorSpace = THREE.SRGBColorSpace;
  ballTex.anisotropy = maxAnisotropy;
  disposables.push(ballTex);

  // Soft Radial Contact Shadow Texture
  const sCanvas = document.createElement('canvas');
  sCanvas.width = 64;
  sCanvas.height = 64;
  const sCtx = sCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 64, 64);
  const shadowTex = new THREE.CanvasTexture(sCanvas);
  disposables.push(shadowTex);

  return { pitchTex, ballTex, shadowTex, disposables };
}

function buildCompositeGoal(
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const g = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.6,
    roughness: 0.25,
  });
  const braceMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.8,
    roughness: 0.35,
  });
  const netMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.28,
    roughness: 0.9,
    wireframe: true,
  });
  disposables.push(postMat, braceMat, netMat);

  const halfSpan = 2.6;
  const h = 1.9;
  const d = 1.4;

  const postGeo = new THREE.CylinderGeometry(0.06, 0.06, h, 12);
  const p1 = new THREE.Mesh(postGeo, postMat);
  p1.position.set(0, h / 2, -halfSpan);
  p1.castShadow = true;
  const p2 = new THREE.Mesh(postGeo, postMat);
  p2.position.set(0, h / 2, halfSpan);
  p2.castShadow = true;

  const barGeo = new THREE.CylinderGeometry(0.06, 0.06, halfSpan * 2 + 0.1, 12);
  barGeo.rotateX(Math.PI / 2);
  const bar = new THREE.Mesh(barGeo, postMat);
  bar.position.set(0, h, 0);
  bar.castShadow = true;

  const stanchionGeo = new THREE.BoxGeometry(d, 0.05, 0.05);
  const s1 = new THREE.Mesh(stanchionGeo, braceMat);
  s1.position.set(-d / 2, 0.03, -halfSpan);
  const s2 = new THREE.Mesh(stanchionGeo, braceMat);
  s2.position.set(-d / 2, 0.03, halfSpan);

  const netBoxGeo = new THREE.BoxGeometry(d, h, halfSpan * 2, 4, 4, 8);
  const netMesh = new THREE.Mesh(netBoxGeo, netMat);
  netMesh.position.set(-d / 2, h / 2, 0);

  disposables.push(postGeo, barGeo, stanchionGeo, netBoxGeo);
  g.add(p1, p2, bar, s1, s2, netMesh);
  return g;
}

function buildCompositePlayer(
  team: 'home' | 'away',
  number: number,
  name: string,
  role: string,
  rating: number,
  shadowTex: THREE.CanvasTexture,
  sharedGeos: {
    torso: THREE.CapsuleGeometry;
    head: THREE.SphereGeometry;
    cap: THREE.SphereGeometry;
    limb: THREE.CapsuleGeometry;
    boot: THREE.BoxGeometry;
    collar: THREE.TorusGeometry;
    shadow: THREE.PlaneGeometry;
    hitbox: THREE.CylinderGeometry;
  },
  sharedMats: {
    jersey: THREE.MeshStandardMaterial;
    shorts: THREE.MeshStandardMaterial;
    skin: THREE.MeshStandardMaterial;
    trim: THREE.MeshStandardMaterial;
    boot: THREE.MeshStandardMaterial;
    shadow: THREE.MeshBasicMaterial;
    hitbox: THREE.MeshBasicMaterial;
  }
): TacticalPlayerNode {
  // Composite 7-part player grounded at y = 0
  const group = new THREE.Group();

  // Contact Shadow at y = 0.02
  const shadow = new THREE.Mesh(sharedGeos.shadow, sharedMats.shadow);
  shadow.position.y = 0.02;
  group.add(shadow);

  // Legs & Boots
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(0, 0.72, -0.11);
  const lLeg = new THREE.Mesh(sharedGeos.limb, sharedMats.shorts);
  lLeg.position.y = -0.34;
  lLeg.castShadow = true;
  const lBoot = new THREE.Mesh(sharedGeos.boot, sharedMats.boot);
  lBoot.position.set(0.04, -0.68, 0);
  leftLegPivot.add(lLeg, lBoot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0, 0.72, 0.11);
  const rLeg = new THREE.Mesh(sharedGeos.limb, sharedMats.shorts);
  rLeg.position.y = -0.34;
  rLeg.castShadow = true;
  const rBoot = new THREE.Mesh(sharedGeos.boot, sharedMats.boot);
  rBoot.position.set(0.04, -0.68, 0);
  rightLegPivot.add(rLeg, rBoot);

  // Jersey Torso
  const torso = new THREE.Mesh(sharedGeos.torso, sharedMats.jersey);
  torso.position.y = 1.08;
  torso.scale.set(0.85, 1, 1.12);
  torso.castShadow = true;

  // Metallic Collar Accent Ring
  const collar = new THREE.Mesh(sharedGeos.collar, sharedMats.trim);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.38;

  // Arms
  const lArm = new THREE.Mesh(sharedGeos.limb, sharedMats.jersey);
  lArm.position.set(0, 1.06, -0.31);
  lArm.rotation.x = 0.22;
  lArm.scale.set(0.75, 0.82, 0.75);
  const rArm = new THREE.Mesh(sharedGeos.limb, sharedMats.jersey);
  rArm.position.set(0, 1.06, 0.31);
  rArm.rotation.x = -0.22;
  rArm.scale.set(0.75, 0.82, 0.75);

  // Head + Hair Cap
  const head = new THREE.Mesh(sharedGeos.head, sharedMats.skin);
  head.position.y = 1.56;
  head.castShadow = true;
  const cap = new THREE.Mesh(sharedGeos.cap, sharedMats.boot);
  cap.position.y = 1.58;

  // Proxy Raycast Hitbox on Layer 1
  const hitbox = new THREE.Mesh(sharedGeos.hitbox, sharedMats.hitbox);
  hitbox.position.y = 0.9;
  hitbox.layers.set(1);
  const id = `${team}-${number}`;
  hitbox.userData.playerId = id;

  group.add(
    leftLegPivot,
    rightLegPivot,
    torso,
    collar,
    lArm,
    rArm,
    head,
    cap,
    hitbox
  );

  // Face opposing goals
  group.rotation.y = team === 'home' ? 0 : Math.PI;

  // Keep shadowTex referenced cleanly
  void shadowTex;

  return {
    id,
    team,
    number,
    name,
    role,
    rating,
    group,
    hitbox,
    leftLeg: leftLegPivot,
    rightLeg: rightLegPivot,
    baseX: 0,
    baseZ: 0,
    targetX: 0,
    targetZ: 0,
  };
}

export function buildTacticalStadium(maxAnisotropy: number): StadiumAssembly {
  const root = new THREE.Group();
  const roofGroup = new THREE.Group();
  const upperBowlGroup = new THREE.Group();
  const { pitchTex, ballTex, shadowTex, disposables } =
    createStadiumTextures(maxAnisotropy);

  // 1. Extended Exterior Ground Plaza (no floating boxed void)
  const plazaGeo = new THREE.CircleGeometry(140, 48);
  plazaGeo.rotateX(-Math.PI / 2);
  const plazaMat = new THREE.MeshStandardMaterial({
    color: 0x0e1524,
    roughness: 0.94,
    metalness: 0.04,
  });
  const plaza = new THREE.Mesh(plazaGeo, plazaMat);
  plaza.position.y = -0.08;
  plaza.receiveShadow = true;
  root.add(plaza);
  disposables.push(plazaGeo, plazaMat);

  // 2. Pitch Floor (52m x 36m)
  const pitchGeo = new THREE.PlaneGeometry(52, 36);
  pitchGeo.rotateX(-Math.PI / 2);
  const pitchMat = new THREE.MeshStandardMaterial({
    map: pitchTex,
    roughness: 0.88,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const pitch = new THREE.Mesh(pitchGeo, pitchMat);
  pitch.receiveShadow = true;
  root.add(pitch);
  disposables.push(pitchGeo, pitchMat);

  // 3. Goals at x = ±23.2
  const leftGoal = buildCompositeGoal(disposables);
  leftGoal.position.set(-23.2, 0, 0);
  const rightGoal = buildCompositeGoal(disposables);
  rightGoal.position.set(23.2, 0, 0);
  rightGoal.rotation.y = Math.PI;
  root.add(leftGoal, rightGoal);

  // 4. Lower Bowl Structural Deck + Perimeter LED Ribbon
  const deckShape = new THREE.Shape();
  deckShape.absarc(0, 0, 39, 0, Math.PI * 2, false);
  const deckHole = new THREE.Path();
  deckHole.absarc(0, 0, 29, 0, Math.PI * 2, true);
  deckShape.holes.push(deckHole);

  const lowerDeckGeo = new THREE.ExtrudeGeometry(deckShape, {
    depth: 3.4,
    bevelEnabled: true,
    bevelThickness: 0.35,
    bevelSize: 0.35,
    bevelSegments: 2,
    curveSegments: 40,
  });
  lowerDeckGeo.rotateX(Math.PI / 2);
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x1b2336,
    roughness: 0.85,
    metalness: 0.12,
  });
  const lowerDeck = new THREE.Mesh(lowerDeckGeo, concreteMat);
  lowerDeck.position.y = 3.4;
  lowerDeck.scale.set(1.08, 1, 0.82);
  lowerDeck.receiveShadow = true;
  root.add(lowerDeck);

  // Neon Perimeter LED Ring
  const ledGeo = new THREE.TorusGeometry(29.2, 0.22, 8, 64);
  ledGeo.rotateX(Math.PI / 2);
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00ff88,
    emissiveIntensity: 1.4,
    roughness: 0.25,
  });
  const ledRing = new THREE.Mesh(ledGeo, ledMat);
  ledRing.position.y = 0.65;
  ledRing.scale.set(1.08, 1, 0.82);
  root.add(ledRing);
  disposables.push(lowerDeckGeo, concreteMat, ledGeo, ledMat);

  // 5. Explodable Upper Bowl Tier + InstancedMesh Crowd (>600 seats)
  const upperShape = new THREE.Shape();
  upperShape.absarc(0, 0, 45.5, 0, Math.PI * 2, false);
  const upperHole = new THREE.Path();
  upperHole.absarc(0, 0, 38.2, 0, Math.PI * 2, true);
  upperShape.holes.push(upperHole);

  const upperDeckGeo = new THREE.ExtrudeGeometry(upperShape, {
    depth: 4.5,
    bevelEnabled: true,
    bevelThickness: 0.35,
    bevelSize: 0.35,
    bevelSegments: 2,
    curveSegments: 40,
  });
  upperDeckGeo.rotateX(Math.PI / 2);
  const upperMat = new THREE.MeshStandardMaterial({
    color: 0x222c44,
    roughness: 0.78,
    metalness: 0.18,
  });
  const upperDeck = new THREE.Mesh(upperDeckGeo, upperMat);
  upperDeck.position.y = 8.4;
  upperDeck.scale.set(1.08, 1, 0.82);
  upperBowlGroup.add(upperDeck);

  const crowdCount = 640;
  const seatGeo = new THREE.BoxGeometry(0.48, 0.6, 0.48);
  const seatMat = new THREE.MeshStandardMaterial({
    roughness: 0.72,
    metalness: 0.08,
  });
  const crowdInstanced = new THREE.InstancedMesh(seatGeo, seatMat, crowdCount);
  const dummy = new THREE.Object3D();
  const palette = [
    new THREE.Color(0x00ff88),
    new THREE.Color(0xf8fafc),
    new THREE.Color(0x38bdf8),
    new THREE.Color(0xff3355),
    new THREE.Color(0x94a3b8),
  ];
  for (let i = 0; i < crowdCount; i++) {
    const ring = i % 4;
    const angle = (i / crowdCount) * Math.PI * 2 + ring * 0.02;
    const radius = 39.2 + ring * 1.45;
    dummy.position.set(
      Math.cos(angle) * radius * 1.08,
      4.5 + ring * 0.95,
      Math.sin(angle) * radius * 0.82
    );
    dummy.rotation.y = -angle;
    dummy.scale.setScalar(0.88 + (i % 5) * 0.06);
    dummy.updateMatrix();
    crowdInstanced.setMatrixAt(i, dummy.matrix);
    crowdInstanced.setColorAt(i, palette[i % palette.length]);
  }
  crowdInstanced.instanceMatrix.needsUpdate = true;
  if (crowdInstanced.instanceColor) crowdInstanced.instanceColor.needsUpdate = true;
  crowdInstanced.computeBoundingSphere();
  upperBowlGroup.add(crowdInstanced);
  root.add(upperBowlGroup);
  disposables.push(upperDeckGeo, upperMat, seatGeo, seatMat);

  // 6. Explodable Stadium Cantilever Roof Canopy + Steel Truss Halo + 4 Floodlight Pylons
  const roofShape = new THREE.Shape();
  roofShape.absarc(0, 0, 47.5, 0, Math.PI * 2, false);
  const roofHole = new THREE.Path();
  roofHole.absarc(0, 0, 29.5, 0, Math.PI * 2, true);
  roofShape.holes.push(roofHole);

  const canopyGeo = new THREE.ExtrudeGeometry(roofShape, {
    depth: 0.55,
    bevelEnabled: true,
    bevelThickness: 0.2,
    bevelSize: 0.25,
    bevelSegments: 2,
    curveSegments: 44,
  });
  canopyGeo.rotateX(Math.PI / 2);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.35,
    metalness: 0.45,
    transparent: true,
    opacity: 0.9,
  });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.y = 12.6;
  canopy.scale.set(1.08, 1, 0.82);
  roofGroup.add(canopy);

  // Steel Tension Halo Ring
  const haloGeo = new THREE.TorusGeometry(29.8, 0.42, 12, 64);
  haloGeo.rotateX(Math.PI / 2);
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.85,
    roughness: 0.22,
  });
  const halo = new THREE.Mesh(haloGeo, steelMat);
  halo.position.y = 12.1;
  halo.scale.set(1.08, 1, 0.82);
  roofGroup.add(halo);

  // 4 Floodlight Banks mounted on Roof Perimeter
  const bankMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff6e0,
    emissiveIntensity: 2.0,
    roughness: 0.2,
  });
  const bankGeo = new THREE.BoxGeometry(7.2, 1.3, 0.7);
  [
    [-26, -24, 0.7],
    [26, -24, -0.7],
    [-26, 24, 2.4],
    [26, 24, -2.4],
  ].forEach(([bx, bz, ry]) => {
    const bank = new THREE.Mesh(bankGeo, bankMat);
    bank.position.set(bx, 13.5, bz);
    bank.rotation.y = ry;
    roofGroup.add(bank);
  });

  root.add(roofGroup);
  disposables.push(canopyGeo, canopyMat, haloGeo, steelMat, bankMat, bankGeo);

  // 7. 22 Composite Players (Shared Geometries & Materials)
  const sharedGeos = {
    torso: new THREE.CapsuleGeometry(0.24, 0.42, 5, 10),
    head: new THREE.SphereGeometry(0.16, 12, 12),
    cap: new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
    limb: new THREE.CapsuleGeometry(0.075, 0.48, 4, 8),
    boot: new THREE.BoxGeometry(0.18, 0.08, 0.12),
    collar: new THREE.TorusGeometry(0.18, 0.025, 6, 14),
    shadow: new THREE.PlaneGeometry(1.1, 1.1),
    hitbox: new THREE.CylinderGeometry(0.55, 0.55, 1.9, 10),
  };
  sharedGeos.shadow.rotateX(-Math.PI / 2);

  const homeJersey = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    roughness: 0.72,
    metalness: 0.06,
  });
  const awayJersey = new THREE.MeshStandardMaterial({
    color: 0xff3355,
    roughness: 0.72,
    metalness: 0.06,
  });
  const shortsMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.82,
    metalness: 0.04,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd99b72,
    roughness: 0.65,
    metalness: 0.02,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    metalness: 0.75,
    roughness: 0.24,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.42,
    metalness: 0.3,
  });
  const pShadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });

  disposables.push(
    ...Object.values(sharedGeos),
    homeJersey,
    awayJersey,
    shortsMat,
    skinMat,
    trimMat,
    bootMat,
    pShadowMat,
    hitboxMat
  );

  const homeRoster = [
    { num: 1, name: 'Courtois', role: 'Sweeper Keeper', rating: 8.6 },
    { num: 2, name: 'Carvajal', role: 'Attacking Right-Back', rating: 8.2 },
    { num: 4, name: 'Van Dijk', role: 'Ball-Playing CB', rating: 8.8 },
    { num: 6, name: 'Saliba', role: 'Stopper CB', rating: 8.5 },
    { num: 3, name: 'Davies', role: 'Inverted Wing-Back', rating: 8.3 },
    { num: 16, name: 'Rodri', role: 'Deep-Lying Playmaker', rating: 9.1 },
    { num: 8, name: 'Valverde', role: 'Box-to-Box Midfielder', rating: 8.7 },
    { num: 5, name: 'Bellingham', role: 'Shadow Striker #10', rating: 9.0 },
    { num: 7, name: 'Saka', role: 'Inverted Right Winger', rating: 8.6 },
    { num: 11, name: 'Vinícius Jr.', role: 'Inside Left Forward', rating: 9.1 },
    { num: 9, name: 'Mbappé', role: 'Complete Striker', rating: 9.2 },
  ];

  const awayRoster = [
    { num: 1, name: 'Alisson', role: 'Sweeper Keeper', rating: 8.5 },
    { num: 2, name: 'Hakimi', role: 'Wing-Back', rating: 8.4 },
    { num: 4, name: 'Rúben Dias', role: 'Defensive Leader', rating: 8.6 },
    { num: 5, name: 'Bastoni', role: 'Left Ball-Playing CB', rating: 8.3 },
    { num: 19, name: 'Theo Hernández', role: 'Overlapping Full-Back', rating: 8.2 },
    { num: 14, name: 'Rice', role: 'Destroyer Pivot', rating: 8.5 },
    { num: 10, name: 'Pedri', role: 'Tempo Controller', rating: 8.7 },
    { num: 17, name: 'De Bruyne', role: 'Creator #10', rating: 8.9 },
    { num: 11, name: 'Salah', role: 'Inside Right Forward', rating: 8.9 },
    { num: 7, name: 'Yamal', role: 'Wide Playmaker', rating: 8.6 },
    { num: 9, name: 'Haaland', role: 'Target Poacher', rating: 9.1 },
  ];

  const players: TacticalPlayerNode[] = [];
  const hitboxes: THREE.Mesh[] = [];

  homeRoster.forEach((p) => {
    const node = buildCompositePlayer(
      'home',
      p.num,
      p.name,
      p.role,
      p.rating,
      shadowTex,
      sharedGeos,
      {
        jersey: homeJersey,
        shorts: shortsMat,
        skin: skinMat,
        trim: trimMat,
        boot: bootMat,
        shadow: pShadowMat,
        hitbox: hitboxMat,
      }
    );
    players.push(node);
    hitboxes.push(node.hitbox);
    root.add(node.group);
  });

  awayRoster.forEach((p) => {
    const node = buildCompositePlayer(
      'away',
      p.num,
      p.name,
      p.role,
      p.rating,
      shadowTex,
      sharedGeos,
      {
        jersey: awayJersey,
        shorts: shortsMat,
        skin: skinMat,
        trim: trimMat,
        boot: bootMat,
        shadow: pShadowMat,
        hitbox: hitboxMat,
      }
    );
    players.push(node);
    hitboxes.push(node.hitbox);
    root.add(node.group);
  });

  // 8. Selection Tactical Ring + Animated Match Ball
  const selGeo = new THREE.RingGeometry(0.65, 0.85, 28);
  selGeo.rotateX(-Math.PI / 2);
  const selMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    side: THREE.DoubleSide,
  });
  const selectionRing = new THREE.Mesh(selGeo, selMat);
  selectionRing.position.y = 0.04;
  selectionRing.visible = false;
  root.add(selectionRing);

  const ballGeo = new THREE.SphereGeometry(0.28, 22, 22);
  const ballMat = new THREE.MeshStandardMaterial({
    map: ballTex,
    roughness: 0.36,
    metalness: 0.1,
  });
  const ballMesh = new THREE.Mesh(ballGeo, ballMat);
  ballMesh.position.set(0, 0.28, 0);
  ballMesh.castShadow = true;
  root.add(ballMesh);

  const ballShadowGeo = new THREE.PlaneGeometry(0.85, 0.85);
  ballShadowGeo.rotateX(-Math.PI / 2);
  const ballShadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const ballShadow = new THREE.Mesh(ballShadowGeo, ballShadowMat);
  ballShadow.position.set(0, 0.03, 0);
  root.add(ballShadow);

  disposables.push(selGeo, selMat, ballGeo, ballMat, ballShadowGeo, ballShadowMat);

  return {
    root,
    roofGroup,
    upperBowlGroup,
    ballMesh,
    ballShadow,
    ballShadowMat,
    selectionRing,
    players,
    hitboxes,
    disposables,
  };
}
