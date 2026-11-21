import * as THREE from 'three';
import { REFUGES } from './threats.mjs';
import { pavementTexture } from './weather.mjs';

export function textSprite(text, { color = '#ffffff', background = '#294535', size = 0.8 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 112;
  const context = canvas.getContext('2d');
  context.fillStyle = background;
  context.beginPath(); context.roundRect(4, 6, 504, 100, 28); context.fill();
  context.fillStyle = color;
  context.font = '600 38px system-ui, sans-serif';
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillText(text, 256, 58, 470);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
  sprite.scale.set(size * 3, size * 0.65, 1);
  return sprite;
}

export function createWorld(scene) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);
  const materials = new Map();
  const grime = pavementTexture();
  const overrides = {
    '#86a86a': '#303b39', '#e0ceb0': '#4b5359', '#ebddbf': '#535c60', '#d3bb98': '#424a50',
    '#cbb798': '#565e61', '#c7c5ae': '#596269', '#e5dfc5': '#657078', '#c4c5af': '#4d5a65',
    '#e9e3ca': '#606d78', '#e5e2ce': '#75828b', '#b5edf0': '#546a78', '#d8c7a0': '#3c464b',
    '#759d69': '#35413d', '#f6f1de': '#293540', '#dca16a': '#76685b',
  };
  const material = color => {
    if (!materials.has(color)) {
      const base = overrides[color] ? new THREE.Color(overrides[color])
        : new THREE.Color(color).lerp(new THREE.Color('#303d49'), 0.58);
      const surface = new THREE.MeshStandardMaterial({ color: base, roughness: 0.9 });
      if (['#e0ceb0', '#ebddbf'].includes(color)) { surface.map = grime; surface.roughness = 0.53; }
      if (color === '#f0d69a') { surface.emissive.set('#c38343'); surface.emissiveIntensity = 1.35; }
      if (color === '#9dc5c0') { surface.color.set('#5c676b'); surface.emissive.set('#b08a58'); surface.emissiveIntensity = 0.22; }
      materials.set(color, surface);
    }
    return materials.get(color);
  };
  function mesh(geometry, color, x, y, z, parent = group) {
    const node = new THREE.Mesh(geometry, typeof color === 'string' ? material(color) : color);
    node.position.set(x, y, z); node.receiveShadow = true;
    parent.add(node); return node;
  }
  function box(w, h, d, color, x, y, z, parent) { return mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, parent); }
  function disc(radius, color, x, y, z) {
    const node = mesh(new THREE.CircleGeometry(radius, 64), color, x, y, z);
    node.rotation.x = -Math.PI / 2; return node;
  }
  function cylinder(r1, r2, h, color, x, y, z, segments = 16) {
    return mesh(new THREE.CylinderGeometry(r1, r2, h, segments), color, x, y, z);
  }
  function circleCollider(x, z, radius) { colliders.push({ type: 'circle', x, z, radius }); }
  function rectangle(x, z, width, depth) { colliders.push({ type: 'box', x, z, width, depth }); }

  // An abandoned, damp square. Keep traversal readable under the moonlight.
  box(250, 0.4, 250, '#86a86a', 0, -0.25, 0);
  box(12, 0.04, 95, '#e0ceb0', 0, -0.018, 0);
  box(95, 0.045, 8, '#e0ceb0', 0, -0.012, 0);
  disc(11, '#ebddbf', 0, 0.015, -3);
  const plazaRing = mesh(new THREE.RingGeometry(10.3, 10.48, 96), '#d3bb98', 0, 0.025, -3);
  plazaRing.rotation.x = -Math.PI / 2;
  for (const x of [-5.8, 5.8]) box(0.12, 0.015, 95, '#cbb798', x, 0.011, 0);
  for (const z of [-3.8, 3.8]) box(95, 0.015, 0.12, '#cbb798', 0, 0.011, z);

  // A real obstacle and a recognizable meeting point.
  const fountainX = 0, fountainZ = -4;
  cylinder(3.4, 3.55, 0.3, '#c7c5ae', fountainX, 0.15, fountainZ, 48);
  cylinder(3.12, 3.25, 0.35, '#e5dfc5', fountainX, 0.44, fountainZ, 48);
  const waterMaterial = new THREE.MeshStandardMaterial({ color: '#243d4b', roughness: 0.24, metalness: 0.3, transparent: true, opacity: 0.88 });
  const water = disc(2.9, waterMaterial, fountainX, 0.63, fountainZ);
  cylinder(0.5, 0.7, 1.25, '#c4c5af', 0, 1.05, -4);
  cylinder(1.4, 0.5, 0.25, '#e9e3ca', 0, 1.72, -4, 32);
  const topWater = disc(1.18, waterMaterial, 0, 1.86, -4);
  cylinder(0.13, 0.17, 0.7, '#e5e2ce', 0, 2.1, -4);
  for (let index = 0; index < 2; index++) {
    const angle = index * Math.PI / 3;
    const points = [new THREE.Vector3(0, 2.4, -4),
      new THREE.Vector3(Math.sin(angle) * 0.7, 2.45, -4 + Math.cos(angle) * 0.7),
      new THREE.Vector3(Math.sin(angle) * 2.2, 0.67, -4 + Math.cos(angle) * 2.2)];
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, 0.035, 5, false), '#b5edf0', 0, 0, 0);
  }
  circleCollider(0, -4, 3.45);

  // Waterside park to the west.
  const shore = disc(1, '#d8c7a0', -26, 0.018, 5); shore.scale.set(9.7, 12.3, 1);
  const pond = disc(1, waterMaterial, -26, 0.035, 5); pond.scale.set(8.8, 11.3, 1);
  rectangle(-26, 5, 17.8, 22.7);
  for (let index = 0; index < 8; index++) {
    const angle = index * 0.75;
    const lily = disc(0.45, '#759d69', -26 + Math.sin(angle) * 5, 0.055, 5 + Math.cos(angle) * 7);
    lily.rotation.z = angle;
  }

  const buildingFootprints = [];
  function house(x, z, color, roofColor, label, rotation = 0, width = 7, height = 4.8) {
    const home = new THREE.Group(); home.position.set(x, 0, z); home.rotation.y = rotation; group.add(home);
    const wall = box(width, height, 6.2, color, 0, height / 2, 0, home); wall.castShadow = true;
    box(width + 0.3, 0.25, 6.5, '#e5ddc7', 0, 0.17, 0, home);
    const roof = mesh(new THREE.ConeGeometry(1, 1.6, 4), roofColor, 0, height + 0.8, 0, home);
    roof.scale.set(width * 0.81, 1, 5.1); roof.rotation.y = Math.PI / 4; roof.castShadow = true;
    box(1.25, 2.3, 0.15, '#6d867c', 0, 1.15, 3.16, home);
    box(0.07, 0.07, 0.1, '#eac584', 0.4, 1.15, 3.28, home);
    for (const wx of [-width * 0.31, width * 0.31]) {
      for (const wy of height > 5 ? [1.8, 4.1] : [2.3]) {
        box(1.45, 1.65, 0.12, '#f1e8cb', wx, wy, 3.17, home);
        box(1.17, 1.36, 0.13, '#9dc5c0', wx, wy, 3.25, home);
        box(0.08, 1.4, 0.15, '#f4e9cf', wx, wy, 3.33, home);
        box(1.2, 0.08, 0.15, '#f4e9cf', wx, wy, 3.33, home);
      }
    }
    if (label) {
      const sign = textSprite(label, { background: '#202b34', color: '#8e9c9f', size: 0.74 });
      sign.position.set(0, height - 0.65, 3.45); home.add(sign);
      for (let stripe = 0; stripe < 7; stripe++) {
        const awning = box(width / 7, 0.13, 1.4, stripe % 2 ? '#f3e7cd' : roofColor,
          -width / 2 + width / 14 + stripe * width / 7, 2.8, 3.65, home);
        awning.rotation.x = 0.2;
      }
    }
    const turns = Math.abs(Math.sin(rotation)) > 0.5;
    rectangle(x, z, turns ? 6.7 : width + 0.3, turns ? width + 0.3 : 6.7);
    buildingFootprints.push({ x, z, width: turns ? 6.7 : width, depth: turns ? width : 6.7 });
    return home;
  }
  house(-21, -22, '#ecd3ae', '#bb7052', 'ĐÃ ĐÓNG CỬA', 0, 7.7, 5.5);
  house(-10.8, -23, '#e0c3b5', '#6f9391', '', 0, 7, 5.8);
  house(10.5, -23, '#f0dfbc', '#c28b59', 'QUÁN CŨ', 0, 7.8, 5.2);
  house(21, -22, '#bbcbc4', '#a16e5b', '', 0, 7, 6);
  house(23, -9, '#ddc6af', '#789b8c', 'GÓC NHỎ', -Math.PI / 2, 7.3, 4.5);
  house(23, 8, '#e6bca7', '#be8258', '', -Math.PI / 2, 7.2, 5.1);
  house(17, 23, '#d9d7b4', '#8d9b78', '', Math.PI, 7, 4.8);
  house(-12, 29, '#d1c8aa', '#bd8663', '', Math.PI, 7, 4.6);

  function bench(x, z, rotation) {
    const seat = new THREE.Group(); seat.position.set(x, 0, z); seat.rotation.y = rotation; group.add(seat);
    for (const offset of [-0.26, 0, 0.26]) box(2.4, 0.13, 0.2, '#a87b50', 0, 0.56, offset, seat);
    for (const y of [0.9, 1.15]) box(2.4, 0.18, 0.12, '#b98c5e', 0, y, -0.43, seat);
    for (const x of [-0.85, 0.85]) {
      box(0.1, 0.6, 0.75, '#4a6356', x, 0.28, 0, seat);
      box(0.1, 0.9, 0.1, '#4a6356', x, 0.85, -0.43, seat);
    }
    rectangle(x, z, Math.abs(Math.sin(rotation)) > 0.5 ? 1 : 2.5, Math.abs(Math.sin(rotation)) > 0.5 ? 2.5 : 1);
  }
  bench(-6.7, -4, Math.PI / 2); bench(6.7, -4, -Math.PI / 2);
  bench(-12.5, 8, Math.PI / 2); bench(12, 13, Math.PI);

  for (const [index, [x, z]] of [[-8, 8], [8, 8], [-8, -13], [8, -13], [-14, 0], [15, 0]].entries()) {
    cylinder(0.11, 0.16, 3.1, '#4e6759', x, 1.55, z, 8);
    box(0.62, 0.15, 0.62, '#4c6558', x, 3.45, z);
    box(0.4, 0.6, 0.4, '#f0d69a', x, 3.1, z);
    if ([0, 2, 5].includes(index)) {
      const light = new THREE.PointLight('#daa56c', 21, 13, 2); light.position.set(x, 2.9, z); group.add(light);
    }
    circleCollider(x, z, 0.2);
  }

  // Instanced foliage keeps the social scene light enough for mobile devices.
  const treePositions = [
    [-12, -15], [-27, -16], [-32, -9], [-37, 0], [-38, 13], [-33, 21], [-21, 22],
    [-18, 15], [-11, 16], [-8, 24], [-3, 31], [7, 26], [25, 21], [31, 14], [33, 3],
    [32, -9], [28, -19], [4, -32], [-4, -32], [-17, -33], [18, -34], [-33, -29],
    [-39, -23], [-40, 30], [-28, 33], [-16, 39], [4, 39], [28, 32], [39, 21], [40, -22],
    [-15, -5], [13, -14], [-13, -28], [15, 17], [-5, 20], [6, 20], [-31, 29], [30, 29],
  ];
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.26, 2.3, 7), material('#8f7250'), treePositions.length);
  const crowns = [0, 1, 2].map(index => new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1),
    material(['#658e57', '#7da060', '#96b46c'][index]), treePositions.length));
  const dummy = new THREE.Object3D();
  treePositions.forEach(([x, z], index) => {
    const scale = 0.82 + ((index * 17) % 11) * 0.055;
    dummy.position.set(x, 1.1 * scale, z); dummy.scale.set(scale, scale, scale); dummy.rotation.set(0, index, 0); dummy.updateMatrix();
    trunks.setMatrixAt(index, dummy.matrix);
    crowns.forEach((crown, layer) => {
      dummy.position.set(x + (layer - 1) * 0.28, (2.8 + layer * 0.58) * scale, z + (layer === 1 ? 0.3 : 0));
      dummy.scale.set((1.65 - layer * 0.18) * scale, (1.8 - layer * 0.2) * scale, (1.5 - layer * 0.12) * scale);
      dummy.updateMatrix(); crown.setMatrixAt(index, dummy.matrix);
    });
    circleCollider(x, z, 0.28 * scale);
  });
  trunks.castShadow = true; group.add(trunks);
  for (const crown of crowns) { crown.castShadow = true; crown.receiveShadow = true; group.add(crown); }

  for (const [x, z] of [[-10, 11], [10, 11], [-9, -16], [9, -16], [-19, 18], [28, 0]]) {
    cylinder(0.95, 0.85, 0.4, '#cfb18b', x, 0.2, z);
    cylinder(0.85, 0.85, 0.12, '#727a49', x, 0.44, z);
    for (let petal = 0; petal < 7; petal++) {
      const angle = petal * 2.4;
      const fx = x + Math.sin(angle) * 0.55, fz = z + Math.cos(angle) * 0.55;
      cylinder(0.025, 0.025, 0.4, '#758b4b', fx, 0.65, fz, 5);
      mesh(new THREE.IcosahedronGeometry(0.14, 0), petal % 2 ? '#e6af9a' : '#ecd37d', fx, 0.88, fz);
    }
    circleCollider(x, z, 0.95);
  }

  // A small play lawn with hoops and a welcome gate.
  for (const x of [-12, -9, -6]) {
    const hoop = mesh(new THREE.TorusGeometry(0.64, 0.08, 7, 24), '#dca16a', x, 0.75, 21);
    hoop.rotation.y = Math.PI / 2;
  }
  box(0.28, 4.1, 0.28, '#907958', -5, 2.05, 16);
  box(0.28, 4.1, 0.28, '#907958', 5, 2.05, 16);
  box(10.5, 0.3, 0.45, '#907958', 0, 4.0, 16);
  const welcome = textSprite('PAWTOWN · ĐÊM XUỐNG', { background: '#1b2832', color: '#b4bec1', size: 1.25 });
  welcome.position.set(0, 3.7, 16); group.add(welcome);
  circleCollider(-5, 16, 0.3); circleCollider(5, 16, 0.3);

  const refugeRings = [];
  for (const zone of REFUGES) {
    const ring = mesh(new THREE.RingGeometry(zone.radius - 0.06, zone.radius, 64),
      new THREE.MeshBasicMaterial({ color: '#86b7ae', transparent: true, opacity: 0.32, depthWrite: false }), zone.x, 0.045, zone.z);
    ring.rotation.x = -Math.PI / 2; refugeRings.push(ring);
    for (const side of [-1, 1]) {
      box(0.13, 2.7, 0.13, '#687174', zone.x + side * 2.4, 1.35, zone.z + 1.8);
      circleCollider(zone.x + side * 2.4, zone.z + 1.8, 0.15);
    }
    box(5.4, 0.16, 3.3, '#47545c', zone.x, 2.75, zone.z + 0.55);
    const label = textSprite('TRÚ ẨN', { background: '#203b40', color: '#a9c4bc', size: 0.4 });
    label.position.set(zone.x, 2.4, zone.z + 1.75); group.add(label);
    const light = new THREE.PointLight('#e2b67e', 25, 9, 2); light.position.set(zone.x, 2.55, zone.z); group.add(light);
  }
  const puddleMaterial = new THREE.MeshStandardMaterial({ color: '#263d4b', roughness: 0.13, metalness: 0.4, transparent: true, opacity: 0.55 });
  for (const [index, [x, z]] of [[-2, 1], [3, 12], [-9, 0], [7, -11], [11, 5], [-4, -14], [-12, -3]].entries()) {
    const puddle = disc(1, puddleMaterial, x, 0.035, z); puddle.scale.set(1.1 + index % 3 * 0.4, 0.4 + index % 2 * 0.2, 1);
    puddle.rotation.z = index;
  }

  for (let index = 0; index < 20; index++) {
    const angle = index / 20 * Math.PI * 2;
    const hill = mesh(new THREE.SphereGeometry(1, 12, 8), index % 2 ? '#9bb47c' : '#acc493',
      Math.sin(angle) * 90, -3.5, Math.cos(angle) * 90);
    hill.scale.set(21 + index % 4 * 4, 13 + index % 3 * 5, 20);
  }
  const clouds = new THREE.Group(); scene.add(clouds);
  for (let index = 0; index < 10; index++) {
    const cloud = new THREE.Group(); cloud.position.set((index * 31 % 120) - 60, 20 + index % 3 * 3, (index * 19 % 110) - 55);
    for (let puff = 0; puff < 3; puff++) {
      const node = mesh(new THREE.SphereGeometry(1, 10, 8), '#f6f1de', (puff - 1) * 1.8, puff % 2 * 0.5, 0, cloud);
      node.scale.set(2.3, 1.1 + puff % 2 * 0.5, 1.2);
    }
    clouds.add(cloud);
  }

  return {
    colliders, buildingFootprints, refuges: REFUGES,
    tick(time, dt) {
      water.material.opacity = 0.84 + Math.sin(time * 0.8) * 0.04;
      topWater.rotation.z = time * 0.05;
      clouds.position.x = Math.sin(time * 0.008) * 12;
      for (const ring of refugeRings) ring.material.opacity = 0.28 + Math.sin(time * 1.4) * 0.035;
    },
  };
}
