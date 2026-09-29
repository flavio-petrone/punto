import * as THREE from './vendor/three.module.min.js';

const host = document.querySelector('#scene');
const motion = document.querySelector('#motion-toggle');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const phaseButtons = [...document.querySelectorAll('[data-phase]')];
const phases = [
  {
    caption: 'Un’idea entra. Il progetto prende forma.',
    status: 'Un nuovo inizio.',
    badge: 'RICHIESTA RICEVUTA',
    title: 'Una nuova idea.',
    note: 'Ogni progetto parte da un ascolto.',
    label: '01 / Il brief',
    color: '#f2c7ac',
  },
  {
    caption: 'Persone e attività, nella stessa direzione.',
    status: 'Il team è in movimento.',
    badge: 'PROGETTO IN CORSO',
    title: 'Atelier Nove',
    note: 'Persone, attività e tempi. Collegati.',
    label: '02 / Il progetto',
    color: '#d9f391',
  },
  {
    caption: 'Un confronto chiaro. Una versione alla volta.',
    status: 'Il tuo punto di vista conta.',
    badge: 'IN ATTESA DEL TUO SÌ',
    title: 'La prima versione.',
    note: 'Una consegna. Un confronto chiaro.',
    label: '03 / La revisione',
    color: '#cbdfe9',
  },
  {
    caption: 'L’ultimo sì. E tutto torna al suo posto.',
    status: 'Ci siamo. Approvato.',
    badge: 'CONSEGNA APPROVATA',
    title: 'Proprio così.',
    note: 'Il cerchio si chiude. Il lavoro resta.',
    label: '04 / La consegna',
    color: '#d9f391',
  },
];
let phase = 0;
let paused = reduce.matches;
let visible = true;
let contextLost = false;
let frame = null;
let invalidate = () => {};
let updateCard = () => {};

function selectPhase(next, focus = false) {
  phase = (next + phases.length) % phases.length;
  phaseButtons.forEach((button, index) => {
    button.classList.toggle('active', index === phase);
    button.setAttribute('aria-pressed', String(index === phase));
  });
  document.querySelector('#phase-caption').textContent = phases[phase].caption;
  document.querySelector('#scene-status').textContent = phases[phase].status;
  document.querySelector('.scene-index').firstChild.textContent = `0${phase + 1}`;
  if (focus) phaseButtons[phase].focus();
  updateCard();
  invalidate();
}
phaseButtons.forEach((button, index) => {
  button.addEventListener('click', () => selectPhase(index));
  button.addEventListener('keydown', (event) => {
    const offsets = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (event.key in offsets) {
      event.preventDefault();
      selectPhase(index + offsets[event.key], true);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      selectPhase(event.key === 'Home' ? 0 : 3, true);
    }
  });
});
function syncPause() {
  motion.textContent = paused ? '▷' : 'Ⅱ';
  motion.setAttribute('aria-pressed', String(paused));
  motion.setAttribute(
    'aria-label',
    paused ? 'Avvia le animazioni' : 'Metti in pausa le animazioni',
  );
  document.dispatchEvent(new CustomEvent('punto:motion', { detail: { paused } }));
  invalidate();
}
motion.addEventListener('click', () => {
  paused = !paused;
  syncPause();
});
reduce.addEventListener('change', () => {
  paused = reduce.matches;
  syncPause();
});
syncPause();

