import test from 'node:test';
import assert from 'node:assert/strict';
import { createThreat, stepThreat, lineOfSight, refugeAt, segmentHitsSphere } from '../web/game/threats.mjs';

const person = { x: 0, z: 0, heading: 0 };
const context = { active: true, visible: true, safe: false, noise: false, sprinting: false };

test('patrols warn before releasing a locked-aim attack', () => {
  const threat = createThreat();
  let windupTime = 0, attack = null;
  for (let index = 0; index < 220 && !attack; index++) {
    const result = stepThreat(threat, person, { x: 0, z: 4 }, 1 / 60, context);
    if (threat.state === 'windup') windupTime += 1 / 60;
    attack = result.attack;
  }
  assert.ok(attack);
  assert.equal(attack.kind, 'throw');
  assert.ok(windupTime >= 1, `expected a readable warning, got ${windupTime}`);
  assert.equal(attack.aimX, 0); assert.equal(attack.aimZ, 4);
});

test('the aim stays at the telegraphed location when the dog dodges', () => {
  const threat = { ...createThreat(), state: 'windup', timer: 0.1, aimX: 1, aimZ: 3 };
  const result = stepThreat(threat, person, { x: 5, z: 5 }, 0.2, context);
  assert.equal(result.attack.aimX, 1); assert.equal(result.attack.aimZ, 3);
});

test('refuges and inactive gameplay cancel attack windups', () => {
  for (const variant of [{ safe: true }, { active: false }]) {
    const threat = { ...createThreat(), state: 'windup', timer: 0.01, awareness: 1 };
    const result = stepThreat(threat, person, { x: 0, z: 1 }, 1 / 30, { ...context, ...variant });
    assert.equal(result.attack, null); assert.equal(threat.state, 'patrol');
  }
  assert.ok(refugeAt({ x: 0, z: 7 }));
  assert.equal(refugeAt({ x: 4, z: 7 }), null);
});

test('quiet dogs behind a patrol stay unnoticed; barking attracts attention', () => {
  const quiet = createThreat(), noisy = createThreat();
  for (let index = 0; index < 50; index++) {
    stepThreat(quiet, person, { x: 0, z: -6 }, 1 / 60, { ...context, visible: false });
    stepThreat(noisy, person, { x: 0, z: -6 }, 1 / 60, { ...context, visible: false, noise: true });
  }
  assert.equal(quiet.state, 'patrol'); assert.equal(noisy.state, 'chase');
});

test('breaking sight causes a finite search instead of endless pursuit', () => {
  const threat = { ...createThreat(), state: 'chase', awareness: 1, lastX: 2, lastZ: 2 };
  let escapes = 0;
  for (let index = 0; index < 360; index++) {
    const event = stepThreat(threat, person, { x: 10, z: -10 }, 1 / 60, { ...context, visible: false });
    if (event.escaped) escapes++;
  }
  assert.equal(escapes, 1); assert.equal(threat.state, 'patrol');
});

test('obstacles block sight, and swept projectile hits distinguish a jump', () => {
  assert.equal(lineOfSight({ x: -3, z: 0 }, { x: 3, z: 0 }, [{ type: 'box', x: 0, z: 0, width: 1, depth: 3 }]), false);
  assert.equal(lineOfSight({ x: -3, z: 3 }, { x: 3, z: 3 }, [{ type: 'box', x: 0, z: 0, width: 1, depth: 3 }]), true);
  const from = { x: -1, y: 0.3, z: 0 }, to = { x: 1, y: 0.3, z: 0 };
  assert.equal(segmentHitsSphere(from, to, { x: 0, y: 0.3, z: 0 }, 0.3), true);
  assert.equal(segmentHitsSphere(from, to, { x: 0, y: 1.1, z: 0 }, 0.3), false);
});
