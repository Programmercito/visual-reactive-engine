import type { AnimationEngine } from '../core/animation-engine';
import type { TextEffectOptions } from './text-animation';
import { TextEffect } from './text-animation';
import * as THREE from 'three';

export class TextQueue {
  private queue: TextEffectOptions[] = [];
  private playing = false;

  constructor(
    private scene: THREE.Scene,
    private engine: AnimationEngine
  ) {}

  add(options: TextEffectOptions): void {
    this.queue.push(options);
    if (!this.playing) {
      this.next();
    }
  }

  private next(): void {
    if (!this.queue.length) {
      this.playing = false;
      return;
    }

    this.playing = true;
    const options = this.queue.shift()!;
    const fx = new TextEffect(this.scene, {
      ...options,
      onComplete: () => this.next(),
    });

    this.engine.add({
      update: () => fx.update(),
      dispose: () => fx.dispose(),
    });
  }
}
