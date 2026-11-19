import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { MeshoptDecoder } from '/vendor/meshopt_decoder.mjs';

const MODELS = ['casual-walker', 'dog-walker', 'hiker', 'road-worker'];
const templates = new Map();
let loading;

/** Preload once before constructing residents. Every actor shares GPU geometry/textures. */
export function loadHumanAssets() {
  if (!loading) {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loading = Promise.all(MODELS.map(async name => {
      const data = await loader.loadAsync(`/characters/${name}.glb`);
      templates.set(name, data);
    })).catch(error => { loading = undefined; throw error; });
  }
  return loading;
}

const KICK_KEYS = [
  // phase, thigh, knee, ankle, counterbalancing torso
  [0, 0, 0, 0, 0],
  [0.24, 0.24, 1.05, -0.2, 0.08],
  [0.48, -0.98, 0.12, 0.1, 0.16],
  [0.58, -1.02, 0.06, 0.12, 0.16],
  [0.80, -0.34, 0.48, -0.1, 0.05],
  [1, 0, 0, 0, 0],
];

function sampleKick(phase, output) {
  const p = THREE.MathUtils.clamp(phase, 0, 1);
  const next = KICK_KEYS.findIndex(key => key[0] >= p);
  const a = KICK_KEYS[Math.max(0, next - 1)], b = KICK_KEYS[Math.max(0, next)];
  const t = THREE.MathUtils.smoothstep(p, a[0], b[0]);
  for (let i = 0; i < 4; i++) output[i] = THREE.MathUtils.lerp(a[i + 1], b[i + 1], t);
}

/**
 * Feet at y=0, +Z forward, metres. `variant` accepts a number or a model name.
 * The caller places root.position; optional heading sets root.rotation.y.
 * kickPhase is a normalized 0..1 windup/strike/recovery cycle (contact ~0.48).
 * If omitted, a held `kicking` flag starts one 0.82 s kick.
 */
export function createHumanActor({ variant = 0, hostile = false } = {}) {
  const index = typeof variant === 'number' ? Math.abs(Math.trunc(variant)) : Math.max(0, MODELS.indexOf(variant));
  const name = typeof variant === 'string' && MODELS.includes(variant) ? variant : MODELS[index % MODELS.length];
  const data = templates.get(name);
  if (!data) throw new Error('Call await loadHumanAssets() before creating human actors.');
  const root = new THREE.Group();
  root.name = `resident-${name}`;
  const model = clone(data.scene);
  root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map(data.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
  const idle = actions.get('idle'), walk = actions.get('walk');
  idle?.play();
  walk?.setEffectiveWeight(0).play();
  if (idle) idle.time = (index * 0.731) % idle.getClip().duration;
  if (walk) walk.time = (index * 0.227) % walk.getClip().duration;
  mixer.update(0);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model, true);
  const height = 1.73 + index % 3 * 0.035;
  const scale = height / Math.max(0.1, bounds.max.y - bounds.min.y);
  model.scale.setScalar(scale);
  // Keep the animation's pelvis bob, while preventing root-motion drift.
  model.position.y = -bounds.min.y * scale;
  const hips = model.getObjectByName('hips');
  const hipX = hips?.position.x ?? 0, hipZ = hips?.position.z ?? 0;
  const bones = Object.fromEntries(['thigh_R', 'calf_R', 'foot_R', 'thigh_L', 'spine', 'chest', 'upperarm_L', 'upperarm_R']
    .map(bone => [bone, model.getObjectByName(bone)]));
  model.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    // Skin bounds change when a foot swings outside the exported resting pose.
    node.frustumCulled = false;
  });
  root.userData.human = { variant: name, hostile, height };
  const axis = new THREE.Vector3(), parentQ = new THREE.Quaternion(), deltaQ = new THREE.Quaternion();
  const kickValues = [0, 0, 0, 0];
  let speed = 0, walkWeight = 0, kickElapsed = 0, wasKicking = false, disposed = false;

  // Rotate in actor space, independent of the rig's differently oriented bone axes.
  function bend(bone, angle, actorAxis = 'x') {
    if (!bone || Math.abs(angle) < 0.00001) return;
    root.getWorldQuaternion(parentQ);
    axis.set(actorAxis === 'x' ? 1 : 0, 0, actorAxis === 'z' ? 1 : 0).applyQuaternion(parentQ);
    bone.parent.getWorldQuaternion(parentQ).invert();
    axis.applyQuaternion(parentQ);
    deltaQ.setFromAxisAngle(axis, angle);
    bone.quaternion.premultiply(deltaQ);
    bone.updateMatrix();
    bone.updateWorldMatrix(false, true);
  }

  return {
    root,
    height,
    update(dt, state = {}) {
      if (disposed) return;
      const step = Math.min(0.1, Math.max(0, Number.isFinite(dt) ? dt : 0));
      const kicking = !!state.kicking;
      if (Number.isFinite(state.heading)) root.rotation.y = state.heading;
      if (kicking && !wasKicking) kickElapsed = 0;
      if (kicking) kickElapsed += step;
      wasKicking = kicking;
      const phase = Number.isFinite(state.kickPhase) ? state.kickPhase : kickElapsed / 0.82;
      const activeKick = kicking && phase >= 0 && phase < 1;
      speed = THREE.MathUtils.damp(speed, activeKick ? 0 : Math.max(0, state.speed || 0), 12, step);
      const targetWeight = THREE.MathUtils.smoothstep(speed, 0.025, 0.4);
      walkWeight = THREE.MathUtils.damp(walkWeight, targetWeight, 10, step);
      idle?.setEffectiveWeight(1 - walkWeight);
      walk?.setEffectiveWeight(walkWeight);
      // Source has a real walk, not a run. Match its stride to travel speed.
      walk?.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 1.05, 0.35, 2.4));
      mixer.update(step);
      if (hips) { hips.position.x = hipX; hips.position.z = hipZ; }
      model.updateWorldMatrix(true, true);
      if (activeKick) {
        sampleKick(phase, kickValues);
        const [thigh, knee, ankle, lean] = kickValues;
        bend(bones.thigh_R, thigh);
        bend(bones.calf_R, knee);
        bend(bones.foot_R, ankle);
        bend(bones.thigh_L, lean * 0.25);
        bend(bones.spine, lean);
        bend(bones.chest, -lean * 0.45);
        bend(bones.upperarm_L, -lean * 1.8);
        bend(bones.upperarm_R, lean * 1.5);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      // Each cloned skeleton owns its bone texture; geometry/materials stay cached.
      const skeletons = new Set();
      model.traverse(node => { if (node.skeleton) skeletons.add(node.skeleton); });
      for (const skeleton of skeletons) skeleton.dispose();
      root.removeFromParent();
    },
  };
}
