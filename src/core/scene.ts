import * as THREE from 'three';

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  // Keep the background transparent so the page behind the canvas is visible.
  // Fog adds depth and helps blend 3D elements.
  scene.fog = new THREE.FogExp2(0x000000, 0.0015);
  return scene;
}
