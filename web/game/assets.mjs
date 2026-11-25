import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '/vendor/meshopt_decoder.mjs';
import { DogAnimation, GAITS, GESTURES } from './animation.mjs';

export async function loadDog(dog) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const { scene, animations } = await loader.loadAsync(dog.asset);
  const root = new THREE.Group();
  root.add(scene);
  const mixer = new THREE.AnimationMixer(scene);
  const actions = new Map();
  for (const name of [...GAITS, ...GESTURES]) {
    const clip = THREE.AnimationClip.findByName(animations, name);
    if (!clip) throw new Error(`Missing dog animation: ${name}`);
    const action = mixer.clipAction(clip);
    if (GESTURES.includes(name)) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    actions.set(name, action);
  }

  const height = dog.height * 0.68;
  const animation = new DogAnimation(mixer, actions, height);
  mixer.update(0);
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene, true);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  root.scale.setScalar(height / size.y);
  scene.position.sub(center).y += size.y * 0.5;
  scene.traverse(node => {
    if (node.isSkinnedMesh) node.frustumCulled = false;
  });
  return { root, height, animation };
}
