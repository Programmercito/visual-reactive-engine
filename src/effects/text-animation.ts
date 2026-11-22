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

const SIZE = 0.45;
const DEPTH = 0.12;
const MAX_CHARS_PER_LINE = 16;
const MAX_LINES = 5;
const MAX_WIDTH = 6.0;
const MAX_HEIGHT = 10;

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const rawWord of words) {
    const chunks = rawWord.length > maxChars
      ? rawWord.match(new RegExp(`.{1,${maxChars}}`, 'g'))!
      : [rawWord];
    for (const word of chunks) {
      if ((line + ' ' + word).trim().length > maxChars) {
        if (line) lines.push(line.trim());
        line = word;
      } else {
        line = (line + ' ' + word).trim();
      }
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
    private options: TextEffectOptions
  ) {
    const mode = getMode(this.options.mode);
    const text = this.options.text.slice(0, 120).trim();

    this.targetX = typeof this.options.x === 'number' ? this.options.x : (Math.random() * 4 - 2);
    this.targetY = typeof this.options.y === 'number' ? this.options.y : (Math.random() * 5 - 1.5);

    this.group = new THREE.Group();
    this.group.position.set(this.targetX, this.targetY - 1, 6);
    this.group.scale.set(0, 0, 0);
    this.scene.add(this.group);

    let baseScale = 1;

    getFont((font) => {
      if (!this.alive) return;

      const lines = wrapLines(text, MAX_CHARS_PER_LINE);
      const lineHeight = SIZE * 1.45;
      const totalHeight = (lines.length - 1) * lineHeight + SIZE;
      let widest = 0;

      const material = new THREE.MeshBasicMaterial({
        color: mode.accentColor,
      });

      lines.forEach((line, i) => {
        const geometry = new TextGeometry(line, {
          font,
          size: SIZE,
          depth: DEPTH,
          curveSegments: 3,
          bevelEnabled: true,
          bevelThickness: 0.02,
          bevelSize: 0.015,
          bevelSegments: 2,
        });
        geometry.center();
        geometry.computeBoundingBox();
        const width = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x;
        if (width > widest) widest = width;

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
          0,
          (totalHeight / 2) - i * lineHeight - SIZE / 2,
          0
        );
        this.group.add(mesh);
      });

      // Fit inside the 9:16 safe area both horizontally and vertically.
      const scaleX = widest > MAX_WIDTH ? MAX_WIDTH / widest : 1;
      const scaleY = totalHeight > MAX_HEIGHT ? MAX_HEIGHT / totalHeight : 1;
      baseScale = Math.min(scaleX, scaleY);
    });

    const duration = this.options.duration ?? 4;
    const tl = gsap.timeline({
      onComplete: () => {
        this.alive = false;
        this.options.onComplete?.();
      },
    });

    tl.to(this.group.position, { z: 4, y: this.targetY, duration: 0.6, ease: 'back.out(1.4)' });
    tl.to(this.group.scale, { x: baseScale, y: baseScale, z: baseScale, duration: 0.6, ease: 'back.out(1.4)' }, '<');
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
