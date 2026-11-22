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

const SIZE = 0.6;
const DEPTH = 0.12;
const MAX_CHARS_PER_LINE = 24;
const MAX_LINES = 4;
const MAX_WIDTH = 7.0;

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars) {
      if (line) lines.push(line.trim());
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line.trim());
  return lines.slice(0, MAX_LINES).length ? lines.slice(0, MAX_LINES) : [text];
}

export class TextEffect {
  public group: THREE.Group;
  private alive = true;
  private targetX: number;
  private targetY: number;

  constructor(
    private scene: THREE.Scene,
    options: TextEffectOptions
  ) {
    const mode = getMode(options.mode);
    const text = options.text.slice(0, 100).trim();

    this.targetX = typeof options.x === 'number' ? options.x : (Math.random() * 6 - 3);
    this.targetY = typeof options.y === 'number' ? options.y : (Math.random() * 6 - 2);

    this.group = new THREE.Group();
    this.group.position.set(this.targetX, this.targetY - 1, 6);
    this.group.scale.set(0, 0, 0);
    this.scene.add(this.group);

    getFont((font) => {
      if (!this.alive) return;

      const lines = wrapLines(text, MAX_CHARS_PER_LINE);
      const totalHeight = (lines.length - 1) * SIZE * 1.5;
      let widest = 0;

      lines.forEach((line, i) => {
        const geometry = new TextGeometry(line, {
          font,
          size: SIZE,
          depth: DEPTH,
          curveSegments: 2,
          bevelEnabled: true,
          bevelThickness: 0.02,
          bevelSize: 0.01,
          bevelSegments: 1,
        });
        geometry.center();
        geometry.computeBoundingBox();
        const width = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x;
        if (width > widest) widest = width;

        const material = new THREE.MeshStandardMaterial({
          color: mode.textColor,
          emissive: mode.accentColor,
          emissiveIntensity: 0.25,
          metalness: 0.3,
          roughness: 0.45,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = (totalHeight / 2) - i * SIZE * 1.5;
        this.group.add(mesh);
      });

      // Scale whole block to fit the vertical frame.
      if (widest > MAX_WIDTH) {
        const s = MAX_WIDTH / widest;
        this.group.scale.set(s, s, s);
      }
    });

    const duration = options.duration ?? 4;
    const tl = gsap.timeline({
      onComplete: () => {
        this.alive = false;
        options.onComplete?.();
      },
    });

    tl.to(this.group.position, { z: 4, y: this.targetY, duration: 0.6, ease: 'back.out(1.4)' });
    tl.to(this.group.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(1.4)' }, '<');
    tl.fromTo(
      this.group.rotation,
      { x: Math.PI * 0.25, y: Math.PI * 0.5, z: 0 },
      { x: 0, y: 0, z: 0, duration: 0.7, ease: 'power2.out' },
      '<'
    );

    tl.to(this.group.position, { y: this.targetY + 0.6, duration: duration * 0.5, ease: 'sine.inOut', yoyo: true, repeat: 1 }, '<0.2');
    tl.to(this.group.rotation, { y: Math.PI * 0.06, duration: duration * 0.6, ease: 'sine.inOut', yoyo: true, repeat: 1 }, '<');

    tl.to(this.group.position, { z: 8, duration: 0.4, ease: 'power2.in' });
    tl.to(this.group.scale, { x: 0, y: 0, z: 0, duration: 0.4, ease: 'back.in(1.4)' }, '<');
  }

  update(): boolean {
    return this.alive;
  }

  dispose(): void {
    this.alive = false;
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
