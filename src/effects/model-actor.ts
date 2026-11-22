import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';

export interface ModelActorOptions {
  asset: string;
  animation?: string;
  duration?: number;
  x?: number;
  y?: number;
}

export class ModelActorEffect {
  public group = new THREE.Group();
  private alive = true;
  private mixer?: THREE.AnimationMixer;

  constructor(
    private scene: THREE.Scene,
    options: ModelActorOptions
  ) {
    this.group.position.set(options.x ?? 0, options.y ?? -4, 1);
    this.group.scale.set(0, 0, 0);
    this.scene.add(this.group);

    const path = `/assets/models/${options.asset}.glb`;
    const loader = new GLTFLoader();
    loader.load(
      path,
      (gltf) => {
        const model = gltf.scene;
        this.group.add(model);

        // Auto-center and scale to fit vertical frame
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 3 / maxDim;
        model.scale.setScalar(scale);
        box.getCenter(model.position).multiplyScalar(-1);

        if (gltf.animations.length) {
          this.mixer = new THREE.AnimationMixer(model);
          const clip = gltf.animations[0];
          const action = this.mixer.clipAction(clip);
          action.play();
        }
      },
      undefined,
      () => {
        // Fallback geometry: a shiny icosahedron labelled with the asset name.
        const geo = new THREE.IcosahedronGeometry(1.2, 1);
        const mat = new THREE.MeshStandardMaterial({
          color: 0xff6b00,
          roughness: 0.3,
          metalness: 0.8,
          emissive: 0x331100,
        });
        const mesh = new THREE.Mesh(geo, mat);
        this.group.add(mesh);
        console.warn(`Model ${path} not found, using fallback geometry.`);
      }
    );

    const duration = options.duration ?? 6;
    const animType = options.animation || 'fly';

    const tl = gsap.timeline({ onComplete: () => (this.alive = false) });
    tl.to(this.group.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(1.7)' });

    if (animType === 'fly') {
      tl.to(this.group.position, {
        y: 4,
        x: 2,
        duration: duration * 0.8,
        ease: 'power1.inOut',
      });
      tl.to(this.group.rotation, {
        z: Math.PI * 0.25,
        duration: duration * 0.8,
      }, '<');
    } else if (animType === 'spin') {
      tl.to(this.group.rotation, {
        y: Math.PI * 4,
        duration,
        ease: 'power1.inOut',
      });
      tl.to(this.group.position, {
        y: 1,
        duration: duration * 0.5,
        yoyo: true,
        repeat: 1,
      }, '<');
    } else {
      tl.to(this.group.position, {
        y: 0,
        duration: duration * 0.5,
        yoyo: true,
        repeat: 1,
      });
    }

    tl.to(this.group.scale, { x: 0, y: 0, z: 0, duration: 0.5, ease: 'back.in(1.7)' });
  }

  update(dt: number): boolean {
    this.mixer?.update(dt);
    return this.alive;
  }

  dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    this.scene.remove(this.group);
  }
}
