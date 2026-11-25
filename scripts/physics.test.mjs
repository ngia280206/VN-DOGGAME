import test from 'node:test';
import assert from 'node:assert/strict';
import { movementIntent, moveOnStage, integrateVelocity, turnTo,
  updateStamina, STAGE_RADIUS } from '../web/game/physics.mjs';

test('movement remains relative to the camera and diagonal movement is normalized', () => {
  const forward = movementIntent({ x: 0, z: 1 }, 0);
  assert.equal(forward.x, 0); assert.equal(forward.z, -1);
  const rotated = movementIntent({ x: 0, z: 1 }, Math.PI / 2);
  assert.ok(Math.abs(rotated.x + 1) < 1e-10);
  assert.ok(Math.abs(rotated.z) < 1e-10);
  const diagonal = movementIntent({ x: 1, z: 1 }, 0.7);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 1e-10);
});

test('acceleration and travel distance agree across rendering frame rates', () => {
  const runs = [30, 60, 144].map(fps => {
    let value = 0, distance = 0;
    for (let step = 0; step < fps * 3; step++) {
      const next = integrateVelocity(value, step < fps * 2 ? 5 : 0, 10, 1 / fps);
      value = next.value; distance += next.distance;
    }
    return { value, distance };
  });
  for (const run of runs) assert.ok(Math.abs(run.distance - runs[0].distance) < 1e-9);
});

test('the player can move freely inside the stage and slide along its circular perimeter', () => {
  const position = { x: 0, y: 0.7, z: 0 };
  moveOnStage(position, 2, 3);
  assert.deepEqual(position, { x: 2, y: 0.7, z: 3 });

  position.x = STAGE_RADIUS;
  position.z = 0;
  moveOnStage(position, 1, 2);
  assert.ok(Math.abs(Math.hypot(position.x, position.z) - STAGE_RADIUS) < 1e-10);
  assert.ok(position.z > 1.9);
  assert.equal(position.y, 0.7);
  moveOnStage(position, -1, 0);
  assert.ok(Math.hypot(position.x, position.z) < STAGE_RADIUS);
});

test('sprinting drains energy, resting recovers it, and values stay bounded', () => {
  assert.ok(updateStamina(1, true, true, 1) < 1);
  assert.ok(updateStamina(0.5, false, false, 1) > 0.5);
  assert.equal(updateStamina(0.01, true, true, 10), 0);
  assert.equal(updateStamina(0.95, false, false, 10), 1);
});

test('turning crosses the angle seam without a full spin', () => {
  const next = turnTo(Math.PI - 0.01, -Math.PI + 0.01, 12, 1 / 60);
  assert.ok(next > Math.PI - 0.01);
  assert.ok(next < Math.PI + 0.02);
});
