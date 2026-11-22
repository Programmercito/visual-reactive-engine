import { FontLoader, type Font } from 'three/addons/loaders/FontLoader.js';

const fontUrl = '/fonts/droid_sans_bold.typeface.json';

let fontCache: Font | null = null;
const pending: ((font: Font) => void)[] = [];

function loadFont(): void {
  new FontLoader().load(fontUrl, (font) => {
    fontCache = font;
    while (pending.length) {
      pending.shift()!(font);
    }
  });
}

export function getFont(callback: (font: Font) => void): void {
  if (fontCache) {
    callback(fontCache);
    return;
  }
  pending.push(callback);
  if (pending.length === 1) {
    loadFont();
  }
}
