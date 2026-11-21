import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationClip, AnimationMixer, NumberKeyframeTrack, Object3D } from 'three';
import { DogAnimation, GAITS, gaitWeights } from '../web/game/animation.mjs';

function controller() {
  const object = new Object3D(), mixer = new AnimationMixer(object);
  const actions = new Map(GAITS.map((name, index) => [name, mixer.clipAction(new AnimationClip(name, 1,
    [new NumberKeyframeTrack('.position[x]', [0, 0.5, 1], [0, index * 0.1, 0])]))]));
  return { animation: new DogAnimation(mixer, actions, 0.7), actions, mixer, object };
}

test('gait weights remain finite, continuous and normalized at every speed', () => {
  for (const height of [0.28, 0.42, 0.72, 0.9]) {
    let previous = gaitWeights(0, height);
    for (let speed = 0.01; speed < 10; speed += 0.01) {
      const weights = gaitWeights(speed, height);
      assert.ok(weights.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
      assert.ok(Math.abs(weights.reduce((sum, value) => sum + value, 0) - 1) < 1e-10);
      assert.ok(weights.every((value, index) => Math.abs(value - previous[index]) < 0.05));
      previous = weights;
    }
  }
});

test('small dogs use a shorter stride and a faster gait at the same world speed', () => {
  assert.ok(gaitWeights(3, 0.3)[3] > gaitWeights(3, 0.9)[3]);
});

test('blending shares clip phase and preserves a normalized mixer over transitions', () => {
  const { animation, actions, object } = controller();
  for (let index = 0; index < 240; index++) {
    animation.update(1 / 60, index < 100 ? 3 : index < 180 ? 6 : 0);
    const total = [...actions.values()].reduce((sum, action) => sum + action.getEffectiveWeight(), 0);
    assert.ok(Math.abs(total - 1) < 1e-6);
    for (const name of ['Walk', 'Trot', 'Gallop']) assert.ok(Math.abs(actions.get(name).time - animation.phase) < 1e-9);
    assert.ok(Number.isFinite(object.position.x));
  }
  assert.equal(animation.clip(), 'Idle');
});

test('pausing animation does not advance phase, mixer time or bone samples', () => {
  const { animation, mixer, object } = controller();
  animation.update(0.5, 3);
  const before = { phase: animation.phase, time: mixer.time, x: object.position.x };
  animation.update(0, 6);
  assert.deepEqual({ phase: animation.phase, time: mixer.time, x: object.position.x }, before);
});

test('one-shot gestures fade back to locomotion without losing total weight', () => {
  const { animation, mixer, actions } = controller();
  actions.set('Bark', mixer.clipAction(new AnimationClip('Bark', 0.7,
    [new NumberKeyframeTrack('.position[y]', [0, 0.35, 0.7], [0, 0.1, 0])])));
  animation.play('Bark');
  for (let frame = 0; frame < 160; frame++) {
    animation.update(1 / 60, 0);
    const total = [...actions.values()].filter(action => action.isScheduled())
      .reduce((sum, action) => sum + action.getEffectiveWeight(), 0);
    assert.ok(Math.abs(total - 1) < 1e-6);
  }
  assert.equal(animation.gesture, null);
  assert.equal(animation.clip(), 'Idle');
});
