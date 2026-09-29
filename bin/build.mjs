import { copyFile, mkdir } from 'node:fs/promises';
await mkdir('public/assets/vendor', { recursive: true });
for (const [src, dest] of [
  ['three/build/three.module.min.js', 'three.module.min.js'],
  ['three/build/three.core.min.js', 'three.core.min.js'],
  ['three/LICENSE', 'THREE-LICENSE.txt'],
  ['gsap/dist/gsap.min.js', 'gsap.min.js'],
  ['gsap/dist/ScrollTrigger.min.js', 'ScrollTrigger.min.js'],
  ['gsap/README.md', 'GSAP-NOTICE.md'],
])
  await copyFile(`node_modules/${src}`, `public/assets/vendor/${dest}`);
console.log('Dipendenze frontend locali aggiornate. Nessun servizio remoto richiesto.');
