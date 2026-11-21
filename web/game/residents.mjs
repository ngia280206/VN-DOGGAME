import * as THREE from 'three';
import { textSprite } from './world.mjs';
import { turnTo } from './physics.mjs';

const RESIDENTS = [
  { name: 'Mai', color: '#c48972', hair: '#524438', path: [[-5, 7], [-8, 2], [-10, -10], [-14, -9], [-13, 7]], greeting: 'Chào bạn nhỏ! Hôm nay mình cùng dạo một vòng nhé?', skin: '#dfb794' },
  { name: 'An', color: '#789d9c', hair: '#443d35', path: [[5, 6], [11, 4], [13, -9], [6, -12]], greeting: 'Ôi, một người bạn bốn chân mới! Rất vui được gặp cậu.', skin: '#cfa480' },
  { name: 'Bảo', color: '#a3a677', hair: '#725742', path: [[-8, -12], [-16, -12], [-15, -16], [-7, -16]], greeting: 'Quảng trường đẹp nhất vào buổi chiều đó. Cậu thấy không?', skin: '#e4c1a0' },
  { name: 'Linh', color: '#bca4b4', hair: '#3c3932', path: [[12, -13], [16, -12], [15, -6], [10, -9]], greeting: 'Cái đuôi đáng yêu quá! Hẹn cậu ở quán cà phê nha.', skin: '#dcb28b' },
  { name: 'Minh', color: '#7893a4', hair: '#544536', path: [[-12, 12], [-8, 12], [-8, 17], [-14, 17]], greeting: 'Mình đang đi bộ. Cậu muốn đi cùng một đoạn không?', skin: '#be8f6d' },
  { name: 'Chi', color: '#cfb06f', hair: '#6d4e38', path: [[7, 13], [11, 14], [11, 19], [6, 19]], greeting: 'Ở bãi cỏ có mấy chiếc vòng chơi vui lắm. Đi thử đi!', skin: '#e4be9d' },
  { name: 'Nam', color: '#8caa89', hair: '#454039', path: [[-13, 1], [-14, -3], [-11, -6], [-11, 1]], greeting: 'Chào cư dân mới của Pawtown. Cứ thoải mái khám phá nhé!', skin: '#d0a17d' },
  { name: 'Tú', color: '#b9957c', hair: '#5b4232', path: [[14, 2], [14, 7], [10, 7], [10, 2]], greeting: 'Một ngày nắng đẹp để chạy chơi. Cậu đến đúng lúc rồi!', skin: '#dfb18a' },
];

export function createResidents(scene) {
  const materialCache = new Map();
  const mat = color => {
    if (!materialCache.has(color)) materialCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    return materialCache.get(color);
  };
  const residents = RESIDENTS.map((definition, index) => {
    const group = new THREE.Group(); scene.add(group);
    const body = new THREE.Group(); group.add(body);
    const contact = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16),
      new THREE.MeshBasicMaterial({ color: '#4e6245', transparent: true, opacity: 0.14, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2; contact.position.y = 0.025; group.add(contact);
    function part(geometry, color, x, y, z, parent = body) {
      const mesh = new THREE.Mesh(geometry, mat(color)); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
    }
    part(new THREE.CylinderGeometry(0.2, 0.25, 0.6, 8), definition.color, 0, 1.08, 0);
    part(new THREE.CylinderGeometry(0.22, 0.2, 0.22, 8), '#69695b', 0, 0.72, 0);
    part(new THREE.SphereGeometry(0.2, 12, 10), definition.skin, 0, 1.57, 0);
    const hair = part(new THREE.SphereGeometry(0.205, 10, 8), definition.hair, 0, 1.66, -0.015);
    hair.scale.set(1.03, 0.65, 1.03);
    for (const x of [-0.067, 0.067]) part(new THREE.SphereGeometry(0.017, 6, 5), '#39362f', x, 1.59, 0.18);
    part(new THREE.SphereGeometry(0.036, 7, 5), definition.skin, 0, 1.52, 0.19);
    if (index % 3 === 1) {
      part(new THREE.CylinderGeometry(0.23, 0.23, 0.15, 10), '#d3c295', 0, 1.77, 0);
      part(new THREE.CylinderGeometry(0.31, 0.31, 0.035, 12), '#d3c295', 0, 1.7, 0);
    }
    if (index % 2 === 0) part(new THREE.BoxGeometry(0.35, 0.38, 0.18), '#9a8166', 0, 1.05, -0.2);
    const legs = [], arms = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * 0.12, 0.7, 0); body.add(leg); legs.push(leg);
      part(new THREE.CapsuleGeometry(0.085, 0.43, 3, 6), '#646e68', 0, -0.28, 0, leg);
      part(new THREE.BoxGeometry(0.17, 0.13, 0.3), '#eee7d5', 0, -0.61, 0.07, leg);
      const arm = new THREE.Group(); arm.position.set(side * 0.26, 1.32, 0); body.add(arm); arms.push(arm);
      part(new THREE.CapsuleGeometry(0.065, 0.3, 3, 6), definition.color, 0, -0.17, 0, arm);
      part(new THREE.SphereGeometry(0.07, 8, 6), definition.skin, 0, -0.4, 0, arm);
    }
    const name = textSprite(definition.name, { background: '#f7f2df', color: '#4a5e4a', size: 0.35 });
    name.position.set(0, 2.04, 0); group.add(name);
    const [x, z] = definition.path[0]; group.position.set(x, 0, z);
    return { ...definition, id: definition.name, group, body, arms, legs, x, z,
      waypoint: 1, phase: index * 1.7, wait: index % 3, greetingTime: 0, greeted: false };
  });
  return {
    residents,
    greet(resident, player) {
      resident.greetingTime = 5;
      resident.group.rotation.y = Math.atan2(player.x - resident.x, player.z - resident.z);
      resident.greeted = true;
    },
    tick(dt, time, player, active) {
      for (const resident of residents) {
        if (!active) continue;
        let walking = false;
        if (resident.greetingTime > 0) resident.greetingTime -= dt;
        else if (resident.wait > 0) resident.wait -= dt;
        else {
          const [x, z] = resident.path[resident.waypoint];
          const dx = x - resident.x, dz = z - resident.z;
          const distance = Math.hypot(dx, dz);
          if (distance < 0.2) {
            resident.waypoint = (resident.waypoint + 1) % resident.path.length;
            resident.wait = 1.4 + resident.phase % 2;
          } else if (Math.hypot(player.x - resident.x, player.z - resident.z) > 1.15) {
            const speed = 0.65;
            resident.x += dx / distance * speed * dt; resident.z += dz / distance * speed * dt;
            resident.group.position.set(resident.x, 0, resident.z);
            resident.group.rotation.y = turnTo(resident.group.rotation.y, Math.atan2(dx, dz), 5, dt);
            walking = true;
          }
        }
        const step = walking ? Math.sin(time * 5 + resident.phase) * 0.42 : 0;
        resident.legs[0].rotation.x = step; resident.legs[1].rotation.x = -step;
        resident.arms[0].rotation.x = -step * 0.65; resident.arms[1].rotation.x = step * 0.65;
        resident.arms[1].rotation.z = resident.greetingTime > 0 ? -2.1 + Math.sin(time * 7) * 0.18 : -0.08;
        resident.body.position.y = walking ? -Math.abs(Math.sin(time * 5 + resident.phase)) * 0.04 : Math.sin(time * 1.5 + resident.phase) * 0.008;
      }
    },
  };
}
