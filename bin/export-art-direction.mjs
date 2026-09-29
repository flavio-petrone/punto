import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mkdir, writeFile } from 'node:fs/promises';

// GLTFExporter needs FileReader to encode its binary buffers in Node.
globalThis.FileReader = class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }
};

const output = new URL('../design/production/spline/', import.meta.url);
await mkdir(output, { recursive: true });
function rounded(x, y, w, h, r) {
  return new THREE.Shape()
    .moveTo(x + r, y).lineTo(x + w - r, y)
    .quadraticCurveTo(x + w, y, x + w, y + r)
    .lineTo(x + w, y + h - r).quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    .lineTo(x + r, y + h).quadraticCurveTo(x, y + h, x, y + h - r)
    .lineTo(x, y + r).quadraticCurveTo(x, y, x + r, y);
}
const shape = rounded(-1.6, -1.85, 3.2, 3.7, 0.78);
shape.holes.push(rounded(-1.05, -1.29, 2.1, 2.58, 0.4));
const geometry = new THREE.ExtrudeGeometry(shape, {
  depth: 0.38, bevelEnabled: true, bevelSegments: 4,
  bevelSize: 0.16, bevelThickness: 0.15, curveSegments: 16, steps: 1,
}).center();
const scene = new THREE.Scene();
scene.name = 'Punto_Forma_e_direzione';
scene.userData = { author: 'Flavio Petrone', status: 'Original source for Spline import; not a Spline export' };
const sculpture = new THREE.Group();
sculpture.name = 'Punto_Sculpture';
sculpture.rotation.set(0.08, -0.24, -0.1);
scene.add(sculpture);
const colors = [0x214d3b, 0xc9e785, 0x173f33];
const names = ['Portal_Brief', 'Portal_Project', 'Portal_Delivery'];
const portals = colors.map((color, index) => {
  const material = new THREE.MeshPhysicalMaterial({ color, roughness: 0.24, metalness: 0.14, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  material.name = ['Ceramic_Forest', 'Ceramic_Lime', 'Ceramic_Ink'][index];
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = names[index];
  mesh.position.set((index - 1) * 0.34, 0.5, (index - 1) * 1.15);
  mesh.rotation.z = -0.22 + index * 0.06;
  sculpture.add(mesh);
  return mesh;
});
const metal = new THREE.MeshStandardMaterial({color:0xdcd9ba, roughness:0.18, metalness:1});
metal.name = 'Champagne_Brushed';
const point = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 24), metal);
point.name = 'Punto_Anchor';
point.position.set(2.1, 1.55, 0.8);
sculpture.add(point);
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.055, 12, 48), metal);
ring.name = 'Delivery_Ring';
ring.position.set(-1.9, -0.65, 1.8);
ring.rotation.set(0.6, 0.3, 0.2);
sculpture.add(ring);

// All objects keep stable names so they can be selected and animated in Spline.
const poses = [
  { name:'01_Brief', turn:-0.26, spread:1.15, lift:0.4, twist:-0.2 },
  { name:'02_Project', turn:0.03, spread:0.9, lift:0.36, twist:-0.06 },
  { name:'03_Review', turn:-0.45, spread:1.45, lift:0.45, twist:0.07 },
  { name:'04_Delivery', turn:0.12, spread:0.64, lift:0.15, twist:0 },
];
const poseManifest = poses.map(pose => ({ ...pose, objects:portals.map((mesh,index) => ({
  name:mesh.name, position:[(index-1)*0.34,pose.lift,(index-1)*pose.spread],
  rotationRadians:[0,0,pose.twist+index*0.06],
})) }));
const binary = await new GLTFExporter().parseAsync(scene, { binary:true });
await writeFile(new URL('punto-portals.glb', output), Buffer.from(binary));
await writeFile(new URL('poses.json', output), JSON.stringify({
  unit:'meter', angles:'radians', transitionSeconds:1.2, easing:'ease-in-out',
  poses:poseManifest,
}, null, 2)+'\n');
let triangles=0;
scene.traverse(object => { if(object.isMesh) triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count)/3; });
console.log(JSON.stringify({file:'design/production/spline/punto-portals.glb',bytes:binary.byteLength,triangles,objects:names.concat(point.name,ring.name)}));
