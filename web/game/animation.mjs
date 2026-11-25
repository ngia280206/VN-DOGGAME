import { damping } from './physics.mjs';

export const GAITS = ['Idle', 'Walk', 'Trot', 'Gallop'];
export const GESTURES = ['Bark'];

export function gaitWeights(speed, height = 0.7) {
  speed = Math.max(0, speed - 0.025);
  const strideScale = Math.max(0.5, height / 0.7);
  const reference = [0, 1.05, 2.7, 5].map(value => value * strideScale);
  const weights = [0, 0, 0, 0];
  if (speed === 0) weights[0] = 1;
  else if (speed >= reference[3]) weights[3] = 1;
  else {
    const upper = reference.findIndex(value => value > speed);
    const blend = Math.max(0, Math.min(1, (speed - reference[upper - 1]) / (reference[upper] - reference[upper - 1])));
    weights[upper - 1] = 1 - blend; weights[upper] = blend;
  }
  return weights;
}

// Gaits share a distance-driven phase. Switching speed never restarts a clip.
export class DogAnimation {
  constructor(mixer, actions, height) {
    this.mixer = mixer; this.actions = actions; this.height = height;
    this.weights = [1, 0, 0, 0]; this.phase = 0; this.speed = 0;
    this.gesture = null; this.gestureTime = 0; this.gestureWeight = 0;
    for (const [index, name] of GAITS.entries()) {
      const action = actions.get(name);
      if (!action) continue;
      action.play().setEffectiveWeight(index === 0 ? 1 : 0);
      action.paused = index !== 0;
    }
  }

  play(name) {
    if (GAITS.includes(name)) return;
    const action = this.actions.get(name);
    if (!action || this.gestureTime > 0.15) return;
    if (this.gesture) this.actions.get(this.gesture)?.setEffectiveWeight(0).stop();
    this.gesture = name;
    this.gestureTime = action.getClip().duration;
    action.reset().play().setEffectiveWeight(0);
  }

  update(dt, speed = 0) {
    if (dt <= 0) return;
    this.speed += (speed - this.speed) * damping(10, dt);
    const desired = gaitWeights(this.speed, this.height);
    let total = 0;
    for (let index = 0; index < 4; index++) {
      this.weights[index] += (desired[index] - this.weights[index]) * damping(12, dt);
      if (desired[index] === 0 && this.weights[index] < 0.001) this.weights[index] = 0;
      total += this.weights[index];
    }
    for (let index = 0; index < 4; index++) this.weights[index] /= total;
    const scale = Math.max(0.5, this.height / 0.7);
    const moving = Math.max(0.001, 1 - this.weights[0]);
    const stride = (this.weights[1] * 1.05 + this.weights[2] * 1.65 + this.weights[3] * 2.65) / moving * scale;
    this.phase = (this.phase + this.speed * dt / Math.max(0.45, stride)) % 1;
    this.gestureTime = Math.max(0, this.gestureTime - dt);
    const targetGesture = this.gestureTime > 0.12 ? (this.speed > 0.3 ? 0.35 : 1) : 0;
    this.gestureWeight += (targetGesture - this.gestureWeight) * damping(15, dt);
    if (this.gesture && this.gestureTime === 0 && this.gestureWeight < 0.005) {
      this.actions.get(this.gesture).stop(); this.gesture = null; this.gestureWeight = 0;
    }
    for (const [index, name] of GAITS.entries()) {
      const action = this.actions.get(name);
      if (!action) continue;
      action.enabled = this.weights[index] > 0;
      action.setEffectiveWeight(this.weights[index] * (1 - this.gestureWeight));
      if (index) action.time = this.phase * action.getClip().duration;
    }
    if (this.gesture) {
      this.actions.get(this.gesture).setEffectiveWeight(this.gestureWeight);
    }
    this.mixer.update(dt);
  }

  clip() {
    if (this.gestureTime > 0.12 && this.gesture) return this.gesture;
    return GAITS[this.weights.indexOf(Math.max(...this.weights))];
  }
}
