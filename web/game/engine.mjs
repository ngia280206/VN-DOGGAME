import * as THREE from 'three';
import { loadDog } from './assets.mjs';
import { damping, integrateVelocity, moveOnStage, movementIntent, turnTo, updateStamina } from './physics.mjs';
import { createStage } from './world.mjs';

const STEP = 1 / 60;
const PREVIEW_INTERVAL = 1000 / 30;
const PREVIEW_HEADING = -0.58;
const LOOK_LIMIT = Math.PI / 2 - 0.06;
const MOVEMENT_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight',
]);
const WALK_SPEED = 3.9;

export class Pawtown {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.mode = 'intro';
    this.view = 'first';
    this.keys = new Set();
    this.stick = { x: 0, z: 0 };
    this.touchSprint = false;
    this.position = new THREE.Vector3();
    this.previousPosition = this.position.clone();
    this.renderPosition = this.position.clone();
    this.cameraTarget = new THREE.Vector3();
    this.cameraRight = new THREE.Vector3();
    this.lastTime = null;
    this.previewTime = -Infinity;
    this.invalidated = true;
    this.reset();

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.045, 110);
    this.camera.rotation.order = 'YXZ';
    this.stage = createStage(this.scene);
    this.scene.add(new THREE.HemisphereLight('#edf4ff', '#a3917c', 2.5));
    const key = new THREE.DirectionalLight('#fff0db', 3.5);
    key.position.set(4, 4, 6);
    const rim = new THREE.DirectionalLight('#ffd4aa', 2.5);
    rim.position.set(-3, 3, -6);
    this.scene.add(key, rim);

    this.bindInput();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.renderer.setAnimationLoop(null);
      this.pause();
      this.callbacks.error('Thiết bị đã mất kết nối với đồ họa 3D. Hãy tải lại trang.');
    });
    this.renderer.setAnimationLoop(time => this.frame(time));
  }

  async load(dog) {
    this.actor = await loadDog(dog);
    this.actor.root.rotation.order = 'YXZ';
    this.scene.add(this.actor.root);
    this.invalidated = true;
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const touch = matchMedia('(pointer: coarse)').matches;
    const pixelBudget = touch ? 900000 : 2500000;
    this.renderer.setDrawingBufferSize(width, height, Math.min(
      window.devicePixelRatio || 1, touch ? 1 : 1.25, Math.sqrt(pixelBudget / (width * height)),
    ));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.invalidated = true;
  }

  reset() {
    this.position.set(0, 0, 0);
    this.previousPosition.copy(this.position);
    this.renderPosition.copy(this.position);
    this.velocityX = 0;
    this.velocityZ = 0;
    this.verticalSpeed = 0;
    this.distanceSpeed = 0;
    this.stamina = 1;
    this.exhausted = false;
    this.sprinting = false;
    this.yaw = 0;
    this.pitch = -0.055;
    this.heading = Math.PI;
    this.accumulator = 0;
    this.staminaPercent = -1;
    this.invalidated = true;
  }

  play(captureMouse = true) {
    if (!this.actor || this.mode === 'playing') return;
    this.mode = 'playing';
    this.invalidated = true;
    this.callbacks.mode(this.mode);
    this.canvas.focus({ preventScroll: true });
    if (captureMouse) this.captureMouse();
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.clearInput();
    this.velocityX = 0;
    this.velocityZ = 0;
    this.sprinting = false;
    this.accumulator = 0;
    this.invalidated = true;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.callbacks.mode(this.mode);
  }

  clearInput() {
    this.keys.clear();
    this.stick.x = 0;
    this.stick.z = 0;
    this.touchSprint = false;
    this.drag = null;
  }

  async captureMouse() {
    if (!this.canvas.requestPointerLock || this.requestingLock || document.pointerLockElement === this.canvas) return;
    this.requestingLock = true;
    try {
      await this.canvas.requestPointerLock();
    } catch {
      // Drag remains available when the browser denies pointer capture.
    } finally {
      this.requestingLock = false;
    }
  }

  toggleView() {
    if (this.mode !== 'playing') return;
    this.view = this.view === 'first' ? 'third' : 'first';
    this.callbacks.view(this.view);
    this.invalidated = true;
  }

  look(dx, dy, sensitivity) {
    const yaw = this.yaw - dx * sensitivity;
    this.yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sensitivity, -LOOK_LIMIT, LOOK_LIMIT);
  }

  jump() {
    if (this.mode !== 'playing' || this.position.y > 0 || this.verticalSpeed > 0) return;
    this.verticalSpeed = 4.6;
  }

  bark() {
    if (this.mode === 'playing' && this.view === 'third') this.actor.animation.play('Bark');
  }

  bindInput() {
    window.addEventListener('keydown', event => {
      if (this.mode !== 'playing') return;
      if (MOVEMENT_KEYS.has(event.code)) {
        event.preventDefault();
        this.keys.add(event.code);
        return;
      }
      if (event.code === 'Space') event.preventDefault();
      if (event.repeat) return;
      if (event.code === 'Escape') this.pause();
      if (event.code === 'Space') this.jump();
      if (event.code === 'KeyV') this.toggleView();
      if (event.code === 'KeyB') this.bark();
      if (event.code === 'KeyR') this.reset();
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.pause());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); });

    let locked = false;
    document.addEventListener('pointerlockchange', () => {
      const previouslyLocked = locked;
      locked = document.pointerLockElement === this.canvas;
      if (locked && this.mode !== 'playing') document.exitPointerLock();
      if (locked) this.drag = null;
      if (previouslyLocked && !locked) this.pause();
      this.callbacks.capture(locked);
    });
    document.addEventListener('mousemove', event => {
      if (locked && this.mode === 'playing') this.look(event.movementX, event.movementY, 0.0022);
    });
    this.canvas.addEventListener('pointerdown', event => {
      if (this.mode !== 'playing' || locked || this.drag || event.button !== 0) return;
      this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove', event => {
      if (this.mode !== 'playing' || this.drag?.id !== event.pointerId) return;
      this.look(event.clientX - this.drag.x, event.clientY - this.drag.y, 0.005);
      this.drag.x = event.clientX;
      this.drag.y = event.clientY;
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.canvas.addEventListener(type, event => {
        if (this.drag?.id === event.pointerId) this.drag = null;
      });
    }
  }

  updateMovement(dt) {
    const keys = this.keys;
    const intent = movementIntent({
      x: Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + this.stick.x,
      z: Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) + this.stick.z,
    }, this.yaw);
    if (this.stamina < 0.015) this.exhausted = true;
    if (this.stamina > 0.28) this.exhausted = false;
    const running = !this.exhausted && (this.touchSprint || keys.has('ShiftLeft') || keys.has('ShiftRight'));
    const speed = WALK_SPEED * (running ? 1.65 : 1) * intent.strength;

    this.previousPosition.copy(this.position);
    const x = integrateVelocity(this.velocityX, intent.x * speed, 12, dt);
    const z = integrateVelocity(this.velocityZ, intent.z * speed, 12, dt);
    this.velocityX = x.value;
    this.velocityZ = z.value;
    moveOnStage(this.position, x.distance, z.distance);
    const movedX = this.position.x - this.previousPosition.x;
    const movedZ = this.position.z - this.previousPosition.z;
    this.distanceSpeed = Math.hypot(movedX, movedZ) / dt;
    this.sprinting = running && intent.strength > 0.1 && this.distanceSpeed > 0.15;
    this.stamina = updateStamina(this.stamina, this.sprinting, this.distanceSpeed > 0.15, dt, 1.2);
    if (this.distanceSpeed > 0.15) this.heading = turnTo(this.heading, Math.atan2(movedX, movedZ), 14, dt);

    if (this.verticalSpeed || this.position.y > 0) {
      this.verticalSpeed -= 15 * dt;
      this.position.y = Math.max(0, this.position.y + this.verticalSpeed * dt);
      if (!this.position.y) this.verticalSpeed = 0;
    }
  }

  updateCamera(dt) {
    const camera = this.camera;
    const position = this.renderPosition;
    const height = this.actor?.height ?? 0.66;
    let desiredFov;
    if (this.mode === 'intro') {
      camera.position.set(1.28, 0.79, 2.4);
      camera.lookAt(0, camera.aspect < 1 ? 0.15 : 0.4, 0);
      if (camera.aspect > 1.12) {
        this.cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
        camera.position.addScaledVector(this.cameraRight, -0.33 * Math.min(camera.aspect, 2.4));
      }
      desiredFov = camera.aspect < 0.85
        ? Math.max(43, THREE.MathUtils.radToDeg(2 * Math.atan(0.15 / camera.aspect))) : 35;
    } else if (this.view === 'first') {
      camera.position.set(position.x, position.y + height * 0.87, position.z);
      camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      desiredFov = this.sprinting ? 74 : 68;
    } else {
      const pitch = THREE.MathUtils.clamp(0.23 - this.pitch, 0.06, 0.74);
      const range = 2.75;
      const distance = Math.cos(pitch) * range;
      this.cameraTarget.set(position.x, position.y + height * 0.58, position.z);
      camera.position.set(position.x + Math.sin(this.yaw) * distance,
        this.cameraTarget.y + Math.sin(pitch) * range, position.z + Math.cos(this.yaw) * distance);
      camera.lookAt(this.cameraTarget);
      desiredFov = 56;
    }
    const fov = this.invalidated ? desiredFov : THREE.MathUtils.lerp(camera.fov, desiredFov, damping(12, dt));
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    this.stage.sky.position.copy(camera.position);
  }

  frame(time) {
    if (this.mode === 'paused' && !this.invalidated) {
      this.lastTime = null;
      return;
    }
    if (this.mode === 'intro' && !this.invalidated && time - this.previewTime < PREVIEW_INTERVAL - 0.5) return;
    const dt = this.lastTime === null ? STEP : Math.min(0.1, (time - this.lastTime) / 1000);
    this.lastTime = time;

    if (this.mode === 'playing') {
      this.accumulator += dt;
      while (this.accumulator >= STEP) {
        this.updateMovement(STEP);
        this.accumulator -= STEP;
      }
      this.renderPosition.lerpVectors(this.previousPosition, this.position, this.accumulator / STEP);
      const stamina = Math.round(this.stamina * 100);
      if (stamina !== this.staminaPercent) {
        this.staminaPercent = stamina;
        this.callbacks.stamina(stamina);
      }
    }
    if (this.mode === 'intro') this.previewTime = time;

    const heading = this.mode === 'intro' ? PREVIEW_HEADING : this.heading;
    if (this.actor) {
      this.actor.root.visible = this.mode === 'intro' || this.view === 'third';
      if (this.actor.root.visible) {
        this.actor.root.position.copy(this.renderPosition);
        this.actor.root.rotation.y = heading;
        if (this.mode !== 'paused') {
          const tilt = THREE.MathUtils.clamp(-this.verticalSpeed * 0.045, -0.22, 0.22);
          this.actor.root.rotation.x = THREE.MathUtils.lerp(this.actor.root.rotation.x, tilt, damping(16, dt));
          this.actor.animation.update(dt, this.distanceSpeed);
        }
      }
    }
    this.stage.shadowPosition.copy(this.renderPosition);
    this.stage.shadowForward.set(Math.sin(heading), Math.cos(heading));
    this.updateCamera(dt);
    this.invalidated = false;
    this.renderer.render(this.scene, this.camera);
  }
}
