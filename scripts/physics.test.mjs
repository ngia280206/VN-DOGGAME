import test from 'node:test';
import assert from 'node:assert/strict';
import { movementIntent, moveWithCollisions, integrateVelocity, turnTo,
  updateStamina, nearestResident, WORLD_LIMIT } from '../web/game/physics.mjs';

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

test('fast movement cannot tunnel through a wall or a tree', () => {
  const wall = [{ type: 'box', x: 0, z: 0, width: 0.3, depth: 8 }];
  const stopped = moveWithCollisions({ x: -4, z: 0 }, { x: 9, z: 0 }, wall);
  assert.ok(stopped.x < -0.4);
  const tree = [{ type: 'circle', x: 0, z: 0, radius: 0.25 }];
  assert.ok(moveWithCollisions({ x: 0, z: 4 }, { x: 0, z: -9 }, tree).z > 0.5);
});

test('collision preserves movement along a wall and enforces world boundaries', () => {
  const wall = [{ type: 'box', x: 0, z: 0, width: 1, depth: 10 }];
  const moved = moveWithCollisions({ x: -1, z: 0 }, { x: 2, z: 2 }, wall);
  assert.ok(moved.x < -0.8); assert.ok(moved.z > 1.9);
  const edge = moveWithCollisions({ x: 42, z: 42 }, { x: 10, z: 10 }, []);
  assert.equal(edge.x, WORLD_LIMIT); assert.equal(edge.z, WORLD_LIMIT);
});

test('sprinting drains energy, resting recovers it, and values stay bounded', () => {
  assert.ok(updateStamina(1, true, true, 1) < 1);
  assert.ok(updateStamina(0.5, false, false, 1) > 0.5);
  assert.equal(updateStamina(0.01, true, true, 10), 0);
  assert.equal(updateStamina(0.95, false, false, 10), 1);
});

test('greetings target only the closest resident within reach', () => {
  const residents = [{ name: 'Mai', x: 1, z: 0 }, { name: 'An', x: 2, z: 0 }];
  assert.equal(nearestResident({ x: 0, z: 0 }, residents).name, 'Mai');
  assert.equal(nearestResident({ x: 20, z: 0 }, residents), null);
});

test('turning crosses the angle seam without a full spin', () => {
  const next = turnTo(Math.PI - 0.01, -Math.PI + 0.01, 12, 1 / 60);
  assert.ok(next > Math.PI - 0.01);
  assert.ok(next < Math.PI + 0.02);
});
