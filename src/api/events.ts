import type { AnimationMode } from '../config/modes';

export interface APIEvent {
  action:
    | 'spawn'
    | 'show-image'
    | 'particles'
    | 'text'
    | 'explosion'
    | 'set-mode'
    | 'clear';
  asset?: string;
  animation?: string;
  image?: string;
  preset?: string;
  text?: string;
  mode?: string;
  duration?: number;
  x?: number;
  y?: number;
  scale?: number;
  color?: string;
  [key: string]: unknown;
}

export type VisualAction =
  | { type: 'spawn'; asset: string; animation?: string; duration: number }
  | { type: 'show-image'; image: string; duration: number; x?: number; y?: number; scale?: number }
  | { type: 'particles'; preset: string; x?: number; y?: number; duration: number }
  | { type: 'text'; text: string; mode?: string; duration: number }
  | { type: 'explosion'; x?: number; y?: number; preset?: string; duration: number }
  | { type: 'set-mode'; mode: AnimationMode }
  | { type: 'clear' };

export class EventManager {
  private listeners: ((action: VisualAction) => void)[] = [];

  onAction(fn: (action: VisualAction) => void): void {
    this.listeners.push(fn);
  }

  emit(action: VisualAction): void {
    for (const fn of this.listeners) fn(action);
  }

  process(event: APIEvent): void {
    const action = this.normalize(event);
    if (action) this.emit(action);
  }

  private normalize(event: APIEvent): VisualAction | null {
    const duration = typeof event.duration === 'number' ? event.duration : 5;

    switch (event.action) {
      case 'spawn':
        if (!event.asset) return null;
        return {
          type: 'spawn',
          asset: event.asset,
          animation: event.animation,
          duration,
        };

      case 'show-image':
        if (!event.image) return null;
        return {
          type: 'show-image',
          image: event.image,
          duration,
          x: event.x,
          y: event.y,
          scale: event.scale,
        };

      case 'particles':
        if (!event.preset) return null;
        return {
          type: 'particles',
          preset: event.preset,
          x: event.x,
          y: event.y,
          duration,
        };

      case 'text':
        if (!event.text) return null;
        return {
          type: 'text',
          text: event.text,
          mode: event.mode,
          duration,
        };

      case 'explosion':
        return {
          type: 'explosion',
          x: event.x,
          y: event.y,
          preset: event.preset || 'gold',
          duration,
        };

      case 'set-mode':
        if (!event.mode) return null;
        return { type: 'set-mode', mode: { id: event.mode } as AnimationMode };

      case 'clear':
        return { type: 'clear' };

      default:
        console.warn('Unknown API action', event.action);
        return null;
    }
  }
}
