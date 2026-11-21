import * as THREE from 'three';

export function createRain(scene, count = 420) {
  const positions = new Float32Array(count * 6);
  const seeds = new Float32Array(count * 3);
  let random = 7123;
  const next = () => { random = (random * 1664525 + 1013904223) >>> 0; return random / 4294967296; };
  for (let index = 0; index < count; index++) {
    seeds[index * 3] = (next() - 0.5) * 38;
    seeds[index * 3 + 1] = next() * 17;
    seeds[index * 3 + 2] = (next() - 0.5) * 38;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color: '#8fa4b6', transparent: true, opacity: 0.24, depthWrite: false });
  const rain = new THREE.LineSegments(geometry, material); rain.frustumCulled = false; scene.add(rain);
  return {
    update(time, player) {
      rain.position.set(player.x, 0, player.z);
      for (let index = 0; index < count; index++) {
        const seed = index * 3, offset = index * 6;
        const y = ((seeds[seed + 1] - time * 9) % 17 + 17) % 17;
        positions[offset] = seeds[seed]; positions[offset + 1] = y; positions[offset + 2] = seeds[seed + 2];
        positions[offset + 3] = seeds[seed] - 0.06; positions[offset + 4] = y + 0.35; positions[offset + 5] = seeds[seed + 2] - 0.025;
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

export function pavementTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const image = context.createImageData(256, 256);
  let seed = 1701;
  for (let offset = 0; offset < image.data.length; offset += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = 205 + (seed % 42);
    image.data[offset] = value; image.data[offset + 1] = value; image.data[offset + 2] = value; image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  context.strokeStyle = '#91999d'; context.lineWidth = 0.7;
  for (let line = 0; line < 11; line++) {
    const x = line * 23;
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x + 6, 44); context.lineTo(x - 3, 79); context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(16, 16);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
