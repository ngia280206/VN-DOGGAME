import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { MeshoptDecoder } from '/vendor/meshopt_decoder.mjs';
import { DogAnimation, GAITS } from './animation.mjs';

export class DogAssets {
  constructor() {
    this.loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    this.cache = new Map();
  }

  async acquire(dog) {
    let entry = this.cache.get(dog.id);
    if (!entry) {
      entry = { users: 0, used: performance.now() };
      entry.promise = this.loader.loadAsync(dog.asset).catch(error => {
        this.cache.delete(dog.id);
        throw error;
      });
      this.cache.set(dog.id, entry);
    }
    entry.users++;
    entry.used = performance.now();
    let data;
    try { data = await entry.promise; }
    catch (error) { entry.users--; throw error; }
    const scene = clone(data.scene);
    const root = new THREE.Group();
    root.add(scene);
    const mixer = new THREE.AnimationMixer(scene);
    const supported = new Set([...GAITS, 'Bark', 'Lie_Idle']);
    const actions = new Map(data.animations.filter(clip => supported.has(clip.name)).map(clip => [clip.name, mixer.clipAction(clip)]));
    for (const [name, action] of actions) {
      if (!['Idle', 'Walk', 'Trot', 'Gallop'].includes(name)) {
        action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true;
      }
    }
    actions.get('Idle')?.play();
    mixer.update(0);
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene, true);
    const center = bounds.getCenter(new THREE.Vector3());
    const height = Math.max(0.1, bounds.max.y - bounds.min.y);
    const worldHeight = dog.height * 0.68;
    root.scale.setScalar(worldHeight / height);
    scene.position.add(new THREE.Vector3(-center.x, -bounds.min.y, -center.z));
    scene.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        // Animated fur bounds vary significantly between clips.
        node.frustumCulled = false;
      }
    });
    const animation = new DogAnimation(mixer, actions, worldHeight);
    let released = false;
    return {
      root, mixer, actions, animation, height: worldHeight,
      play(name) { animation.play(name); },
      animate(dt, speed) { animation.update(dt, speed); },
      clip() { return animation.clip(); },
      release: () => {
        if (released) return;
        released = true;
        mixer.stopAllAction();
        mixer.uncacheRoot(scene);
        root.removeFromParent();
        entry.users--;
        this.prune();
      },
    };
  }

  prune() {
    if (this.cache.size <= 3) return;
    const unused = [...this.cache.entries()].filter(([, item]) => item.users === 0)
      .sort((a, b) => a[1].used - b[1].used);
    for (const [id, entry] of unused) {
      if (this.cache.size <= 3) break;
      this.cache.delete(id);
      entry.promise.then(data => {
        const geometries = new Set(), materials = new Set(), textures = new Set();
        data.scene.traverse(node => {
          if (!node.isMesh) return;
          geometries.add(node.geometry);
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            materials.add(material);
            for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
          }
        });
        for (const item of [...geometries, ...materials, ...textures]) item.dispose();
      }).catch(() => {});
    }
  }
}