try {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(6, 4.5, 11.5);
  camera.lookAt(0, 0.15, 0);

  // A small procedural photo studio supplies real reflections, without HDR downloads.
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#d8dfce');
  const studioRoom = new THREE.Mesh(
    new THREE.BoxGeometry(18, 14, 18),
    new THREE.MeshBasicMaterial({ color: '#758375', side: THREE.BackSide }),
  );
  studio.add(studioRoom);
  [
    { position: [-5, 4, 3], scale: [4, 7, 1], color: 0xfff8e4 },
    { position: [6, 3, -2], scale: [3, 8, 1], color: 0xedffe7 },
    { position: [0, 6, 0], scale: [7, 3, 1], color: 0xffffff },
  ].forEach(({ position, scale, color }) => {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    );
    panel.position.set(...position);
    panel.scale.set(...scale);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  });
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, 0);
  scene.environment = environment.texture;
  studio.traverse((object) => {
    object.geometry?.dispose();
    object.material?.dispose();
  });
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xf9ffed, 0x7b896d, 2));
  const key = new THREE.DirectionalLight(0xfff4df, 4.2);
  key.position.set(-3, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 7, bottom: -6 });
  key.shadow.normalBias = 0.035;
  key.shadow.bias = -0.0001;
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfeac0, 2.5);
  rim.position.set(5, 3, -5);
  scene.add(rim);
  const group = new THREE.Group();
  scene.add(group);
  group.rotation.set(0.08, -0.24, -0.1);

  function rounded(x, y, width, height, radius) {
    const s = new THREE.Shape();
    s.moveTo(x + radius, y);
    s.lineTo(x + width - radius, y);
    s.quadraticCurveTo(x + width, y, x + width, y + radius);
    s.lineTo(x + width, y + height - radius);
    s.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    s.lineTo(x + radius, y + height);
    s.quadraticCurveTo(x, y + height, x, y + height - radius);
    s.lineTo(x, y + radius);
    s.quadraticCurveTo(x, y, x + radius, y);
    return s;
  }
  const shape = rounded(-1.6, -1.85, 3.2, 3.7, 0.78);
  shape.holes.push(rounded(-1.05, -1.29, 2.1, 2.58, 0.4));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.38,
    bevelEnabled: true,
    bevelSegments: 6,
    bevelSize: 0.16,
    bevelThickness: 0.15,
    curveSegments: 24,
    steps: 1,
  });
  geometry.center();
  const portals = [0x214d3b, 0xc9e785, 0x173f33].map((color, i) => {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.24,
        metalness: 0.14,
        clearcoat: 0.5,
        clearcoatRoughness: 0.25,
        envMapIntensity: 1.15,
      }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set((i - 1) * 0.34, 0.5, (i - 1) * 1.15);
    mesh.rotation.z = -0.22 + i * 0.06;
    group.add(mesh);
    return mesh;
  });

  const cardCanvas = document.createElement('canvas');
  cardCanvas.width = 1024;
  cardCanvas.height = 660;
  const ctx = cardCanvas.getContext('2d');
  const cardTexture = new THREE.CanvasTexture(cardCanvas);
  cardTexture.colorSpace = THREE.SRGBColorSpace;
  cardTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  updateCard = () => {
    const data = phases[phase];
    ctx.fillStyle = '#fbfcf5';
    ctx.fillRect(0, 0, 1024, 660);
    ctx.fillStyle = '#153b33';
    ctx.font = '800 46px Manrope, Arial';
    ctx.fillText('punto.', 65, 85);
    ctx.font = '400 23px Manrope, Arial';
    ctx.fillStyle = '#7a897a';
    ctx.fillText('ATELIER NOVE / PT—001', 65, 142);
    ctx.font = '600 60px Manrope, Arial';
    ctx.fillStyle = '#153b33';
    ctx.fillText(data.title, 65, 280);
    ctx.font = '400 27px Manrope, Arial';
    ctx.fillStyle = '#72806c';
    ctx.fillText(data.note, 65, 343);
    ctx.fillStyle = '#e0e7d8';
    ctx.fillRect(65, 400, 890, 2);
    ctx.fillStyle = data.color;
    ctx.beginPath();
    ctx.roundRect(65, 461, 565, 69, 34);
    ctx.fill();
    ctx.fillStyle = '#173d33';
    ctx.font = '600 23px Manrope, Arial';
    ctx.fillText(data.badge, 90, 505);
    ctx.font = '400 24px Manrope, Arial';
    ctx.fillStyle = '#788570';
    ctx.fillText('ESEMPIO', 818, 505);
    ctx.fillStyle = '#9aa591';
    ctx.font = '400 22px Manrope, Arial';
    ctx.fillText(data.label, 65, 595);
    cardTexture.needsUpdate = true;
  };
  updateCard();
  document.fonts.ready.then(() => {
    updateCard();
    invalidate();
  });
  const card = new THREE.Group();
  group.add(card);
  const cardBody = new THREE.Mesh(
    new THREE.ExtrudeGeometry(rounded(-1.5, -0.97, 3, 1.94, 0.11), {
      depth: 0.045,
      bevelEnabled: true,
      bevelSize: 0.045,
      bevelThickness: 0.026,
      bevelSegments: 3,
      curveSegments: 12,
    }),
    new THREE.MeshPhysicalMaterial({ color: 0xfafcf5, roughness: 0.4, clearcoat: 0.15 }),
  );
  cardBody.castShadow = true;
  card.add(cardBody);
  const cardFace = new THREE.Mesh(
    new THREE.PlaneGeometry(2.94, 1.895),
    new THREE.MeshBasicMaterial({ map: cardTexture }),
  );
  cardFace.position.z = 0.078;
  card.add(cardFace);
  card.position.set(0.16, 0.3, 2.05);
  card.rotation.set(0.01, -0.1, -0.06);

  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0xdcd9ba,
    metalness: 1,
    roughness: 0.14,
    envMapIntensity: 1.3,
  });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 48, 32), chrome);
  orb.castShadow = true;
  orb.position.set(2.1, 1.55, 0.8);
  group.add(orb);
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.055, 16, 64), chrome);
  orbit.position.set(-1.9, -0.65, 1.8);
  orbit.rotation.set(0.6, 0.3, 0.2);
  group.add(orbit);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.ShadowMaterial({ opacity: 0.075 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2.12;
  ground.receiveShadow = true;
  scene.add(ground);
  // A soft contact shadow anchors the floating sculpture without post-processing.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const shadowCtx = shadowCanvas.getContext('2d');
  const gradient = shadowCtx.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradient.addColorStop(0, '#153b3350');
  gradient.addColorStop(1, '#153b3300');
  shadowCtx.fillStyle = gradient;
  shadowCtx.fillRect(0, 0, 128, 128);
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 5),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(shadowCanvas),
      transparent: true,
      depthWrite: false,
    }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = -2.1;
  scene.add(contact);

  const pointer = { x: 0, y: 0 };
  let scroll = 0;
  let elapsed = 0;
  let last = performance.now();
  const poses = [
    { turn: -0.26, spread: 1.15, lift: 0.4, cardX: 0.1, cardY: 0.18, cardZ: 2.05, twist: -0.2 },
    { turn: 0.03, spread: 0.9, lift: 0.36, cardX: -0.1, cardY: 0.42, cardZ: 1.95, twist: -0.06 },
    { turn: -0.45, spread: 1.45, lift: 0.45, cardX: 0.2, cardY: 0.25, cardZ: 2.3, twist: 0.07 },
    { turn: 0.12, spread: 0.64, lift: 0.15, cardX: 0.06, cardY: 0.1, cardZ: 1.48, twist: 0 },
  ];
  const lerp = THREE.MathUtils.lerp;
  function stop() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }
  function draw(now) {
    frame = null;
    if (!visible || document.hidden || contextLost) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!paused) elapsed += dt;
    const smoothing = paused ? 1 : 1 - Math.exp(-dt * 4.4);
    const p = poses[phase];
    const wave = paused ? 0 : Math.sin(elapsed * 0.6);
    group.rotation.y = lerp(
      group.rotation.y,
      p.turn + (paused ? 0 : pointer.x * 0.32 + scroll * 0.12),
      smoothing,
    );
    group.rotation.x = lerp(group.rotation.x, 0.06 + (paused ? 0 : pointer.y * 0.09), smoothing);
    group.rotation.z = lerp(group.rotation.z, -0.08 + (paused ? 0 : wave * 0.012), smoothing);
    portals.forEach((mesh, i) => {
      mesh.position.z = lerp(mesh.position.z, (i - 1) * p.spread, smoothing);
      mesh.position.x = lerp(mesh.position.x, (i - 1) * (phase === 2 ? 0.48 : 0.24), smoothing);
      mesh.position.y = lerp(
        mesh.position.y,
        p.lift + (paused ? 0 : Math.sin(elapsed * 0.65 + i * 0.55) * 0.065),
        smoothing,
      );
      mesh.rotation.z = lerp(
        mesh.rotation.z,
        p.twist + (i - 1) * (phase === 3 ? 0 : 0.045),
        smoothing,
      );
    });
    card.position.x = lerp(card.position.x, p.cardX, smoothing);
    card.position.y = lerp(card.position.y, p.cardY + wave * 0.09, smoothing);
    card.position.z = lerp(card.position.z, p.cardZ, smoothing);
    card.rotation.z = lerp(card.rotation.z, -0.04 + wave * 0.014, smoothing);
    orb.position.y = 1.7 + (paused ? 0 : Math.sin(elapsed * 0.75 + 1) * 0.16);
    orbit.rotation.z = paused ? 0.2 : elapsed * 0.09;
    renderer.render(scene, camera);
    host.classList.add('webgl-ready');
    if (!paused) frame = requestAnimationFrame(draw);
  }
  invalidate = () => {
    if (frame === null && visible && !document.hidden && !contextLost)
      frame = requestAnimationFrame(draw);
  };
  host.addEventListener('pointermove', (event) => {
    if (paused || event.pointerType === 'touch') return;
    const bounds = host.getBoundingClientRect();
    pointer.x = (event.clientX - bounds.left) / bounds.width - 0.5;
    pointer.y = (event.clientY - bounds.top) / bounds.height - 0.5;
    invalidate();
  });
  host.addEventListener('pointerleave', () => {
    pointer.x = 0;
    pointer.y = 0;
  });
  document.addEventListener('punto:scroll', (event) => {
    scroll = event.detail.progress;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else {
      last = performance.now();
      invalidate();
    }
  });
  new ResizeObserver(() => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = camera.aspect < 0.75 ? 14.4 : camera.aspect < 1 ? 12.6 : 11.5;
    camera.updateProjectionMatrix();
    invalidate();
  }).observe(host);
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        last = performance.now();
        invalidate();
      } else stop();
    },
    { threshold: 0.01 },
  ).observe(host);
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    stop();
    host.classList.remove('webgl-ready');
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    invalidate();
  });
  invalidate();
} catch (error) {
  host.classList.remove('webgl-ready');
  host.querySelector('canvas')?.remove();
  console.info('Punto: anteprima statica attiva; WebGL non disponibile.');
}
