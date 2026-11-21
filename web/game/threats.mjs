import { blocked } from './physics.mjs';

export const REFUGES = [
  { x: 0, z: 7, radius: 2.8, name: 'Mái hiên cũ' },
  { x: -12, z: 12, radius: 2.5, name: 'Góc trú bên hồ' },
];

export function refugeAt(position) {
  return REFUGES.find(zone => Math.hypot(position.x - zone.x, position.z - zone.z) < zone.radius) || null;
}

export function lineOfSight(from, to, colliders) {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.ceil(distance / 0.35);
  for (let index = 1; index < steps; index++) {
    const t = index / steps;
    if (blocked(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t, 0.06, colliders)) return false;
  }
  return true;
}

export function createThreat() {
  return { state: 'patrol', awareness: 0, timer: 0, cooldown: 1.5,
    lost: 0, pursuit: 0, lastX: 0, lastZ: 0, aimX: 0, aimZ: 0, kind: 'throw' };
}

// Pure state machine: perception and telegraphed attacks are testable without WebGL.
export function stepThreat(threat, person, player, dt, context) {
  const result = { attack: null, escaped: false, move: false, x: threat.lastX, z: threat.lastZ, speed: 0 };
  threat.cooldown = Math.max(0, threat.cooldown - dt);
  const dx = player.x - person.x, dz = player.z - person.z;
  const distance = Math.hypot(dx, dz);
  const facing = distance < 0.1 ? 1 : (dx * Math.sin(person.heading) + dz * Math.cos(person.heading)) / distance;
  const seen = context.visible && distance < (context.sprinting ? 10 : 8) && (facing > -0.1 || distance < 3.4);
  const heard = distance < (context.noise ? 12 : context.sprinting ? 5 : 1.5);

  if (!context.active || context.safe) {
    result.escaped = ['chase', 'windup'].includes(threat.state);
    threat.state = 'patrol'; threat.awareness = Math.max(0, threat.awareness - dt * 1.5);
    threat.timer = 0; threat.pursuit = 0; threat.lost = 0;
    return result;
  }

  if (threat.state === 'windup') {
    threat.timer -= dt;
    if (threat.timer <= 0) {
      result.attack = { kind: threat.kind, x: person.x, z: person.z, aimX: threat.aimX, aimZ: threat.aimZ };
      threat.state = 'recover'; threat.timer = 1.2; threat.cooldown = 2.9;
    }
    return result;
  }
  if (threat.state === 'recover') {
    threat.timer -= dt;
    if (threat.timer <= 0) threat.state = 'chase';
    return result;
  }
  if (seen || heard) {
    threat.lastX = player.x; threat.lastZ = player.z; threat.lost = 0;
    threat.awareness = Math.min(1, threat.awareness + dt * (context.noise ? 2.5 : distance < 3.5 ? 1.9 : 0.95));
  } else {
    threat.lost += dt;
    threat.awareness = Math.max(0, threat.awareness - dt * 0.2);
  }
  if (threat.state === 'patrol' && threat.awareness > 0.1) threat.state = 'suspicious';
  if (threat.state === 'suspicious' && threat.awareness >= 1) { threat.state = 'chase'; threat.pursuit = 0; }
  if (threat.state === 'suspicious' && threat.awareness === 0) threat.state = 'patrol';
  if (threat.state === 'search') {
    threat.timer -= dt;
    if (seen && threat.awareness > 0.7) { threat.state = 'chase'; threat.pursuit = 0; }
    else if (threat.timer <= 0) { threat.state = 'patrol'; threat.awareness = 0; }
  }
  if (threat.state === 'chase') {
    threat.pursuit += dt;
    if (threat.lost > 2.3 || distance > 16 || threat.pursuit > 12) {
      threat.state = 'search'; threat.timer = 3; result.escaped = true;
    } else if (seen && distance < 6.2 && threat.cooldown === 0) {
      threat.state = 'windup'; threat.kind = distance < 1.55 ? 'shove' : 'throw';
      threat.timer = threat.kind === 'shove' ? 0.75 : 1.05;
      threat.aimX = player.x; threat.aimZ = player.z;
      return result;
    }
  }
  if (['chase', 'suspicious', 'search'].includes(threat.state)) {
    result.move = Math.hypot(threat.lastX - person.x, threat.lastZ - person.z) > 0.7;
    result.x = threat.lastX; result.z = threat.lastZ;
    result.speed = threat.state === 'chase' ? 3.45 : threat.state === 'search' ? 1.25 : 0.8;
  }
  return result;
}

export function segmentHitsSphere(from, to, center, radius) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const length = dx * dx + dy * dy + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((center.x - from.x) * dx + (center.y - from.y) * dy + (center.z - from.z) * dz) / length)) : 0;
  return Math.hypot(from.x + dx * t - center.x, from.y + dy * t - center.y, from.z + dz * t - center.z) < radius;
}
