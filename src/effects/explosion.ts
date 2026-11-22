import * as THREE from 'three';
import gsap from 'gsap';
import { ParticleEffect } from './particles';

export interface ExplosionOptions {
  x?: number;
  y?: number;
  preset?: string;
  duration?: number;
  mode?: string;
}

export class ExplosionEffect {
  private alive = true;
  private light?: THREE.PointLight;
  private particles: ParticleEffect;

  constructor(
    private scene: THREE.Scene,
    options: ExplosionOptions
  ) {
    this.light = new THREE.PointLight(0xffaa00, 5, 12);
    this.light.position.set(options.x ?? 0, options.y ?? 0, 4);
    this.scene.add(this.light);

    gsap.to(this.light, {
      intensity: 0,
      duration: options.duration ?? 1.5,
      ease: 'power2.out',
      onComplete: () => {
        this.alive = false;
      },
    });

    this.particles = new ParticleEffect(scene, {
      preset: options.preset || 'gold-explosion',
      x: options.x,
      y: options.y,
      duration: options.duration ?? 1.5,
      mode: options.mode,
    });
  }

  update(dt: number): boolean {
    this.particles.update(dt);
    return this.alive;
  }

  dispose(): void {
    this.particles.dispose();
    if (this.light) {
      this.light.dispose();
      this.scene.remove(this.light);
    }
  }
}
