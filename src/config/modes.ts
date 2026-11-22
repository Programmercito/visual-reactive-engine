/**
 * Animation modes for the reactive engine.
 * Each mode defines a visual theme used by effects.
 */

export interface AnimationMode {
  id: string;
  name: string;
  textColor: string;
  accentColor: string;
  particleColor: string;
  bgTint: string;
  font: string;
}

export const DEFAULT_MODE: AnimationMode = {
  id: 'default',
  name: 'Default Heavy',
  textColor: '#ffffff',
  accentColor: '#00e5ff',
  particleColor: '#ffaa00',
  bgTint: '#0a0f14',
  font: 'bold 120px system-ui, sans-serif',
};

export const MODES: AnimationMode[] = [
  DEFAULT_MODE,
  {
    id: 'cyber',
    name: 'Cyber Blue',
    textColor: '#00f0ff',
    accentColor: '#7000ff',
    particleColor: '#00f0ff',
    bgTint: '#001122',
    font: 'bold 120px "Courier New", monospace',
  },
  {
    id: 'gold',
    name: 'Gold Rush',
    textColor: '#fff8db',
    accentColor: '#ffaa00',
    particleColor: '#ffd700',
    bgTint: '#221100',
    font: 'bold 130px Georgia, serif',
  },
  {
    id: 'forest',
    name: 'Forest Magic',
    textColor: '#e0ffe0',
    accentColor: '#00ff88',
    particleColor: '#88ffaa',
    bgTint: '#001a0d',
    font: 'bold 120px system-ui, sans-serif',
  },
];

export function getMode(id?: string): AnimationMode {
  return MODES.find((m) => m.id === id) || DEFAULT_MODE;
}
