import * as THREE from 'three';

type Updatable = {
  update: (dt: number, time: number) => boolean;
  dispose?: () => void;
};

export class AnimationEngine {
  private updatables: Updatable[] = [];
  private lastTime = 0;
  private rafId = 0;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private renderer: THREE.WebGLRenderer
  ) {}

  add(updatable: Updatable): void {
    this.updatables.push(updatable);
  }

  start(): void {
    this.lastTime = performance.now();
    const loop = (time: number) => {
      this.rafId = requestAnimationFrame(loop);
      const dt = Math.min((time - this.lastTime) / 1000, 0.05);
      this.lastTime = time;
      this.tick(dt, time / 1000);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  private tick(dt: number, time: number): void {
    for (let i = this.updatables.length - 1; i >= 0; i--) {
      const alive = this.updatables[i].update(dt, time);
      if (!alive) {
        this.updatables[i].dispose?.();
        this.updatables.splice(i, 1);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
