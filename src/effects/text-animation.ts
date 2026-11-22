import * as THREE from 'three';
import gsap from 'gsap';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { getFont } from './text-font';

export interface TextEffectOptions {
  text: string;
  sender?: string;
  mode?: string;
  duration?: number;
  x?: number;
  y?: number;
  onComplete?: () => void;
}

const FONT_SIZE = 0.58;
const LINE_HEIGHT = FONT_SIZE * 1.4;
const SENDER_FONT_SIZE = 0.34;
const SENDER_LINE_HEIGHT = SENDER_FONT_SIZE * 1.4;
const SENDER_GAP = 0.14;
const TEXT_DEPTH = 0.24;
const MAX_CHARS_PER_LINE = 14;
const SAFE_WIDTH = 7;
const SAFE_HEIGHT = 8.2;
const HALF_FRAME_WIDTH = 4.5;
const HALF_FRAME_HEIGHT = 8;

// One vivid, readable color per whole message; deliberately no pink or purple.
const TEXT_COLORS = [0x0878d1, 0x008b9a, 0x218838, 0xe05a00, 0x008577, 0x315acb, 0x006fae];
type FireworkPalette = {
  primary: number;
  secondary: number;
  accent: number;
  core: number;
};

const FIREWORK_PALETTES: FireworkPalette[] = [
  { primary: 0xff8a00, secondary: 0xffdf75, accent: 0xffffff, core: 0xfff4c2 },
  { primary: 0x12b8e8, secondary: 0x60e9ff, accent: 0xffffff, core: 0xe9fdff },
  { primary: 0x35bd68, secondary: 0xb6f36b, accent: 0xffffff, core: 0xf4ffd8 },
  { primary: 0x1683ff, secondary: 0x75caff, accent: 0xffffff, core: 0xe8f5ff },
  { primary: 0xffbd00, secondary: 0xff7a00, accent: 0xffffff, core: 0xfff2a8 },
];

type FireworkStyle = 'chrysanthemum' | 'ring' | 'willow';

let previousTextColor: number | undefined;
let previousPaletteIndex = -1;

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

function nextFireworkPalette(): FireworkPalette {
  const choices = FIREWORK_PALETTES
    .map((palette, index) => ({ palette, index }))
    .filter(({ index }) => index !== previousPaletteIndex);
  const chosen = randomFrom(choices);
  previousPaletteIndex = chosen.index;
  return chosen.palette;
}

/** Conservative vertical reservation used by TextQueue to avoid overlapping messages. */
export function estimateTextHeight(text: string, sender = ''): number {
  const bodyHeight = wrapLines(text.trim(), MAX_CHARS_PER_LINE).length * LINE_HEIGHT;
  const senderLineCount = sender.trim()
    ? wrapLines(`${sender.trim().slice(0, 64)}:`, 24).length
    : 0;
  const senderHeight = senderLineCount ? senderLineCount * SENDER_LINE_HEIGHT + SENDER_GAP : 0;
  return Math.min(SAFE_HEIGHT, bodyHeight + senderHeight) + 0.7;
}

type AnimatedInstance = {
  mesh: THREE.InstancedMesh;
  index: number;
  transform: THREE.Object3D;
  target?: THREE.Vector3;
  delay?: number;
  color?: THREE.Color;
  velocity?: THREE.Vector3;
  life?: number;
  maxLife?: number;
  active?: boolean;
  baseScale?: number;
  age?: number;
  gravity?: number;
  previousPosition?: THREE.Vector3;
  started?: boolean;
};

