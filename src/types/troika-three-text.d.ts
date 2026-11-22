declare module 'troika-three-text' {
  import { Object3D, Color } from 'three';

  export class Text extends Object3D {
    text: string;
    font: string | null;
    fontSize: number;
    color: number | string | Color;
    anchorX: number | string;
    anchorY: number | string;
    outlineWidth: number;
    outlineColor: number | string | Color;
    outlineOpacity: number;
    fillOpacity: number;
    strokeWidth: number;
    strokeColor: number | string | Color;
    strokeOpacity: number;
    curveRadius: number;
    depthOffset: number;
    direction: string;
    isTroikaText: boolean;

    sync(callback?: () => void): void;
    dispose(): void;
  }
}
