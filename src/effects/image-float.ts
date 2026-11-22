import * as THREE from 'three';
import gsap from 'gsap';

export interface ImageFloatOptions {
  image: string;
  duration?: number;
  x?: number;
  y?: number;
  scale?: number;
}

export class ImageFloatEffect {
  public mesh: THREE.Sprite;
  private alive = true;

  constructor(
    private scene: THREE.Scene,
    options: ImageFloatOptions
  ) {
    const loader = new THREE.TextureLoader();
    const texture = loader.load(
      `/assets/images/${options.image}`,
      undefined,
      undefined,
      () => {
        // Fallback: draw a labeled gift box on error.
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#0a0f14';
        ctx.strokeStyle = '#ff6b00';
        ctx.lineWidth = 8;
        ctx.fillRect(0, 0, 256, 256);
        ctx.strokeRect(0, 0, 256, 256);
        ctx.fillStyle = '#f0f4f8';
        ctx.font = 'bold 24px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(options.image, 128, 128);
        const fallback = new THREE.CanvasTexture(canvas);
        fallback.colorSpace = THREE.SRGBColorSpace;
        material.map = fallback;
        material.needsUpdate = true;
      }
    );
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
    });
    this.mesh = new THREE.Sprite(material);

    const baseScale = options.scale ?? 2.5;
    this.mesh.scale.set(baseScale, baseScale, 1);
    this.mesh.position.set(options.x ?? 0, options.y ?? -3, 4);
    this.scene.add(this.mesh);

    const tl = gsap.timeline({ onComplete: () => (this.alive = false) });
    tl.to(material, { opacity: 1, duration: 0.4 });
    tl.to(this.mesh.position, {
      y: (options.y ?? -3) + 4,
      duration: options.duration ?? 4,
      ease: 'power1.out',
    });
    tl.to(material, { opacity: 0, duration: 0.5, delay: -0.5 });
  }

  update(): boolean {
    return this.alive;
  }

  dispose(): void {
    const material = this.mesh.material as THREE.SpriteMaterial;
    material.map?.dispose();
    material.dispose();
    this.scene.remove(this.mesh);
  }
}
