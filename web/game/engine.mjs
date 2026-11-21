import * as THREE from 'three';
import { DogAssets } from './assets.mjs';
import { createWorld } from './world.mjs';
import { createResidents } from './residents.mjs';
import { damping, integrateVelocity, movementIntent, moveWithCollisions,
  nearestResident, turnTo, updateStamina } from './physics.mjs';

export class Pawtown {
  constructor(canvas, callbacks = {}) {
    this.callbacks = callbacks;
    this.canvas = canvas;
    this.mode = 'choose'; this.elapsed = 0; this.lastTime = null;
    this.position = new THREE.Vector3(0, 0, 7);
    this.velocity = { x: 0, z: 0 }; this.heading = 0; this.verticalSpeed = 0;
    this.keys = new Set(); this.stick = { x: 0, z: 0 }; this.touchSprint = false;
    this.stamina = 1; this.exhausted = false; this.friends = new Set(); this.treats = 0;
    this.cameraYaw = 0; this.cameraPitch = 0.35; this.cameraDistance = 7;
    this.gestureUntil = 0; this.talkUntil = 0; this.selectionToken = 0;
    this.assets = new DogAssets(); this.ambient = [];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#bfd6d1');
    this.scene.fog = new THREE.Fog('#bfd6d1', 48, 115);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.08, 180);
    this.camera.position.set(3.4, 2.7, 13);
    this.scene.add(new THREE.HemisphereLight('#fff4d8', '#719069', 2.5));
    this.sun = new THREE.DirectionalLight('#fff1ce', 3.0);
    this.sun.position.set(-16, 25, 12); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.world = createWorld(this.scene);
    this.residentSystem = createResidents(this.scene);
    this.player = new THREE.Group(); this.scene.add(this.player);
    this.player.position.copy(this.position);
    this.createTreats(); this.bindInput();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.setMode('paused');
      callbacks.error?.('Thiết bị tạm ngừng hiển thị 3D. Bạn hãy tải lại để tiếp tục.');
    });
    this.renderer.setAnimationLoop(time => this.frame(time));
  }

  resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
    this.camera.aspect = width / Math.max(1, height); this.camera.updateProjectionMatrix();
  }

  async select(dog) {
    const token = ++this.selectionToken;
    this.callbacks.loading?.(true);
    try {
      const actor = await this.assets.acquire(dog);
      if (token !== this.selectionToken) { actor.release(); return false; }
      this.actor?.release(); this.actor = actor; this.dog = dog;
      this.cameraDistance = THREE.MathUtils.clamp(actor.height * 7, 4.5, 7);
      this.player.add(actor.root);
      this.gestureUntil = 0; this.actor.play('Idle');
      this.callbacks.loading?.(false);
      return true;
    } catch (error) {
      if (token === this.selectionToken) {
        this.callbacks.loading?.(false);
        this.callbacks.error?.('Chưa tải được bạn chó này. Hãy thử lại hoặc chọn một bạn khác.');
      }
      console.error(error); return false;
    }
  }

  async addAmbientDogs(dogs) {
    for (const [index, id] of ['labrador', 'corgi'].entries()) {
      const dog = dogs.find(item => item.id === id);
      if (!dog) continue;
      try {
        const actor = await this.assets.acquire(dog);
        actor.root.scale.multiplyScalar(0.8);
        actor.root.traverse(node => { if (node.isMesh) node.castShadow = false; });
        this.scene.add(actor.root); actor.play('Walk');
        this.ambient.push({ actor, index, angle: 0 });
      } catch (error) { console.warn('Ambient dog unavailable', error); }
    }
  }

  createTreats() {
    const points = [[2, 12], [-3, 11], [-9, 5], [9, 4], [-9, -10], [11, -13],
      [-12, 13], [8, 18], [-3, -15], [3, -15], [-14, -13], [14, 0]];
    const material = new THREE.MeshStandardMaterial({ color: '#efc36d', roughness: 0.6, metalness: 0.1 });
    const joint = new THREE.SphereGeometry(0.09, 6, 5);
    this.pickups = points.map(([x, z], index) => {
      const root = new THREE.Group(); root.position.set(x, 0.5, z); this.scene.add(root);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.3, 6), material);
      bar.rotation.z = Math.PI / 2; root.add(bar);
      for (const side of [-1, 1]) for (const end of [-1, 1]) {
        const ball = new THREE.Mesh(joint, material); ball.position.set(side * 0.17, 0, end * 0.065); root.add(ball);
      }
      return { root, x, z, index, collected: false };
    });
  }

  setMode(mode) {
    if (mode === 'playing' && !this.actor) return;
    this.mode = mode; this.keys.clear(); this.stick = { x: 0, z: 0 }; this.touchSprint = false;
    this.velocity.x = 0; this.velocity.z = 0;
    if (mode === 'choose') {
      this.position.set(0, 0, 7); this.heading = 0; this.verticalSpeed = 0;
      this.player.position.copy(this.position); this.player.rotation.y = this.heading;
      this.actor?.play('Idle');
      if (this.actor) this.actor.mixer.timeScale = 1;
    }
    this.callbacks.mode?.(mode);
  }

  jump() {
    if (this.mode === 'playing' && this.position.y < 0.01) this.verticalSpeed = 5.0;
  }
  bark() {
    if (this.mode !== 'playing' || !this.actor || this.gestureUntil > this.elapsed) return;
    this.actor.play('Bark', true);
    this.gestureUntil = this.elapsed + (this.actor.actions.get('Bark')?.getClip().duration || 1.2);
    this.callbacks.toast?.('Gâu gâu! 🐾');
    const nearby = nearestResident(this.position, this.residentSystem.residents, 5);
    if (nearby) this.residentSystem.greet(nearby, this.position);
  }
  interact() {
    if (this.mode !== 'playing') return;
    const resident = nearestResident(this.position, this.residentSystem.residents);
    if (!resident) { this.callbacks.toast?.('Đến gần một cư dân rồi nhấn E để chào nhé.'); return; }
    const isNew = !this.friends.has(resident.id);
    this.friends.add(resident.id);
    this.residentSystem.greet(resident, this.position);
    this.talkUntil = this.elapsed + 5;
    this.callbacks.dialogue?.(resident.name, resident.greeting);
    if (isNew) this.callbacks.toast?.(this.friends.size === 3 ? 'Hoàn thành! Bạn đã làm quen 3 người bạn mới ✨' : `Bạn mới: ${resident.name} ✨`);
  }

  bindInput() {
    const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
    window.addEventListener('keydown', event => {
      if (event.code === 'Escape') {
        if (this.mode === 'playing') this.setMode('paused');
        else if (this.mode === 'paused') this.setMode('playing');
        return;
      }
      if (this.mode !== 'playing') return;
      if (movementKeys.has(event.code) || event.code === 'Space') event.preventDefault();
      this.keys.add(event.code);
      if (event.repeat) return;
      if (event.code === 'Space') this.jump();
      if (event.code === 'KeyB') this.bark();
      if (event.code === 'KeyE') this.interact();
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => { if (this.mode === 'playing') this.setMode('paused'); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'playing') this.setMode('paused');
    });
    let drag = null;
    this.canvas.addEventListener('contextmenu', event => event.preventDefault());
    this.canvas.addEventListener('pointerdown', event => {
      if (this.mode !== 'playing') return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      this.cameraYaw -= (event.clientX - drag.x) * 0.006;
      this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + (event.clientY - drag.y) * 0.004, 0.12, 0.9);
      drag.x = event.clientX; drag.y = event.clientY;
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.canvas.addEventListener(type, () => { drag = null; });
    this.canvas.addEventListener('wheel', event => {
      if (this.mode !== 'playing') return;
      event.preventDefault(); this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance + event.deltaY * 0.008, 4, 12);
    }, { passive: false });
  }

  updatePlayer(dt) {
    const key = (...codes) => codes.some(code => this.keys.has(code)) ? 1 : 0;
    const input = { x: key('KeyD', 'ArrowRight') - key('KeyA', 'ArrowLeft') + this.stick.x,
      z: key('KeyW', 'ArrowUp') - key('KeyS', 'ArrowDown') + this.stick.z };
    const intent = movementIntent(input, this.cameraYaw);
    if (this.stamina < 0.015) this.exhausted = true;
    if (this.stamina > 0.28) this.exhausted = false;
    const sprint = (key('ShiftLeft', 'ShiftRight') || this.touchSprint) && !this.exhausted;
    const speed = this.dog.speed * (sprint ? 1.65 : 1) * intent.strength;
    const x = integrateVelocity(this.velocity.x, intent.x * speed, 10, dt);
    const z = integrateVelocity(this.velocity.z, intent.z * speed, 10, dt);
    this.velocity.x = x.value; this.velocity.z = z.value;
    const colliders = [...this.world.colliders, ...this.residentSystem.residents.map(resident =>
      ({ type: 'circle', x: resident.x, z: resident.z, radius: 0.24 }))];
    const next = moveWithCollisions(this.position, { x: x.distance, z: z.distance }, colliders);
    const actualSpeed = Math.hypot(next.x - this.position.x, next.z - this.position.z) / Math.max(dt, 0.001);
    this.position.x = next.x; this.position.z = next.z;
    if (intent.strength > 0.05) this.heading = turnTo(this.heading, Math.atan2(intent.x, intent.z), 13, dt);
    this.verticalSpeed -= 14 * dt;
    this.position.y = Math.max(0, this.position.y + this.verticalSpeed * dt);
    if (!this.position.y) this.verticalSpeed = 0;
    this.stamina = updateStamina(this.stamina, Boolean(sprint), actualSpeed > 0.15, dt, this.dog.stamina);
    this.player.position.copy(this.position); this.player.rotation.y = this.heading;
    if (actualSpeed > 0.15 || this.gestureUntil <= this.elapsed) {
      this.gestureUntil = 0;
      const clip = actualSpeed > this.dog.speed * 1.2 ? 'Gallop' : actualSpeed > 2.7 ? 'Trot' : actualSpeed > 0.15 ? 'Walk' : 'Idle';
      this.actor.play(clip);
      this.actor.mixer.timeScale = clip === 'Idle' ? 1 : THREE.MathUtils.clamp(actualSpeed / (clip === 'Gallop' ? 5 : clip === 'Trot' ? 3.3 : 1.7), 0.65, 1.6);
    }
    for (const pickup of this.pickups) {
      if (!pickup.collected && Math.hypot(pickup.x - this.position.x, pickup.z - this.position.z) < 0.75) {
        pickup.collected = true; pickup.root.visible = false; this.treats++;
        this.callbacks.toast?.('+1 bánh thưởng ✨');
      }
    }
  }

  updateCamera(dt) {
    const desired = new THREE.Vector3();
    const target = new THREE.Vector3();
    if (this.mode === 'choose') {
      const height = this.actor?.height || 0.72;
      const framing = Math.sqrt(height / 0.72);
      desired.set(1.7 * framing, 0.95 + height * 0.7, 7 + 3.5 * framing);
      target.set(-0.1, height * 0.48, 6.8);
    } else {
      desired.set(this.position.x + Math.sin(this.cameraYaw) * this.cameraDistance,
        1.05 + this.cameraDistance * Math.sin(this.cameraPitch),
        this.position.z + Math.cos(this.cameraYaw) * this.cameraDistance);
      target.set(this.position.x, 0.75 + (this.actor?.height || 0.7) * 0.3, this.position.z);
    }
    this.camera.position.lerp(desired, damping(6, dt));
    this.camera.lookAt(target);
    this.sun.position.set(this.position.x - 16, 25, this.position.z + 12);
    this.sun.target.position.set(this.position.x, 0, this.position.z);
    this.sun.target.updateMatrixWorld();
  }

  frame(time) {
    const dt = this.lastTime === null ? 0.016 : Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    const active = this.mode !== 'paused';
    if (active) this.elapsed += dt;
    if (this.mode === 'playing' && this.actor) this.updatePlayer(dt);
    if (active) {
      this.world.tick(this.elapsed, dt);
      this.residentSystem.tick(dt, this.elapsed, this.position, true);
      this.actor?.mixer.update(dt);
      for (const dog of this.ambient) {
        const t = this.elapsed * 0.13 + dog.index * 1.7;
        const center = dog.index ? -11 : 10;
        const x = center + Math.sin(t) * 1.8, z = (dog.index ? 9 : 1) + Math.cos(t) * 2;
        dog.actor.root.position.set(x, 0, z);
        dog.actor.root.rotation.y = Math.atan2(Math.cos(t), -Math.sin(t));
        dog.actor.mixer.update(dt * 0.65);
      }
      for (const pickup of this.pickups) if (!pickup.collected) {
        pickup.root.rotation.y = this.elapsed * 0.7;
        pickup.root.position.y = 0.45 + Math.sin(this.elapsed * 2 + pickup.index) * 0.07;
      }
    }
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.callbacks.frame?.(this.snapshot(), this.world);
  }

  snapshot() {
    const near = this.mode === 'playing' ? nearestResident(this.position, this.residentSystem.residents) : null;
    return { mode: this.mode, dog: this.dog?.id, x: this.position.x, y: this.position.y, z: this.position.z,
      heading: this.heading, stamina: this.stamina, treats: this.treats, friends: this.friends.size,
      clip: this.actor?.clip(), ready: Boolean(this.actor), near: near?.name || '',
      talking: this.talkUntil > this.elapsed, elapsed: this.elapsed,
      residents: this.residentSystem.residents.map(resident => ({ name: resident.name, x: resident.x, z: resident.z, greeted: this.friends.has(resident.id) })) };
  }
}
