import * as THREE from 'three';

const VIDEO_PATH = '/assets/videos/background.mp4';

export class VideoBackground {
  public mesh: THREE.Mesh;
  private video: HTMLVideoElement;
  private texture?: THREE.Texture;
  private material: THREE.MeshBasicMaterial;
  private fallback = false;
  private fallbackInterval = 0;

  constructor(private scene: THREE.Scene, private camera: THREE.Camera) {
    this.video = document.createElement('video');
    this.video.loop = true;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.crossOrigin = 'anonymous';
    this.video.src = VIDEO_PATH;

    this.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const geometry = new THREE.PlaneGeometry(1, 1);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.z = -10;
    this.mesh.renderOrder = -1000;
    this.scene.add(this.mesh);

    this.video.addEventListener('error', () => {
      if (this.fallback) return;
      console.warn(`Video ${VIDEO_PATH} not found, using animated gradient fallback.`);
      this.useFallback();
    });

    this.video.addEventListener('canplay', () => {
      if (this.fallback) return;
      this.texture = new THREE.VideoTexture(this.video);
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.material.map = this.texture;
      this.material.needsUpdate = true;
      void this.video.play();
      this.fit();
    });

    this.video.load();
    this.fit();
  }

  private useFallback(): void {
    if (this.fallback) return;
    this.fallback = true;
    this.video.pause();
    this.video.src = '';

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material.map = this.texture;
    this.material.needsUpdate = true;

    let hue = 320;
    // Update at 10 FPS instead of 60 to keep CPU/GPU usage low.
    const draw = () => {
      if (!this.fallback) return;
      hue = (hue + 1) % 360;
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, `hsl(${hue}, 70%, 15%)`);
      gradient.addColorStop(0.5, `hsl(${(hue + 40) % 360}, 60%, 8%)`);
      gradient.addColorStop(1, `hsl(${(hue + 80) % 360}, 70%, 12%)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (this.texture) this.texture.needsUpdate = true;
    };
    draw();
    this.fallbackInterval = window.setInterval(draw, 100);
    this.fit();
  }

  fit(): void {
    const cam = this.camera as THREE.OrthographicCamera;
    const aspect = Math.abs((cam.right - cam.left) / (cam.top - cam.bottom));
    // Fill the camera frustum while preserving 9:16 coverage.
    const targetAspect = 9 / 16;
    let w = cam.right - cam.left;
    let h = cam.top - cam.bottom;
    if (aspect > targetAspect) {
      w = h * targetAspect;
    } else {
      h = w / targetAspect;
    }
    this.mesh.scale.set(w, h, 1);
  }

  dispose(): void {
    this.fallback = false;
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = 0;
    }
    this.video.pause();
    this.video.src = '';
    this.material.dispose();
    if (this.texture) this.texture.dispose();
    this.scene.remove(this.mesh);
  }
}
