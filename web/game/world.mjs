import * as THREE from 'three';
import { STAGE_RADIUS } from './physics.mjs';

const horizon = new THREE.Color('#8a7564');

export function createStage(scene) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(88, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      horizon: { value: horizon },
      zenith: { value: new THREE.Color('#202a30') },
      glow: { value: new THREE.Color('#c7966d') },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 horizon;
      uniform vec3 zenith;
      uniform vec3 glow;
      varying vec3 vDirection;
      void main() {
        vec3 ray = normalize(vDirection);
        float elevation = max(ray.y, 0.0);
        vec3 color = mix(horizon, zenith, smoothstep(0.0, 0.62, elevation));
        float facing = max(dot(ray, normalize(vec3(0.08, 0.09, -1.0))), 0.0);
        float haze = smoothstep(0.0, 0.06, elevation) * exp(-elevation * 6.0);
        color += glow * pow(facing, 14.0) * haze * 0.46;
        float sun = smoothstep(0.99948, 0.99964, facing);
        color = mix(color, glow * 1.55, sun * 0.9);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  }));
  sky.renderOrder = -1;
  sky.frustumCulled = false;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.ShaderMaterial({
    uniforms: {
      horizon: { value: horizon },
      slate: { value: new THREE.Color('#454840') },
      paint: { value: new THREE.Color('#bd9b70') },
      radius: { value: STAGE_RADIUS },
      dog: { value: new THREE.Vector3() },
      forward: { value: new THREE.Vector2(0, 1) },
    },
    vertexShader: `
      varying vec2 vGround;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vGround = world.xz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 horizon;
      uniform vec3 slate;
      uniform vec3 paint;
      uniform float radius;
      uniform vec3 dog;
      uniform vec2 forward;
      varying vec2 vGround;

      float line(float distance, float width, float edge) {
        return 1.0 - smoothstep(width, width + edge, abs(distance));
      }

      void main() {
        float range = length(vGround);
        float distance = length(vGround - cameraPosition.xz);
        float edge = max(fwidth(range), 0.004);
        vec2 cell = abs(fract(vGround / 2.0 + 0.5) - 0.5) * 2.0;
        float grid = line(min(cell.x, cell.y), 0.007, edge);
        grid *= 1.0 - smoothstep(13.0, 28.0, distance + edge * 24.0);
        float rings = line(range - 1.35, 0.010, edge) + line(range - 1.5, 0.005, edge);
        float boundary = line(range - radius, 0.055, edge);
        float center = exp(-range * 0.22);
        float grain = fract(sin(dot(floor(vGround * 170.0), vec2(12.9898, 78.233))) * 43758.5453);
        grain *= 1.0 - smoothstep(0.015, 0.05, edge);
        vec3 color = slate * (0.86 + center * 0.36 + grain * 0.09);
        color = mix(color, paint, min(1.0, grid * 0.11 + rings * 0.48 + boundary * 0.68));

        // Elliptical contact shadow in the floor pass.
        vec2 delta = vGround - dog.xz;
        vec2 body = vec2(dot(delta, vec2(forward.y, -forward.x)) * 4.1, dot(delta, forward) * 2.0);
        float shadow = exp(-dot(body, body) * 1.85) * exp(-dog.y * 3.0);
        color *= 1.0 - shadow * 0.61;
        color = mix(color, horizon, smoothstep(10.0, 62.0, distance));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.matrixAutoUpdate = false;
  floor.updateMatrix();
  scene.add(sky, floor);
  return { sky, shadowPosition: floor.material.uniforms.dog.value, shadowForward: floor.material.uniforms.forward.value };
}
