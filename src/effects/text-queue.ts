import * as THREE from 'three';
import type { AnimationEngine } from '../core/animation-engine';
import { estimateTextHeight, TextEffect, type TextEffectOptions } from './text-animation';

type Reservation = { y: number; height: number };

const MAX_VISIBLE_TEXTS = 3;
const FRAME_HALF_HEIGHT = 8;

export class TextQueue {
  private queue: TextEffectOptions[] = [];
  private active = new Map<number, Reservation>();
  private nextId = 0;

  constructor(
    private scene: THREE.Scene,
    private engine: AnimationEngine
  ) {}

  add(options: TextEffectOptions): void {
    this.queue.push(options);
    this.pump();
  }

  private pump(): void {
    while (this.queue.length && this.active.size < MAX_VISIBLE_TEXTS) {
      const options = this.queue[0];
      const height = estimateTextHeight(options.text, options.sender);
      const y = this.findFreeY(height, options.y);
      if (y === null) return;

      this.queue.shift();
      const id = this.nextId++;
      this.active.set(id, { y, height });

      const fx = new TextEffect(this.scene, {
        ...options,
        y,
        onComplete: () => {
          this.active.delete(id);
          options.onComplete?.();
          this.pump();
        },
      });

      this.engine.add({
        update: (dt) => fx.update(dt),
        dispose: () => fx.dispose(),
      });
    }
  }

  private findFreeY(height: number, requestedY?: number): number | null {
    const maxCenter = FRAME_HALF_HEIGHT - height / 2 - 0.55;
    const minCenter = -maxCenter;
    const candidates = requestedY === undefined
      ? Array.from({ length: 48 }, () => minCenter + Math.random() * (maxCenter - minCenter))
      : [THREE.MathUtils.clamp(requestedY, minCenter, maxCenter)];

    for (const y of candidates) {
      const overlaps = [...this.active.values()].some((item) =>
        Math.abs(item.y - y) < (item.height + height) / 2 + 0.45
      );
      if (!overlaps) return y;
    }

    return null;
  }
}