type FireworkParticle = {
  index: number;
  color: THREE.Color;
  targetVelocity: THREE.Vector3;
  velocity: THREE.Vector3;
  delay: number;
  delayRemaining: number;
  age: number;
  life: number;
  gravity: number;
  active: boolean;
  started: boolean;
  position: THREE.Vector3;
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
  private readonly particles: FireworkParticle[] = [];
  private readonly glints: AnimatedInstance[] = [];
  private burstFlash?: THREE.PointLight;
  private streakGeometry?: THREE.BufferGeometry;
  private streakMaterial?: THREE.LineBasicMaterial;
  private glintMaterial?: THREE.MeshBasicMaterial;
  private readonly palette: FireworkPalette;
  private readonly fireworkStyle: FireworkStyle;
  private readonly directionScratch = new THREE.Vector3();

  constructor(
    private scene: THREE.Scene,
    private options: TextEffectOptions
  ) {
    this.palette = nextFireworkPalette();
    this.fireworkStyle = randomFrom<FireworkStyle>(['chrysanthemum', 'ring', 'willow']);
    // Position varies for every message; short messages can use a wider x range.
    this.group.position.set(0, options.y ?? (Math.random() * 3.2 - 1.6), 0);
    this.group.add(this.rocket, this.fireworks, this.textGroup);
    this.scene.add(this.group);

    this.createRocket(this.palette.primary);
    this.createFireworks();

    // Measure first. GSAP starts only after layout is known, so the text cannot overflow.
    getFont((font) => {
      if (!this.alive) return;

      const bodyLines = wrapLines(options.text.trim(), MAX_CHARS_PER_LINE);
      const sender = options.sender?.trim().slice(0, 64);
      const senderLines = sender ? wrapLines(`${sender}:`, 24) : [];
      const makeGeometries = (lines: string[], size: number) => lines.map((line) => {
        const geometry = new TextGeometry(line, {
          font,
          size,
          depth: TEXT_DEPTH * (size / FONT_SIZE),
          curveSegments: 5,
          bevelEnabled: true,
          bevelThickness: 0.025 * (size / FONT_SIZE),
          bevelSize: 0.018 * (size / FONT_SIZE),
          bevelSegments: 2,
        });
        geometry.computeBoundingBox();
        return geometry;
      });
      const senderGeometries = makeGeometries(senderLines, SENDER_FONT_SIZE);
      const bodyGeometries = makeGeometries(bodyLines, FONT_SIZE);
      const geometries = [...senderGeometries, ...bodyGeometries];

      const widths = geometries.map((geometry) => {
        const bounds = geometry.boundingBox!;
        return bounds.max.x - bounds.min.x;
      });
      const width = Math.max(0, ...widths);
      const bodyHeight = Math.max(FONT_SIZE, bodyLines.length * LINE_HEIGHT);
      const senderHeight = senderLines.length * SENDER_LINE_HEIGHT;
      const height = bodyHeight + (senderLines.length ? senderHeight + SENDER_GAP : 0);
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
        emissiveIntensity: 0.22,
        metalness: 0.12,
        roughness: 0.3,
        clearcoat: 0.55,
        clearcoatRoughness: 0.24,
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

      const addTextLine = (geometry: TextGeometry, finalY: number) => {
        geometry.center();
        this.geometries.add(geometry);

        const mesh = new THREE.Mesh(geometry, [faceMaterial, sideMaterial]);
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
      };

      const blockTop = height / 2;
      senderGeometries.forEach((geometry, index) => {
        const finalY = blockTop - SENDER_LINE_HEIGHT / 2 - index * SENDER_LINE_HEIGHT;
        addTextLine(geometry, finalY);
      });
      const bodyTop = blockTop - senderHeight - (senderLines.length ? SENDER_GAP : 0);
      bodyGeometries.forEach((geometry, index) => {
        const finalY = bodyTop - LINE_HEIGHT / 2 - index * LINE_HEIGHT;
        addTextLine(geometry, finalY);
      });

      this.textGroup.scale.setScalar(fitScale);
      this.createGlints(width + 0.7, height + 0.45, fitScale);
      this.playSequence(options.duration ?? 4);
    });
  }

  private createRocket(accentColor: number): void {
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xeaf4fa,
      metalness: 0.38,
      roughness: 0.34,
      clearcoat: 0.45,
      clearcoatRoughness: 0.28,
    });
    const accentMaterial = new THREE.MeshPhysicalMaterial({
      color: accentColor,
      metalness: 0.32,
      roughness: 0.32,
      clearcoat: 0.55,
      clearcoatRoughness: 0.24,
    });
    const flameMaterial = new THREE.MeshStandardMaterial({
      color: this.palette.primary,
      emissive: this.palette.primary,
      emissiveIntensity: 0.08,
      roughness: 0.6,
    });
    const flameCoreMaterial = new THREE.MeshStandardMaterial({
      color: this.palette.core,
      emissive: this.palette.core,
      emissiveIntensity: 0.14,
      roughness: 0.55,
    });
    this.materials.add(bodyMaterial);
    this.materials.add(accentMaterial);
    this.materials.add(flameMaterial);
    this.materials.add(flameCoreMaterial);

    const bodyGeometry = new THREE.CylinderGeometry(0.105, 0.105, 0.56, 12);
    const noseGeometry = new THREE.ConeGeometry(0.105, 0.28, 12);
    const flameGeometry = new THREE.ConeGeometry(0.09, 0.42, 10);
    const coreGeometry = new THREE.ConeGeometry(0.05, 0.3, 8);
    const bandGeometry = new THREE.TorusGeometry(0.108, 0.012, 8, 20);
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0.08);
    finShape.lineTo(0.17, -0.16);
    finShape.lineTo(0.06, -0.16);
    finShape.lineTo(-0.015, -0.03);
    finShape.closePath();
    const finGeometry = new THREE.ExtrudeGeometry(finShape, {
      depth: 0.035,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.006,
      bevelSegments: 1,
    });
    this.geometries.add(bodyGeometry);
    this.geometries.add(noseGeometry);
    this.geometries.add(flameGeometry);
    this.geometries.add(coreGeometry);
    this.geometries.add(bandGeometry);
    this.geometries.add(finGeometry);

    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    const nose = new THREE.Mesh(noseGeometry, accentMaterial);
    nose.position.y = 0.42;
    const flame = new THREE.Mesh(flameGeometry, flameMaterial);
    flame.position.y = -0.45;
    flame.rotation.z = Math.PI;
    const flameCore = new THREE.Mesh(coreGeometry, flameCoreMaterial);
    flameCore.position.y = -0.44;
    flameCore.rotation.z = Math.PI;

    const upperBand = new THREE.Mesh(bandGeometry, accentMaterial);
    upperBand.rotation.x = Math.PI / 2;
    upperBand.position.y = 0.14;
    const lowerBand = new THREE.Mesh(bandGeometry, accentMaterial);
    lowerBand.rotation.x = Math.PI / 2;
    lowerBand.position.y = -0.15;
    const fins = [0, 1, 2].map((index) => {
      const fin = new THREE.Mesh(finGeometry, accentMaterial);
      fin.position.set(0, -0.17, 0);
      fin.rotation.y = (index * Math.PI * 2) / 3;
      return fin;
    });

    this.rocket.add(body, nose, flame, flameCore, upperBand, lowerBand, ...fins);
    this.rocket.userData.flame = flame;
    this.rocket.userData.flameCore = flameCore;
    this.rocket.position.set(0, -HALF_FRAME_HEIGHT + 0.65, 2);
    this.rocket.scale.setScalar(1.2);

  }

  private createFireworks(): void {
    // Fireworks are trails only: each one is a short, fading multi-segment arc.
    const streakPositions = new Float32Array(84 * 6 * 3);
    const streakColors = new Float32Array(84 * 6 * 3);
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

    this.burstFlash = new THREE.PointLight(this.palette.core, 0, 6);
    this.burstFlash.position.z = 1.7;
    this.fireworks.add(this.burstFlash);

    const sparkColors = [
      this.palette.primary,
      this.palette.secondary,
      this.palette.accent,
      this.palette.core,
    ];
    for (let index = 0; index < 84; index++) {
      const color = new THREE.Color(index % 7 === 0 ? this.palette.core : randomFrom(sparkColors));
      const angle = this.fireworkStyle === 'ring'
        ? (index / 84) * Math.PI * 2
        : Math.random() * Math.PI * 2;
      const speed = 4.2 + Math.random() * 2.2;
      let velocity: THREE.Vector3;
      if (this.fireworkStyle === 'ring') {
        velocity = new THREE.Vector3(
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          (Math.random() - 0.5) * 0.7
        );
      } else if (this.fireworkStyle === 'willow') {
        velocity = new THREE.Vector3(
          Math.cos(angle) * speed * 0.7,
          1.4 + Math.random() * 2.2,
          Math.sin(angle) * speed * 0.5
        );
      } else {
        const vertical = Math.random() * 2 - 1;
        const horizontal = Math.sqrt(1 - vertical * vertical);
        velocity = new THREE.Vector3(
          Math.cos(angle) * horizontal * speed,
          vertical * speed,
          Math.sin(angle) * horizontal * speed * 0.55
        );
      }
      this.particles.push({
        index,
        color,
        targetVelocity: velocity,
        velocity: new THREE.Vector3(),
        delay: Math.floor(index / 28) * 0.15,
        delayRemaining: 0,
        age: 0,
        life: 1.25 + Math.random() * 0.55,
        gravity: this.fireworkStyle === 'willow' ? 5.8 : 4.6,
        active: false,
        started: false,
        position: new THREE.Vector3(),
      });
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
      const glintColors = [this.palette.accent, this.palette.secondary, this.palette.core];
      mesh.setColorAt(index, new THREE.Color(randomFrom(glintColors)));
      this.glints.push({ mesh, index, transform });
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  private playSequence(holdDuration: number): void {
    const flame = this.rocket.userData.flame as THREE.Mesh;
    const flameCore = this.rocket.userData.flameCore as THREE.Mesh;
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
      x: 1.2,
      y: 1.45,
      duration: 0.13,
      yoyo: true,
      repeat: 3,
      ease: 'sine.inOut',
    }, '<');
    this.timeline.to(flameCore.scale, {
      x: 0.75,
      y: 1.25,
      duration: 0.11,
      yoyo: true,
      repeat: 3,
      ease: 'sine.inOut',
    }, '<');
    this.timeline.to(this.rocket.rotation, {
      z: 0.035,
      duration: 0.2,
      yoyo: true,
      repeat: 2,
      ease: 'sine.inOut',
    }, '<');
    this.timeline.call(() => {
      this.rocket.visible = false;
      this.burst();
      this.formText(lines);
      this.startGlitter();
    }, undefined, '+=0.02');

    const formationDuration = 1.2 + Math.max(0, lines.length - 1) * 0.12;
    this.timeline.to({}, { duration: formationDuration });
    this.timeline.to({}, { duration: holdDuration });
    const breathingDuration = Math.max(0.2, holdDuration / 2);
    this.timeline.to(this.textGroup.position, {
      y: 0.07,
      duration: breathingDuration,
      yoyo: true,
      repeat: 1,
      ease: 'sine.inOut',
    }, '<');
    this.timeline.to(this.textGroup.rotation, {
      y: 0.08,
      z: 0.012,
      duration: breathingDuration,
      yoyo: true,
      repeat: 1,
      ease: 'sine.inOut',
    }, '<');
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
    if (this.burstFlash) {
      this.burstFlash.intensity = 0;
      const flash = gsap.timeline();
      flash.to(this.burstFlash, { intensity: 3.2, duration: 0.045, ease: 'power2.out' });
      flash.to(this.burstFlash, { intensity: 0, duration: 0.38, ease: 'power2.out' });
      this.tweens.push(flash);
    }

    if (this.streakMaterial) {
      this.streakMaterial.opacity = 0.95;
      this.tweens.push(gsap.to(this.streakMaterial, {
        opacity: 0,
        duration: 0.55,
        delay: 1.7,
      }));
    }

    for (const particle of this.particles) {
      particle.active = true;
      particle.started = false;
      particle.age = 0;
      particle.delayRemaining = particle.delay;
      particle.position.set(0, 0, 0.2);
      particle.velocity.set(0, 0, 0);
    }
  }

  private formText(lines: THREE.Mesh[]): void {
    lines.forEach((mesh, index) => {
      const target = mesh.userData.finalPosition as THREE.Vector3;
      const delay = index * 0.12;
      this.tweens.push(gsap.to(mesh.position, {
        x: target.x,
        y: target.y,
        z: target.z,
        duration: 0.7,
        delay,
        ease: 'power3.out',
      }));
      this.tweens.push(gsap.to(mesh.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.55,
        delay,
        ease: 'power3.out',
      }));
      this.tweens.push(gsap.to(mesh.rotation, {
        x: -0.04,
        y: -0.28,
        z: 0,
        duration: 0.72,
        delay,
        ease: 'power3.out',
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

  update(dt = 0): boolean {
    const positions = this.streakGeometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
    const colors = this.streakGeometry?.getAttribute('color') as THREE.BufferAttribute | undefined;

    for (const particle of this.particles) {
      const lineOffset = particle.index * 6;
      const clearTrail = () => {
        if (!positions || !colors) return;
        for (let vertex = 0; vertex < 6; vertex++) {
          positions.setXYZ(lineOffset + vertex, 0, 0, 0);
          colors.setXYZ(lineOffset + vertex, 0, 0, 0);
        }
      };

      if (!particle.active) {
        clearTrail();
        continue;
      }
      if (particle.delayRemaining > 0) {
        particle.delayRemaining = Math.max(0, particle.delayRemaining - dt);
        clearTrail();
        continue;
      }
      if (!particle.started) {
        particle.started = true;
        particle.position.set(0, 0, 0.15);
        particle.velocity.copy(particle.targetVelocity);
      }

      particle.age += dt;
      const fade = Math.max(0, 1 - particle.age / particle.life);
      if (fade <= 0) {
        particle.active = false;
        clearTrail();
        continue;
      }

      particle.velocity.y -= particle.gravity * dt;
      particle.velocity.multiplyScalar(Math.pow(0.985, dt * 60));
      particle.position.addScaledVector(particle.velocity, dt);

      const worldX = particle.position.x + this.group.position.x;
      const worldY = particle.position.y + this.group.position.y;
      if (Math.abs(worldX) > HALF_FRAME_WIDTH - 0.2 || Math.abs(worldY) > HALF_FRAME_HEIGHT - 0.2) {
        particle.active = false;
        clearTrail();
        continue;
      }

      this.directionScratch.copy(particle.velocity).normalize();
      const tailLength = (0.18 + particle.velocity.length() * 0.055) * (0.25 + fade * 0.75);
      const p = particle.position;
      const d = this.directionScratch;
      const x1 = p.x - d.x * tailLength * 0.33;
      const y1 = p.y - d.y * tailLength * 0.33;
      const z1 = p.z - d.z * tailLength * 0.33;
      const x2 = p.x - d.x * tailLength * 0.66;
      const y2 = p.y - d.y * tailLength * 0.66;
      const z2 = p.z - d.z * tailLength * 0.66;
      const x3 = p.x - d.x * tailLength;
      const y3 = p.y - d.y * tailLength;
      const z3 = p.z - d.z * tailLength;
      if (positions && colors) {
        const c = particle.color;
        const fade2 = fade * fade;
        positions.setXYZ(lineOffset, p.x, p.y, p.z);
        positions.setXYZ(lineOffset + 1, x1, y1, z1);
        positions.setXYZ(lineOffset + 2, x1, y1, z1);
        positions.setXYZ(lineOffset + 3, x2, y2, z2);
        positions.setXYZ(lineOffset + 4, x2, y2, z2);
        positions.setXYZ(lineOffset + 5, x3, y3, z3);
        colors.setXYZ(lineOffset, c.r * fade2, c.g * fade2, c.b * fade2);
        colors.setXYZ(lineOffset + 1, c.r * fade2 * 0.75, c.g * fade2 * 0.75, c.b * fade2 * 0.75);
        colors.setXYZ(lineOffset + 2, c.r * fade2 * 0.75, c.g * fade2 * 0.75, c.b * fade2 * 0.75);
        colors.setXYZ(lineOffset + 3, c.r * fade2 * 0.42, c.g * fade2 * 0.42, c.b * fade2 * 0.42);
        colors.setXYZ(lineOffset + 4, c.r * fade2 * 0.42, c.g * fade2 * 0.42, c.b * fade2 * 0.42);
        colors.setXYZ(lineOffset + 5, c.r * fade2 * 0.08, c.g * fade2 * 0.08, c.b * fade2 * 0.08);
      }
    }

    const updatedMeshes = new Set<THREE.InstancedMesh>();
    for (const instance of this.glints) {
      instance.transform.updateMatrix();
      instance.mesh.setMatrixAt(instance.index, instance.transform.matrix);
      updatedMeshes.add(instance.mesh);
    }
    updatedMeshes.forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
    });
    if (positions) positions.needsUpdate = true;
    if (colors) colors.needsUpdate = true;
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
