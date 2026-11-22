import * as THREE from 'three';

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  // Reduce DPR and disable antialias for low-end / high-res screens.
  // Re-enable antialias only if you target desktop GPUs and need sharper edges.
  const dpr = Math.min(window.devicePixelRatio, 1.5);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  return renderer;
}
