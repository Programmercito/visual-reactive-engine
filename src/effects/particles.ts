import * as THREE from 'three';
import gsap from 'gsap';
import { getMode } from '../config/modes';

export interface ParticleOptions {
  preset: string;
  x?: number;
  y?: number;
  duration?: number;
  mode?: string;
  speedScale?: number;
  minY?: number;
  maxY?: number;
}

export class ParticleEffect {
  public mesh: THREE.Points;
  private alive = true;
  private velocities: THREE.Vector3[] = [];
  private geometry: THREE.BufferGeometry;
  private gravityScale = 1;
  private minY?: number;
  private maxY?: number;

  constructor(
    private scene: THREE.Scene,
    options: ParticleOptions
  ) {
    const mode = getMode(options.mode);
    const speedScale = Math.max(0.1, options.speedScale ?? 1);
    this.gravityScale = speedScale;
    this.minY = options.minY;
    this.maxY = options.maxY;
    // Halved counts to keep frame rate stable on mid-range GPUs.
    const count = options.preset.includes('big') ? 200 : 80;
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const color = new THREE.Color(mode.particleColor);
    const accent = new THREE.Color(mode.accentColor);

    const centerX = options.x ?? 0;
    const centerY = options.y ?? 0;

    for (let i = 0; i < count; i++) {
      positions[i * 3] = centerX;
      positions[i * 3 + 1] = centerY;
      positions[i * 3 + 2] = 2;

      const c = Math.random() > 0.5 ? color : accent;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      sizes[i] = Math.random() * 0.15 + 0.05;

      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 4 + 1) * speedScale;
      const zSpeed = (Math.random() - 0.5) * 2 * speedScale;
      this.velocities.push(
        new THREE.Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed, zSpeed)
      );
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.mesh = new THREE.Points(this.geometry, material);
    this.mesh.position.z = 3;
    this.scene.add(this.mesh);

    gsap.to(material, {
      opacity: 0,
      duration: 0.8,
      delay: (options.duration ?? 2) - 0.8,
      onComplete: () => (this.alive = false),
    });
  }

  update(dt: number): boolean {
    const positions = this.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < this.velocities.length; i++) {
      const v = this.velocities[i];
      positions[i * 3] += v.x * dt;
      const nextY = positions[i * 3 + 1] + v.y * dt;
      if (this.minY !== undefined && nextY < this.minY) {
        positions[i * 3 + 1] = this.minY;
        if (v.y < 0) v.y = 0;
      } else if (this.maxY !== undefined && nextY > this.maxY) {
        positions[i * 3 + 1] = this.maxY;
        if (v.y > 0) v.y = 0;
      } else {
        positions[i * 3 + 1] = nextY;
      }
      positions[i * 3 + 2] += v.z * dt;
      v.y -= 1.5 * this.gravityScale * dt; // gravity
      v.x *= 0.98;
      v.z *= 0.98;
    }
    this.geometry.attributes.position.needsUpdate = true;
    return this.alive;
  }

  dispose(): void {
    const material = this.mesh.material as THREE.PointsMaterial;
    this.geometry.dispose();
    material.dispose();
    this.scene.remove(this.mesh);
  }
}
