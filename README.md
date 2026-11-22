# Visual Reactive Engine

Aplicación fullscreen vertical que reproduce un vídeo de fondo y renderiza animaciones 3D en tiempo real según eventos recibidos desde una API WebSocket/HTTP.

**Stack:** TypeScript · Vite · Three.js · GSAP · WebSocket

**No incluye integración con TikTok ni OBS.** Expone una API local para que tú la conectes a la fuente que quieras.

---

## Inicio rápido

```bash
cd visual-reactive-engine
pnpm install
```

Levanta el motor visual:

```bash
pnpm run dev
```

En otra terminal, levanta la API de ejemplo:

```bash
pnpm run api
```

Abre `http://localhost:5173` y prueba:

```bash
curl -X POST http://localhost:8787/event \
  -H "Content-Type: application/json" \
  -d '{"action":"text","sender":"@ana","text":"¡Hola!","duration":5}'
```

Para ver una demo automática abre `http://localhost:5173/?demo`.

---

## Documentación

Lee [`MANUAL.md`](./MANUAL.md) para:

- Todos los tipos de eventos soportados.
- Cómo añadir vídeos, imágenes y modelos.
- Cómo crear nuevos modos de animación.
- Cómo integrarlo con TikTok, OBS u otras fuentes.
- Build para producción.

---

## Estructura

```
src/
  core/          escena, cámara, renderer, motor de animación, vídeo
  api/           Event Manager + cliente WebSocket
  effects/       texto, imágenes, partículas, explosiones, modelos
  config/        modos visuales
server/          servidor WebSocket/HTTP de ejemplo
public/assets/   vídeos, imágenes y modelos
```
