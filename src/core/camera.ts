import * as THREE from 'three';

export const VERTICAL_WIDTH = 9;
export const VERTICAL_HEIGHT = 16;

export function createCamera(aspect: number): THREE.OrthographicCamera {
  // Vertical 9:16 framing. The camera frustum scales so content always fits
  // the shortest axis (width on desktop, height on mobile).
  const viewHeight = Math.max(VERTICAL_HEIGHT, VERTICAL_WIDTH / aspect);
  const viewWidth = viewHeight * aspect;

  const camera = new THREE.OrthographicCamera(
    -viewWidth / 2,
    viewWidth / 2,
    viewHeight / 2,
    -viewHeight / 2,
    0.1,
    1000
  );
  camera.position.z = 10;
  return camera;
}

export function updateCameraOnResize(
  camera: THREE.OrthographicCamera,
  aspect: number
): void {
  const viewHeight = Math.max(VERTICAL_HEIGHT, VERTICAL_WIDTH / aspect);
  const viewWidth = viewHeight * aspect;
  camera.left = -viewWidth / 2;
  camera.right = viewWidth / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
}
