import * as THREE from './vendor/three.module.min.js';
const host = document.querySelector('#scene'),
  motion = document.querySelector('#motion-toggle'),
  reduce = matchMedia('(prefers-reduced-motion: reduce)');
let paused = reduce.matches,
  visible = true,
  phase = 0,
  renderer,
  dirty = true;
const captions = [
  'Un’idea entra. Il progetto prende forma.',
  'Persone e attività, nella stessa direzione.',
  'Un confronto chiaro. Una versione alla volta.',
  'L’ultimo sì. E tutto torna al suo posto.',
];
const buttons = [...document.querySelectorAll('[data-phase]')];
buttons.forEach((button) =>
  button.addEventListener('click', () => {
    phase = Number(button.dataset.phase);
    dirty = true;
    buttons.forEach((b, i) => {
      b.classList.toggle('active', i === phase);
      b.setAttribute('aria-pressed', String(i === phase));
    });
    document.querySelector('#phase-caption').textContent = captions[phase];
  }),
);
function syncPause() {
  dirty = true;
  motion.textContent = paused ? '▷' : 'Ⅱ';
  motion.setAttribute('aria-pressed', String(paused));
  motion.setAttribute(
    'aria-label',
    paused ? 'Avvia il movimento 3D' : 'Metti in pausa il movimento 3D',
  );
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
  renderer = new THREE.WebGLRenderer({
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
  renderer.toneMappingExposure = 1.25;
  host.appendChild(renderer.domElement);
  host.classList.add('webgl-ready');
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(7, 5.3, 10);
  camera.lookAt(0, 0.4, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x748667, 3));
  const key = new THREE.DirectionalLight(0xfff9df, 5);
  key.position.set(-4, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -6;
  key.shadow.normalBias = 0.04;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc7efda, 3);
  fill.position.set(6, 2, -5);
  scene.add(fill);
  const group = new THREE.Group();
  scene.add(group);
  group.rotation.y = -0.25;
  function roundRect(x, y, w, h, r) {
    const s = new THREE.Shape();
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function portal(color, z, rotation) {
    const shape = roundRect(-1.72, -1.95, 3.44, 3.9, 0.72),
      hole = roundRect(-1.18, -1.42, 2.36, 2.84, 0.37);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.35,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.12,
      bevelThickness: 0.12,
      curveSegments: 20,
    });
    geo.center();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color, roughness: 0.29, metalness: 0.22 }),
    );
    mesh.position.set(0, 0.45, z);
    mesh.rotation.z = rotation;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  const portals = [
    portal(0x204e3f, -0.82, -0.12),
    portal(0xbdd979, 0, -0.12),
    portal(0x285443, 0.82, -0.12),
  ];
  function cardTexture() {
    const c = document.createElement('canvas');
    c.width = 768;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fbfcf5';
    ctx.fillRect(0, 0, 768, 512);
    ctx.fillStyle = '#173d33';
    ctx.font = 'bold 40px Arial';
    ctx.fillText('punto.', 45, 65);
    ctx.fillStyle = '#859178';
    ctx.font = '19px Arial';
    ctx.fillText('IL PROGETTO PRENDE FORMA', 45, 115);
    ctx.fillStyle = '#173d33';
    ctx.font = 'bold 46px Arial';
    ctx.fillText('Atelier Nove', 45, 205);
    ctx.fillStyle = '#74826f';
    ctx.font = '24px Arial';
    ctx.fillText('Un nuovo spazio per il brand.', 45, 253);
    ctx.fillStyle = '#e3ead9';
    ctx.fillRect(45, 306, 678, 5);
    ctx.fillStyle = '#cee795';
    ctx.beginPath();
    ctx.roundRect(45, 354, 229, 63, 31);
    ctx.fill();
    ctx.fillStyle = '#173d33';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('●  In movimento', 65, 394);
    ctx.font = '20px Arial';
    ctx.fillText('PT—001', 610, 394);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const cardGroup = new THREE.Group();
  group.add(cardGroup);
  cardGroup.position.set(-0.05, 0.4, 1.45);
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roundRect(-1.55, -1.03, 3.1, 2.06, 0.13), {
      depth: 0.055,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.035,
      bevelThickness: 0.025,
      curveSegments: 10,
    }),
    new THREE.MeshStandardMaterial({ color: 0xfafbf4, roughness: 0.45 }),
  );
  body.castShadow = true;
  cardGroup.add(body);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(3.04, 2.01),
    new THREE.MeshBasicMaterial({ map: cardTexture() }),
  );
  face.position.z = 0.09;
  cardGroup.add(face);
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 40, 24),
    new THREE.MeshStandardMaterial({ color: 0xebc49a, roughness: 0.21, metalness: 0.26 }),
  );
  orb.position.set(2, 1.8, 1.5);
  orb.castShadow = true;
  group.add(orb);
  const small = new THREE.Mesh(
    new THREE.TorusGeometry(0.33, 0.09, 16, 64),
    new THREE.MeshStandardMaterial({ color: 0xb0cc68, metalness: 0.4, roughness: 0.23 }),
  );
  small.position.set(-2, -0.4, 1.8);
  small.rotation.x = 0.45;
  group.add(small);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.ShadowMaterial({ opacity: 0.13 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.2;
  floor.receiveShadow = true;
  scene.add(floor);
  const pointer = { x: 0, y: 0 };
  host.addEventListener('pointermove', (e) => {
    const b = host.getBoundingClientRect();
    pointer.x = (e.clientX - b.left) / b.width - 0.5;
    pointer.y = (e.clientY - b.top) / b.height - 0.5;
  });
  host.addEventListener('pointerleave', () => {
    pointer.x = 0;
    pointer.y = 0;
  });
  new ResizeObserver(() => {
    dirty = true;
    const w = host.clientWidth,
      h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = w < 420 ? 12 : 10;
    camera.updateProjectionMatrix();
  }).observe(host);
  new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
    },
    { threshold: 0.05 },
  ).observe(host);
  let t = 0,
    last = performance.now();
  function draw(now) {
    requestAnimationFrame(draw);
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!visible || document.hidden) return;
    if (paused && !dirty) return;
    dirty = false;
    if (!paused) t += delta;
    const animation = !paused;
    const targetY = -0.25 + (animation ? pointer.x * 0.5 : 0) + phase * 0.12;
    group.rotation.y += (targetY - group.rotation.y) * (paused ? 1 : 0.055);
    group.rotation.x +=
      ((animation ? pointer.y * 0.12 : 0) - group.rotation.x) * (paused ? 1 : 0.05);
    cardGroup.position.y = 0.4 + (animation ? Math.sin(t * 0.85) * 0.11 : 0);
    cardGroup.rotation.z = (animation ? Math.sin(t * 0.5) * 0.025 : 0) - 0.08;
    cardGroup.position.z += (1.45 + phase * 0.16 - cardGroup.position.z) * (paused ? 1 : 0.05);
    portals.forEach((p, i) => {
      p.rotation.z = -0.12 + (animation ? Math.sin(t * 0.45 + i * 0.4) * 0.024 : 0);
    });
    orb.position.y = 1.8 + (animation ? Math.sin(t * 0.8 + 1) * 0.13 : 0);
    small.rotation.z = animation ? t * 0.12 : 0;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(draw);
  host.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    host.classList.remove('webgl-ready');
    motion.disabled = true;
  });
} catch (error) {
  host.classList.remove('webgl-ready');
  motion.hidden = true;
  console.info('Punto: anteprima statica attiva; WebGL non disponibile.');
}
