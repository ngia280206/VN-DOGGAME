import * as THREE from 'three';
import { textSprite } from './world.mjs';
import { damping, moveWithCollisions, turnTo } from './physics.mjs';
import { createThreat, lineOfSight, stepThreat } from './threats.mjs';

const RESIDENTS = [
  { name: 'Mai', color: '#c48972', hair: '#524438', path: [[-5, 7], [-8, 2], [-10, -10], [-14, -9], [-13, 7]], greeting: 'Ở dưới mái hiên có ánh đèn, họ sẽ không đuổi theo. Nhớ quay về trước khi kiệt sức.', skin: '#dfb794' },
  { name: 'An', hostile: true, color: '#789d9c', hair: '#443d35', path: [[5, 6], [11, 4], [13, -9], [6, -12]], greeting: 'Ôi, một người bạn bốn chân mới! Rất vui được gặp cậu.', skin: '#cfa480' },
  { name: 'Bảo', color: '#a3a677', hair: '#725742', path: [[-8, -12], [-16, -12], [-15, -16], [-7, -16]], greeting: 'Tôi nghe tiếng chân ở bên kia đài phun nước. Đi vòng xa một chút sẽ an toàn hơn.', skin: '#e4c1a0' },
  { name: 'Linh', color: '#bca4b4', hair: '#3c3932', path: [[12, -13], [16, -12], [15, -6], [10, -9]], greeting: 'Có thức ăn gần quán cũ. Nhưng đừng chạy ồn ào qua người gác.', skin: '#dcb28b' },
  { name: 'Minh', color: '#7893a4', hair: '#544536', path: [[-12, 12], [-8, 12], [-8, 17], [-14, 17]], greeting: 'Góc đèn bên hồ là chỗ trú. Nếu bị thương, quay lại đó rồi nhấn E để nghỉ.', skin: '#be8f6d' },
  { name: 'Chi', color: '#cfb06f', hair: '#6d4e38', path: [[7, 13], [11, 14], [11, 19], [6, 19]], greeting: 'Đừng chờ đến khi họ giơ tay. Khi thấy vòng đỏ trên đất, chạy ra khỏi đó ngay.', skin: '#e4be9d' },
  { name: 'Nam', hostile: true, color: '#8caa89', hair: '#454039', path: [[-13, 1], [-14, -3], [-11, -6], [-11, 1]], greeting: 'Chào cư dân mới của Pawtown. Cứ thoải mái khám phá nhé!', skin: '#d0a17d' },
  { name: 'Tú', hostile: true, color: '#b9957c', hair: '#5b4232', path: [[14, 2], [14, 7], [10, 7], [10, 2]], greeting: 'Một ngày nắng đẹp để chạy chơi. Cậu đến đúng lúc rồi!', skin: '#dfb18a' },
];

