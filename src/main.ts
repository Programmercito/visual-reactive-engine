import * as THREE from 'three';
import gsap from 'gsap';
import { createScene } from './core/scene';
import { createCamera, updateCameraOnResize } from './core/camera';
import { createRenderer } from './core/renderer';
import { AnimationEngine } from './core/animation-engine';
import { EventManager, type VisualAction } from './api/events';
import { APISocket } from './api/websocket';
import { TextQueue } from './effects/text-queue';
import { ImageFloatEffect } from './effects/image-float';
import { ParticleEffect } from './effects/particles';
import { ExplosionEffect } from './effects/explosion';
import { ModelActorEffect } from './effects/model-actor';
import { SpeechQueue } from './effects/speech-queue';
import { getMode, MODES, type AnimationMode } from './config/modes';

// ---- Init ----
const canvas = document.getElementById('webgl') as HTMLCanvasElement;
const scene = createScene();
const camera = createCamera(window.innerWidth / window.innerHeight);
const renderer = createRenderer(canvas);
const engine = new AnimationEngine(scene, camera, renderer);
const events = new EventManager();
const socket = new APISocket(events);
const speechQueue = new SpeechQueue();
const textQueue = new TextQueue(scene, engine);
const speechToggle = document.getElementById('speech-toggle') as HTMLButtonElement;

if (!speechQueue.supported) {
  speechToggle.disabled = true;
  speechToggle.textContent = 'Voz no disponible';
} else {
  speechToggle.addEventListener('click', () => {
    speechQueue.setEnabled(!speechQueue.isEnabled);
    speechToggle.textContent = speechQueue.isEnabled ? '🔊 Voz activada' : '🔇 Activar voz';
    speechToggle.setAttribute('aria-pressed', String(speechQueue.isEnabled));
  });
}

// Lights for 3D models
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

let currentMode: AnimationMode = getMode();

// ---- Resize ----
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  updateCameraOnResize(camera, w / h);
}
window.addEventListener('resize', onResize);
onResize();

// ---- Handle actions ----
events.onAction((action: VisualAction) => {
  switch (action.type) {
    case 'text': {
      textQueue.add({
        text: action.text,
        sender: action.sender,
        mode: action.mode || currentMode.id,
        duration: action.duration,
        onStart: () => {
          const spokenText = action.sender
            ? `${action.sender.replace(/^@/, '')} dice: ${action.text}`
            : action.text;
          speechQueue.add(spokenText);
        },
      });
      break;
    }
    case 'show-image': {
      const fx = new ImageFloatEffect(scene, {
        image: action.image,
        duration: action.duration,
        x: action.x,
        y: action.y,
        scale: action.scale,
      });
      engine.add({
        update: () => fx.update(),
        dispose: () => fx.dispose(),
      });
      break;
    }
    case 'particles': {
      const fx = new ParticleEffect(scene, {
        preset: action.preset,
        x: action.x,
        y: action.y,
        duration: action.duration,
        mode: currentMode.id,
      });
      engine.add({
        update: (dt) => fx.update(dt),
        dispose: () => fx.dispose(),
      });
      break;
    }
    case 'explosion': {
      const fx = new ExplosionEffect(scene, {
        x: action.x,
        y: action.y,
        preset: action.preset,
        duration: action.duration,
        mode: currentMode.id,
      });
      engine.add({
        update: (dt) => fx.update(dt),
        dispose: () => fx.dispose(),
      });
      break;
    }
    case 'spawn': {
      const fx = new ModelActorEffect(scene, {
        asset: action.asset,
        animation: action.animation,
        duration: action.duration,
      });
      engine.add({
        update: (dt) => fx.update(dt),
        dispose: () => fx.dispose(),
      });
      break;
    }
    case 'set-mode': {
      currentMode = getMode(action.mode.id);
      gsap.to(scene.fog!.color, {
        r: new THREE.Color(currentMode.bgTint).r,
        g: new THREE.Color(currentMode.bgTint).g,
        b: new THREE.Color(currentMode.bgTint).b,
        duration: 1,
      });
      break;
    }
    case 'clear': {
      // Engine will dispose all active effects on next frame via their dispose callback,
      // but here we clear immediately.
      // (Simplest: reload page. For production, track active effects and remove them.)
      window.location.reload();
      break;
    }
  }
});

// ---- Connect to API ----
socket.connect();

// ---- Demo mode: auto-play sample events if ?demo is present ----
if (window.location.search.includes('demo')) {
  const demos: VisualAction[] = [
    { type: 'text', text: '¡Hola TikTok!', duration: 5 },
    { type: 'particles', preset: 'gold-explosion', duration: 3 },
    { type: 'spawn', asset: 'dragon', animation: 'fly', duration: 6 },
    { type: 'show-image', image: 'gift.png', duration: 4 },
  ];
  let i = 0;
  const run = () => {
    events.emit(demos[i]);
    i = (i + 1) % demos.length;
    setTimeout(run, 3500);
  };
  setTimeout(run, 1000);
}

// ---- Start loop ----
engine.start();

// ---- Expose debug API in window for manual testing ----
(window as unknown as Record<string, unknown>).vre = {
  emit: (event: Record<string, unknown>) => events.process(event as never),
  modes: MODES,
  setMode: (id: string) => events.process({ action: 'set-mode', mode: id }),
};
