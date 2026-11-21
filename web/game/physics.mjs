export const WORLD_LIMIT = 43;

export function damping(rate, dt) { return 1 - Math.exp(-rate * dt); }
export function integrateVelocity(value, target, rate, dt) {
  const decay = Math.exp(-rate * dt);
  return { value: target + (value - target) * decay,
    distance: target * dt + (value - target) * (1 - decay) / rate };
}
export function turnTo(angle, target, rate, dt) {
  const delta = Math.atan2(Math.sin(target - angle), Math.cos(target - angle));
  return angle + delta * damping(rate, dt);
}

export function movementIntent(input, cameraYaw) {
  const length = Math.hypot(input.x, input.z);
  if (!length) return { x: 0, z: 0, strength: 0 };
  const strength = Math.min(1, length);
  const x = input.x / length;
  const z = input.z / length;
  return {
    x: x * Math.cos(cameraYaw) - z * Math.sin(cameraYaw),
    z: -x * Math.sin(cameraYaw) - z * Math.cos(cameraYaw), strength,
  };
}

export function blocked(x, z, radius, colliders) {
  return colliders.some(item => {
    if (item.type === 'circle') return Math.hypot(x - item.x, z - item.z) < radius + item.radius;
    const nearestX = Math.max(item.x - item.width / 2, Math.min(x, item.x + item.width / 2));
    const nearestZ = Math.max(item.z - item.depth / 2, Math.min(z, item.z + item.depth / 2));
    return Math.hypot(x - nearestX, z - nearestZ) < radius;
  });
}

export function moveWithCollisions(position, delta, colliders, radius = 0.32) {
  let { x, z } = position;
  // Substeps prevent sprinting or a slow frame from tunnelling through a tree.
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / (radius * 0.5)));
  for (let step = 0; step < steps; step++) {
    const nextX = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, x + delta.x / steps));
    if (!blocked(nextX, z, radius, colliders)) x = nextX;
    const nextZ = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, z + delta.z / steps));
    if (!blocked(x, nextZ, radius, colliders)) z = nextZ;
  }
  return { x, z };
}

export function updateStamina(value, sprinting, moving, dt, endurance = 1) {
  return Math.max(0, Math.min(1, value + (sprinting && moving ? -0.17 / endurance : 0.12) * dt));
}

export function nearestResident(position, residents, distance = 2.8) {
  return residents.map(resident => ({ resident, distance: Math.hypot(position.x - resident.x, position.z - resident.z) }))
    .filter(item => item.distance <= distance).sort((a, b) => a.distance - b.distance)[0]?.resident || null;
}
