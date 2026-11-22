import * as THREE from 'three';
import gsap from 'gsap';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { getMode } from '../config/modes';
import { getFont } from './text-font';

export interface TextEffectOptions {
  text: string;
  mode?: string;
  duration?: number;
  x?: number;
  y?: number;
  onComplete?: () => void;
}

const FONT_SIZE = 0.58;
const LINE_HEIGHT = FONT_SIZE * 1.4;
const TEXT_DEPTH = 0.38;
const MAX_CHARS_PER_LINE = 14;
const SAFE_WIDTH = 7;
const SAFE_HEIGHT = 8.2;
const HALF_FRAME_WIDTH = 4.5;
const HALF_FRAME_HEIGHT = 8;

// One vivid, readable color per whole message; deliberately no pink or purple.
const TEXT_COLORS = [0x0878d1, 0x008b9a, 0x218838, 0xe05a00, 0x008577, 0x315acb, 0x006fae];
const SPARK_COLORS = [0xffffff, 0xffe600, 0x00dcff, 0x72ff25, 0xff7900, 0x38f2c1];
let previousTextColor: number | undefined;

function wrapLines(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';

  for (const rawWord of text.split(/\s+/)) {
    const chunks = rawWord.match(new RegExp(`.{1,${maxChars}}`, 'g')) ?? [rawWord];
    for (const word of chunks) {
      if (line && `${line} ${word}`.length > maxChars) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
  }

  if (line) lines.push(line);
  return lines;
}

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function nextTextColor(): number {
  const choices = TEXT_COLORS.filter((color) => color !== previousTextColor);
  previousTextColor = randomFrom(choices);
  return previousTextColor;
}

/** Conservative vertical reservation used by TextQueue to avoid overlapping messages. */
export function estimateTextHeight(text: string): number {
  return Math.min(SAFE_HEIGHT, wrapLines(text.trim(), MAX_CHARS_PER_LINE).length * LINE_HEIGHT) + 0.7;
}

type AnimatedInstance = {
  mesh: THREE.InstancedMesh;
  index: number;
  transform: THREE.Object3D;
  target?: THREE.Vector3;
  delay?: number;
  color?: THREE.Color;
};

export class TextEffect {
  public group = new THREE.Group();

  private alive = true;
  private timeline?: gsap.core.Timeline;
  private readonly tweens: gsap.core.Animation[] = [];
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly rocket = new THREE.Group();
  private readonly fireworks = new THREE.Group();
  private readonly textGroup = new THREE.Group();
  private readonly particles: AnimatedInstance[] = [];
  private readonly glints: AnimatedInstance[] = [];
  private readonly rings: THREE.Mesh[] = [];
  private streakGeometry?: THREE.BufferGeometry;
  private streakMaterial?: THREE.LineBasicMaterial;
  private glintMaterial?: THREE.MeshBasicMaterial;
  private textFaceMaterial?: THREE.MeshPhysicalMaterial;
  private textFitScale = 1;

  constructor(
    private scene: THREE.Scene,
    private options: TextEffectOptions
  ) {
    const mode = getMode(options.mode);
    // Position varies for every message; short messages can use a wider x range.
    this.group.position.set(0, options.y ?? (Math.random() * 3.2 - 1.6), 0);
    this.group.add(this.rocket, this.fireworks, this.textGroup);
    this.scene.add(this.group);

    this.createRocket(mode.accentColor);
    this.createFireworks();

    // Measure first. GSAP starts only after layout is known, so the text cannot overflow.
    getFont((font) => {
      if (!this.alive) return;

      const lines = wrapLines(options.text.trim(), MAX_CHARS_PER_LINE);
      const geometries = lines.map((line) => {
        const geometry = new TextGeometry(line, {
          font,
          size: FONT_SIZE,
          depth: TEXT_DEPTH,
          curveSegments: 5,
          bevelEnabled: true,
          bevelThickness: 0.04,
          bevelSize: 0.03,
          bevelSegments: 4,
        });
        geometry.computeBoundingBox();
        return geometry;
      });

      const widths = geometries.map((geometry) => {
        const bounds = geometry.boundingBox!;
        return bounds.max.x - bounds.min.x;
      });
      const width = Math.max(0, ...widths);
      const height = Math.max(FONT_SIZE, lines.length * LINE_HEIGHT);
      const fitScale = Math.min(1, SAFE_WIDTH / width, SAFE_HEIGHT / height);
      const fittedWidth = width * fitScale;
      const fittedHeight = height * fitScale;
      const minX = -HALF_FRAME_WIDTH + fittedWidth / 2 + 0.55;
      const maxX = HALF_FRAME_WIDTH - fittedWidth / 2 - 0.55;
      const minY = -HALF_FRAME_HEIGHT + fittedHeight / 2 + 0.55;
      const maxY = HALF_FRAME_HEIGHT - fittedHeight / 2 - 0.55;

      this.group.position.x = THREE.MathUtils.clamp(
        this.options.x ?? (minX + Math.random() * Math.max(0, maxX - minX)),
        minX,
        maxX
      );
      this.group.position.y = THREE.MathUtils.clamp(this.group.position.y, minY, maxY);
      this.rocket.position.y = -HALF_FRAME_HEIGHT + 0.65 - this.group.position.y;

      const faceColor = new THREE.Color(nextTextColor());
      const sideColor = faceColor.clone().offsetHSL(0, 0.08, -0.16);
      const faceMaterial = new THREE.MeshPhysicalMaterial({
        color: faceColor,
        emissive: faceColor,
        emissiveIntensity: 0.32,
        metalness: 0.16,
        roughness: 0.24,
        clearcoat: 0.9,
        clearcoatRoughness: 0.16,
      });
      const sideMaterial = new THREE.MeshStandardMaterial({
        color: sideColor,
        emissive: sideColor,
        emissiveIntensity: 0.28,
        metalness: 0.35,
        roughness: 0.26,
      });
      this.materials.add(faceMaterial);
      this.materials.add(sideMaterial);
      this.textFaceMaterial = faceMaterial;

      geometries.forEach((geometry, index) => {
        geometry.center();
        this.geometries.add(geometry);

        const mesh = new THREE.Mesh(geometry, [faceMaterial, sideMaterial]);
        const finalY = ((lines.length - 1) / 2 - index) * LINE_HEIGHT;
        mesh.position.set(
          (Math.random() - 0.5) * 1.4,
          finalY + (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 1.2
        );
        mesh.scale.setScalar(0.01);
        mesh.rotation.set(
          (Math.random() - 0.5) * 1.1,
          (Math.random() - 0.5) * 1.6,
          (Math.random() - 0.5) * 0.25
        );
        mesh.userData.finalPosition = new THREE.Vector3(0, finalY, 0);
        mesh.userData.isTextLine = true;
        this.textGroup.add(mesh);
      });

      this.textGroup.scale.setScalar(fitScale);
      this.textFitScale = fitScale;
      this.createGlints(width + 0.7, height + 0.45, fitScale);
      this.playSequence(options.duration ?? 4);
    });
  }

  private createRocket(accentColor: string): void {
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x1677d2, metalness: 0.5, roughness: 0.25 });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.7,
      metalness: 0.35,
      roughness: 0.24,
    });
    const flameMaterial = new THREE.MeshBasicMaterial({ color: 0xffa928 });
    this.materials.add(bodyMaterial);
    this.materials.add(accentMaterial);
    this.materials.add(flameMaterial);

    const bodyGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 10);
    const noseGeometry = new THREE.ConeGeometry(0.1, 0.25, 10);
    const flameGeometry = new THREE.ConeGeometry(0.08, 0.35, 8);
    this.geometries.add(bodyGeometry);
    this.geometries.add(noseGeometry);
    this.geometries.add(flameGeometry);

    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    const nose = new THREE.Mesh(noseGeometry, accentMaterial);
    nose.position.y = 0.37;
    const flame = new THREE.Mesh(flameGeometry, flameMaterial);
    flame.position.y = -0.42;
    flame.rotation.z = Math.PI;
    this.rocket.add(body, nose, flame);
    this.rocket.userData.flame = flame;
    this.rocket.position.set(0, -HALF_FRAME_HEIGHT + 0.65, 2);
    this.rocket.scale.setScalar(1.35);
  }

  private createFireworks(): void {
    // Use smooth 3D spheres and radial trails, not angular confetti/diamond shapes.
    const geometry = new THREE.SphereGeometry(0.065, 8, 6);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
    const mesh = new THREE.InstancedMesh(geometry, material, 84);
    mesh.frustumCulled = false;
    this.geometries.add(geometry);
    this.materials.add(material);
    this.fireworks.add(mesh);

    const streakPositions = new Float32Array(84 * 2 * 3);
    const streakColors = new Float32Array(84 * 2 * 3);
    this.streakGeometry = new THREE.BufferGeometry();
    this.streakGeometry.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
    this.streakGeometry.setAttribute('color', new THREE.BufferAttribute(streakColors, 3));
    this.streakMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.geometries.add(this.streakGeometry);
    this.materials.add(this.streakMaterial);
    const streaks = new THREE.LineSegments(this.streakGeometry, this.streakMaterial);
    streaks.frustumCulled = false;
    this.fireworks.add(streaks);

    for (let index = 0; index < 84; index++) {
      const transform = new THREE.Object3D();
      transform.scale.setScalar(0.001);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);

      const color = new THREE.Color(randomFrom(SPARK_COLORS));
      mesh.setColorAt(index, color);
      const colorOffset = index * 6;
      for (let vertex = 0; vertex < 2; vertex++) {
        streakColors[colorOffset + vertex * 3] = color.r;
        streakColors[colorOffset + vertex * 3 + 1] = color.g;
        streakColors[colorOffset + vertex * 3 + 2] = color.b;
      }

      const angle = Math.random() * Math.PI * 2;
      const fraction = 0.68 + Math.random() * 0.32;
      this.particles.push({
        mesh,
        index,
        transform,
        target: new THREE.Vector3(
          Math.cos(angle) * 3.1 * fraction,
          Math.sin(angle) * 2.8 * fraction,
          (Math.random() - 0.5) * 2.2
        ),
        delay: Math.floor(index / 28) * 0.15,
      });
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.streakGeometry.attributes.color.needsUpdate = true;

    for (let index = 0; index < 3; index++) {
      const geometry = new THREE.TorusGeometry(1, 0.025, 7, 64);
      const material = new THREE.MeshBasicMaterial({
        color: SPARK_COLORS[index + 1],
        transparent: true,
        opacity: 0,
      });
      this.geometries.add(geometry);
      this.materials.add(material);
      const ring = new THREE.Mesh(geometry, material);
      ring.scale.setScalar(0.001);
      ring.rotation.set((index - 1) * 0.35, (index - 1) * 0.42, 0);
      ring.userData.shellDelay = index * 0.16;
      this.fireworks.add(ring);
      this.rings.push(ring);
    }
  }

  private createGlints(width: number, height: number, fitScale: number): void {
    const geometry = new THREE.SphereGeometry(0.055, 8, 6);
    this.geometries.add(geometry);

    this.glintMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0,
    });
    this.materials.add(this.glintMaterial);
    const mesh = new THREE.InstancedMesh(geometry, this.glintMaterial, 14);
    mesh.frustumCulled = false;
    this.textGroup.add(mesh);

    const halfWidth = (width / 2 + 0.3) * fitScale;
    const halfHeight = (height / 2 + 0.2) * fitScale;
    for (let index = 0; index < 14; index++) {
      const transform = new THREE.Object3D();
      const edge = index % 4;
      if (edge === 0 || edge === 2) {
        transform.position.set(
          (Math.random() * 2 - 1) * halfWidth,
          edge === 0 ? halfHeight : -halfHeight,
          0.2
        );
      } else {
        transform.position.set(
          edge === 1 ? halfWidth : -halfWidth,
          (Math.random() * 2 - 1) * halfHeight,
          0.2
        );
      }
      transform.scale.setScalar(0.001);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, new THREE.Color(randomFrom(SPARK_COLORS)));
      this.glints.push({ mesh, index, transform });
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  private playSequence(holdDuration: number): void {
    const flame = this.rocket.userData.flame as THREE.Mesh;
    const lines = this.textGroup.children.filter(
      (child) => child.userData.isTextLine
    ) as THREE.Mesh[];
    this.timeline = gsap.timeline({
      onComplete: () => {
        this.alive = false;
        this.options.onComplete?.();
      },
    });

    this.timeline.to(this.rocket.position, { y: 0, duration: 0.8, ease: 'power3.in' });
    this.timeline.to(flame.scale, {
      x: 1.45,
      y: 1.6,
      duration: 0.16,
      yoyo: true,
      repeat: 2,
      ease: 'sine.inOut',
    }, '<');
    this.timeline.call(() => {
      this.rocket.visible = false;
      this.burst();
      this.textGroup.scale.setScalar(this.textFitScale * 0.78);
      this.formText(lines);
      this.startGlitter();
    }, undefined, '+=0.02');

    const formationDuration = 1.2 + Math.max(0, lines.length - 1) * 0.12;
    this.timeline.to({}, { duration: formationDuration });
    this.timeline.to({}, { duration: holdDuration });
    const breathingDuration = Math.max(0.2, holdDuration / 2);
    this.timeline.to(this.textGroup.position, {
      y: 0.14,
      duration: breathingDuration,
      yoyo: true,
      repeat: 1,
      ease: 'sine.inOut',
    }, '<');
    this.timeline.to(this.textGroup.rotation, {
      y: 0.14,
      z: 0.025,
      duration: breathingDuration,
      yoyo: true,
      repeat: 1,
      ease: 'sine.inOut',
    }, '<');
    this.timeline.to(this.textGroup.scale, {
      x: this.textFitScale * 1.018,
      y: this.textFitScale * 1.018,
      z: this.textFitScale * 1.018,
      duration: breathingDuration,
      yoyo: true,
      repeat: 1,
      ease: 'sine.inOut',
    }, '<');
    if (this.textFaceMaterial) {
      this.timeline.to(this.textFaceMaterial, {
        emissiveIntensity: 0.48,
        duration: breathingDuration,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut',
      }, '<');
    }
    this.timeline.call(() => this.stopGlitter());
    this.timeline.to(this.glintMaterial!, { opacity: 0, duration: 0.2 });
    this.timeline.to(this.textGroup.scale, {
      x: 0.01,
      y: 0.01,
      z: 0.01,
      duration: 0.35,
      ease: 'power2.in',
    });
  }

  private burst(): void {
    if (this.streakMaterial) {
      this.streakMaterial.opacity = 0.88;
      this.tweens.push(gsap.to(this.streakMaterial, {
        opacity: 0,
        duration: 0.65,
        delay: 1.05,
      }));
    }

    for (const particle of this.particles) {
      const target = particle.target!;
      const delay = particle.delay!;
      target.x = THREE.MathUtils.clamp(
        target.x,
        -HALF_FRAME_WIDTH + 0.3 - this.group.position.x,
        HALF_FRAME_WIDTH - 0.3 - this.group.position.x
      );
      target.y = THREE.MathUtils.clamp(
        target.y,
        -HALF_FRAME_HEIGHT + 0.3 - this.group.position.y,
        HALF_FRAME_HEIGHT - 0.3 - this.group.position.y
      );
      this.tweens.push(gsap.to(particle.transform.position, {
        x: target.x,
        y: target.y,
        z: target.z,
        duration: 0.95,
        delay,
        ease: 'power2.out',
      }));
      const pop = gsap.timeline({ delay });
      pop.to(particle.transform.scale, {
        x: 1.15, y: 1.15, z: 1.15, duration: 0.28, ease: 'back.out(2)',
      }).to(particle.transform.scale, {
        x: 0.001, y: 0.001, z: 0.001, duration: 0.55, ease: 'power2.in',
      }, '+=0.72');
      this.tweens.push(pop);
    }

    for (const ring of this.rings) {
      const material = ring.material as THREE.MeshBasicMaterial;
      const delay = ring.userData.shellDelay as number;
      const radiusX = Math.max(0.1, Math.min(3.4, HALF_FRAME_WIDTH - Math.abs(this.group.position.x) - 0.35));
      const radiusY = Math.max(0.1, Math.min(3.5, HALF_FRAME_HEIGHT - Math.abs(this.group.position.y) - 0.35));
      material.opacity = 0.95;
      this.tweens.push(gsap.to(ring.scale, {
        x: radiusX,
        y: radiusY,
        z: 1,
        duration: 1.1,
        delay,
        ease: 'power2.out',
      }));
      this.tweens.push(gsap.to(material, {
        opacity: 0,
        duration: 0.6,
        delay: delay + 0.55,
      }));
    }
  }

  private formText(lines: THREE.Mesh[]): void {
    this.tweens.push(gsap.to(this.textGroup.scale, {
      x: this.textFitScale,
      y: this.textFitScale,
      z: this.textFitScale,
      duration: 0.8,
      ease: 'back.out(1.35)',
    }));

    lines.forEach((mesh, index) => {
      const target = mesh.userData.finalPosition as THREE.Vector3;
      const delay = index * 0.12;
      this.tweens.push(gsap.to(mesh.position, {
        x: target.x,
        y: target.y,
        z: target.z,
        duration: 0.75,
        delay,
        ease: 'back.out(1.5)',
      }));
      this.tweens.push(gsap.to(mesh.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.62,
        delay,
        ease: 'back.out(1.7)',
      }));
      this.tweens.push(gsap.to(mesh.rotation, {
        x: -0.1,
        y: -0.46,
        z: 0,
        duration: 0.72,
        delay,
        ease: 'power2.out',
      }));
    });
  }

  private startGlitter(): void {
    if (this.glintMaterial) {
      this.tweens.push(gsap.to(this.glintMaterial, {
        opacity: 1,
        duration: 0.2,
      }));
    }

    for (const glint of this.glints) {
      const baseY = glint.transform.position.y;
      const baseX = glint.transform.position.x;
      this.tweens.push(gsap.to(glint.transform.scale, {
        x: 0.7 + Math.random() * 0.8,
        y: 0.7 + Math.random() * 0.8,
        z: 0.7 + Math.random() * 0.8,
        duration: 0.35 + Math.random() * 0.4,
        repeat: -1,
        yoyo: true,
        delay: Math.random() * 0.5,
        ease: 'sine.inOut',
      }));
      this.tweens.push(gsap.to(glint.transform.position, {
        x: baseX + (Math.random() - 0.5) * 0.2,
        y: baseY + (Math.random() - 0.5) * 0.3,
        duration: 0.5 + Math.random() * 0.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      }));
    }
  }

  private stopGlitter(): void {
    this.tweens.forEach((tween) => tween.kill());
    this.tweens.length = 0;
  }

  update(): boolean {
    const updatedMeshes = new Set<THREE.InstancedMesh>();
    for (const instance of [...this.particles, ...this.glints]) {
      instance.transform.updateMatrix();
      instance.mesh.setMatrixAt(instance.index, instance.transform.matrix);
      updatedMeshes.add(instance.mesh);

      if (instance.target && this.streakGeometry) {
        const positions = this.streakGeometry.attributes.position.array as Float32Array;
        const p = instance.transform.position;
        const length = Math.hypot(p.x, p.y, p.z) || 1;
        const offset = instance.index * 6;
        positions[offset] = p.x;
        positions[offset + 1] = p.y;
        positions[offset + 2] = p.z;
        positions[offset + 3] = p.x - (p.x / length) * 0.32;
        positions[offset + 4] = p.y - (p.y / length) * 0.32;
        positions[offset + 5] = p.z - (p.z / length) * 0.32;
      }
    }
    updatedMeshes.forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
    });
    if (this.streakGeometry) {
      this.streakGeometry.attributes.position.needsUpdate = true;
    }
    return this.alive;
  }

  dispose(): void {
    this.alive = false;
    this.timeline?.kill();
    this.stopGlitter();
    this.group.traverse((child) => gsap.killTweensOf(child));
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.scene.remove(this.group);
  }
}
