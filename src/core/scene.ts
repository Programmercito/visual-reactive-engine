import * as THREE from 'three';

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  // Fog adds depth and helps blend the video background with 3D elements.
  scene.fog = new THREE.FogExp2(0x000000, 0.0015);
  return scene;
}
