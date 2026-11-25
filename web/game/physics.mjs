export const STAGE_RADIUS = 28;

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
  const x = input.x / length;
  const z = input.z / length;
  const sin = Math.sin(cameraYaw);
  const cos = Math.cos(cameraYaw);
  return { x: x * cos - z * sin, z: -x * sin - z * cos, strength: Math.min(1, length) };
}

export function moveOnStage(position, dx, dz) {
  const x = position.x + dx;
  const z = position.z + dz;
  const distance = Math.hypot(x, z);
  const scale = distance > STAGE_RADIUS ? STAGE_RADIUS / distance : 1;
  position.x = x * scale;
  position.z = z * scale;
}

export function updateStamina(value, sprinting, moving, dt, endurance = 1) {
  return Math.max(0, Math.min(1, value + (sprinting && moving ? -0.17 / endurance : 0.12) * dt));
}