export function createResidents(scene, colliders = []) {
  const materialCache = new Map();
  const mat = color => {
    if (!materialCache.has(color)) materialCache.set(color, new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#37434e'), 0.48), roughness: 1 }));
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
    const name = textSprite(definition.hostile ? 'Người gác' : definition.name, { background: '#14212b', color: definition.hostile ? '#c99a79' : '#adbdbb', size: 0.32 });
    name.position.set(0, 2.04, 0); group.add(name);
    const marker = textSprite('!', { background: '#8b3d35', color: '#ffe1bc', size: 0.22 });
    marker.position.set(0, 2.38, 0); marker.visible = false; group.add(marker);
    const aim = new THREE.Mesh(new THREE.RingGeometry(0.68, 0.76, 40),
      new THREE.MeshBasicMaterial({ color: '#de795e', transparent: true, opacity: 0.7, depthWrite: false }));
    aim.rotation.x = -Math.PI / 2; aim.visible = false; scene.add(aim);
    const stone = part(new THREE.IcosahedronGeometry(0.09, 0), '#777b7d', 0, -0.43, 0.05, arms[1]);
    stone.visible = false;
    const [x, z] = definition.path[0]; group.position.set(x, 0, z);
    return { ...definition, id: definition.name, group, body, arms, legs, x, z,
      waypoint: 1, phase: index * 1.7, wait: index % 3, greetingTime: 0, greeted: false,
      heading: 0, speed: 0, threat: createThreat(), marker, aim, stone };
  });
  return {
    residents,
    greet(resident, player) {
      if (resident.hostile) return;
      resident.greetingTime = 4;
      resident.heading = Math.atan2(player.x - resident.x, player.z - resident.z);
      resident.group.rotation.y = resident.heading;
      resident.greeted = true;
    },
    tick(dt, time, player, context = {}) {
      const events = [];
      for (const resident of residents) {
        let target = null;
        let speed = 0;
        if (resident.hostile) {
          const distance = Math.hypot(player.x - resident.x, player.z - resident.z);
          const result = stepThreat(resident.threat, resident, player, dt, {
            ...context, visible: distance < 16 && lineOfSight(resident, player, colliders),
          });
          if (result.attack) events.push({ type: 'attack', source: resident.id, ...result.attack });
          if (result.escaped) events.push({ type: 'escaped', source: resident.id });
          if (result.move) { target = result; speed = result.speed; }
          const state = resident.threat.state;
          resident.marker.visible = resident.threat.awareness > 0.3 || state === 'windup';
          resident.marker.material.opacity = state === 'windup' ? 1 : 0.55 + resident.threat.awareness * 0.4;
          resident.aim.visible = state === 'windup';
          resident.stone.visible = state === 'windup' && resident.threat.kind === 'throw';
          if (state === 'windup') {
            resident.aim.position.set(resident.threat.aimX, 0.05, resident.threat.aimZ);
            resident.aim.scale.setScalar(1 + Math.sin(time * 12) * 0.08);
            resident.heading = turnTo(resident.heading,
              Math.atan2(resident.threat.aimX - resident.x, resident.threat.aimZ - resident.z), 8, dt);
          }
        }
        const patrolling = !resident.hostile || resident.threat.state === 'patrol';
        if (patrolling && resident.greetingTime > 0) resident.greetingTime = Math.max(0, resident.greetingTime - dt);
        else if (patrolling && resident.wait > 0) resident.wait -= dt;
        else if (patrolling) {
          const [x, z] = resident.path[resident.waypoint];
          if (Math.hypot(x - resident.x, z - resident.z) < 0.2) {
            resident.waypoint = (resident.waypoint + 1) % resident.path.length;
            resident.wait = 1.4 + resident.phase % 2;
          } else { target = { x, z }; speed = resident.hostile ? 0.85 : 0.6; }
        }
        let distanceMoved = 0;
        if (target && Math.hypot(player.x - resident.x, player.z - resident.z) > (resident.hostile ? 0.75 : 1.05)) {
          const dx = target.x - resident.x, dz = target.z - resident.z;
          const distance = Math.max(0.001, Math.hypot(dx, dz));
          const delta = { x: dx / distance * speed * dt, z: dz / distance * speed * dt };
          let next = moveWithCollisions(resident, delta, colliders, 0.25);
          if (Math.hypot(next.x - resident.x, next.z - resident.z) < speed * dt * 0.1 && !patrolling) {
            const left = moveWithCollisions(resident, { x: -delta.z, z: delta.x }, colliders, 0.25);
            const right = moveWithCollisions(resident, { x: delta.z, z: -delta.x }, colliders, 0.25);
            next = Math.hypot(left.x - target.x, left.z - target.z) < Math.hypot(right.x - target.x, right.z - target.z) ? left : right;
          }
          distanceMoved = Math.hypot(next.x - resident.x, next.z - resident.z);
          if (distanceMoved > 0.001) resident.heading = turnTo(resident.heading,
            Math.atan2(next.x - resident.x, next.z - resident.z), 9, dt);
          resident.x = next.x; resident.z = next.z;
        }
        resident.speed += (distanceMoved / dt - resident.speed) * damping(10, dt);
        resident.phase += distanceMoved * 5;
        const amplitude = Math.min(0.68, resident.speed * 0.4);
        const step = Math.sin(resident.phase) * amplitude;
        resident.legs[0].rotation.x = step; resident.legs[1].rotation.x = -step;
        resident.arms[0].rotation.x = -step * 0.65;
        resident.arms[1].rotation.x = resident.threat.state === 'windup' ? -2.2 : step * 0.65;
        resident.arms[1].rotation.z = resident.greetingTime > 0 ? -1.1 + Math.sin(time * 4) * 0.08 : -0.08;
        resident.body.position.y = -Math.abs(Math.sin(resident.phase)) * amplitude * 0.08;
        resident.body.rotation.x += ((resident.speed > 2 ? 0.12 : 0) - resident.body.rotation.x) * damping(8, dt);
        resident.group.position.set(resident.x, 0, resident.z);
        resident.group.rotation.y = resident.heading;
      }
      return events;
    },
  };
}
