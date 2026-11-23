import * as THREE from 'three';
import type { VisualAction } from '../api/events';
import type { AnimationEngine } from '../core/animation-engine';
import { ExplosionEffect } from './explosion';
import { ImageFloatEffect } from './image-float';
import { ModelActorEffect } from './model-actor';
import { ParticleEffect } from './particles';
import { estimateTextHeight, TextEffect } from './text-animation';

type QueuedAction = Extract<VisualAction, { type: 'text' | 'gift' | 'show-image' | 'particles' | 'explosion' | 'spawn' }>;
type QueueItem = { action: QueuedAction; mode: string };
type Reservation = { y: number; height: number };
type SpokenAction = Extract<VisualAction, { type: 'text' | 'gift' }>;

const MAX_VISIBLE_EVENTS = 3;
const FRAME_HALF_HEIGHT = 8;
const VERTICAL_GAP = 0.15;
const EVENT_HEIGHTS: Record<Exclude<QueuedAction['type'], 'text'>, number> = {
  gift: 4.4,
  'show-image': 4.7,
  particles: 4.7,
  explosion: 4.7,
  spawn: 5,
};

export class VisualQueue {
  private queue: QueueItem[] = [];
  private active = new Map<number, Reservation>();
  private nextId = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly engine: AnimationEngine,
    private readonly onTextStart: (action: SpokenAction) => void,
  ) {}

  add(action: QueuedAction, mode: string): void {
    this.queue.push({ action, mode });
    this.pump();
  }

  private pump(): void {
    while (this.queue.length && this.active.size < MAX_VISIBLE_EVENTS) {
      const item = this.queue[0];
      const height = this.getHeight(item.action);
      const y = this.findFreeY(height, this.getRequestedY(item.action));
      if (y === null) return;

      this.queue.shift();
      const id = this.nextId++;
      this.active.set(id, { y, height });
      this.start(item, id, y);
    }
  }

  private start(item: QueueItem, id: number, y: number): void {
    const release = () => {
      if (!this.active.delete(id)) return;
      this.pump();
    };

    let update: (dt: number) => boolean;
    let dispose: () => void;
    const { action, mode } = item;

    switch (action.type) {
      case 'text': {
        const effect = new TextEffect(this.scene, {
          ...action,
          mode: action.mode || mode,
          y,
          onStart: () => this.onTextStart(action),
        });
        update = (dt) => effect.update(dt);
        dispose = () => effect.dispose();
        break;
      }
      case 'gift': {
        const giftText = action.count > 1 ? `${action.gift} x${action.count}` : action.gift;
        const effect = new TextEffect(this.scene, {
          text: giftText,
          sender: action.sender,
          gift: { name: action.gift },
          mode,
          duration: action.duration,
          y: y - 1.25,
          onStart: () => this.onTextStart(action),
        });
        update = (dt) => effect.update(dt);
        dispose = () => effect.dispose();
        break;
      }
      case 'show-image': {
        const effect = new ImageFloatEffect(this.scene, { ...action, y });
        update = () => effect.update();
        dispose = () => effect.dispose();
        break;
      }
      case 'particles': {
        const height = this.getHeight(action);
        const effect = new ParticleEffect(this.scene, {
          ...action,
          y,
          mode,
          minY: y - height / 2,
          maxY: y + height / 2,
        });
        update = (dt) => effect.update(dt);
        dispose = () => effect.dispose();
        break;
      }
      case 'explosion': {
        const height = this.getHeight(action);
        const effect = new ExplosionEffect(this.scene, {
          ...action,
          y,
          mode,
          minY: y - height / 2,
          maxY: y + height / 2,
        });
        update = (dt) => effect.update(dt);
        dispose = () => effect.dispose();
        break;
      }
      case 'spawn': {
        const effect = new ModelActorEffect(this.scene, { ...action, y });
        update = (dt) => effect.update(dt);
        dispose = () => effect.dispose();
        break;
      }
    }

    this.engine.add({
      update: (dt) => {
        const alive = update(dt);
        if (!alive) release();
        return alive;
      },
      dispose: () => {
        dispose();
        release();
      },
    });
  }

  private getHeight(action: QueuedAction): number {
    if (action.type === 'text') return Math.max(2.2, estimateTextHeight(action.text, action.sender));
    if (action.type === 'show-image') return Math.max(EVENT_HEIGHTS[action.type], (action.scale ?? 2.5) * 2);
    return EVENT_HEIGHTS[action.type];
  }

  private getRequestedY(action: QueuedAction): number | undefined {
    return action.type === 'show-image'
      || action.type === 'particles'
      || action.type === 'explosion'
      ? action.y
      : undefined;
  }

  private findFreeY(height: number, requestedY?: number): number | null {
    const maxCenter = FRAME_HALF_HEIGHT - height / 2 - 0.55;
    const minCenter = -maxCenter;
    if (requestedY !== undefined) {
      const y = THREE.MathUtils.clamp(requestedY, minCenter, maxCenter);
      const overlaps = [...this.active.values()].some((reservation) =>
        Math.abs(reservation.y - y) < (reservation.height + height) / 2 + VERTICAL_GAP
      );
      return overlaps ? null : y;
    }

    const spacing = height + VERTICAL_GAP;
    const slotCount = Math.max(1, Math.floor((maxCenter - minCenter) / spacing) + 1);
    const firstCenter = (minCenter + maxCenter - (slotCount - 1) * spacing) / 2;
    const candidates = Array.from({ length: slotCount }, (_, index) => firstCenter + index * spacing);
    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
    }

    for (const y of candidates) {
      const overlaps = [...this.active.values()].some((reservation) =>
        Math.abs(reservation.y - y) < (reservation.height + height) / 2 + VERTICAL_GAP
      );
      if (!overlaps) return y;
    }

    return null;
  }
}
