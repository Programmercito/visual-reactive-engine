# Visual Reactive Engine — Manual de uso

Aplicación fullscreen vertical (9:16) que reproduce un vídeo de fondo y renderiza animaciones 3D sobre él en tiempo real, controladas por eventos desde una API WebSocket/HTTP.

**Sin integración con TikTok ni OBS.** Solo expone una API local que tú puedes conectar a cualquier fuente externa.

---

## 1. Instalación

```bash
cd visual-reactive-engine
pnpm install
```

---

## 2. Arrancar el sistema

Necesitas **dos terminales**:

### Terminal 1 — Motor visual (Vite)
```bash
pnpm run dev
```
Abre `http://localhost:5173` en el navegador. Usa F11 para pantalla completa.

### Terminal 2 — API de eventos
```bash
pnpm run api
```
Levanta un servidor WebSocket + HTTP en `ws://localhost:8787` / `http://localhost:8787`.

---

## 3. Probar sin conexión externa

Añade `?demo` a la URL para ver una secuencia automática:

```
http://localhost:5173/?demo
```

También puedes enviar eventos desde la consola del navegador:

```js
vre.emit({ action: 'text', text: '¡Hola mundo!' });
vre.emit({ action: 'gift', sender: '@ana', gift: 'Rosa', count: 334 });
vre.emit({ action: 'particles', preset: 'gold-explosion' });
vre.emit({ action: 'spawn', asset: 'dragon', animation: 'fly' });
```

---

## 4. Enviar eventos desde la API

### WebSocket
Conecta cualquier cliente a `ws://localhost:8787` y envía JSON:

```json
{ "action": "text", "sender": "@ana", "text": "Nuevo seguidor", "duration": 5 }
```

Los regalos usan un evento independiente. `gift` es el nombre del regalo, `count` la cantidad (por defecto `1`) y `sender` es opcional:

```json
{ "action": "gift", "sender": "@ana", "gift": "Rosa", "count": 334, "duration": 5 }
```

También se envía por HTTP con el mismo endpoint `POST /event`. Un regalo usa la misma animación que un comentario —cohete, fuegos artificiales y texto— y añade un objeto 3D: una rosa animada para `Rosa`/`Rose` o una caja que se abre para los demás. El texto muestra al donante, el regalo y su cantidad debajo del objeto. Texto, regalos y demás efectos visuales comparten una única cola FIFO, con un máximo de tres eventos activos y posiciones reservadas para que no se pisen. El cohete y los fuegos artificiales forman parte del mismo evento de regalo. Para regalos reales de TikTok, un conector externo debe traducir los eventos de TikTok a este formato; el detector `gift-detector` ya realiza esa traducción.

```powershell
$body = '{"action":"gift","sender":"@ana","gift":"Rosa","count":334,"duration":5}'

curl.exe -X POST http://localhost:8787/event `
  -H "Content-Type: application/json" `
  -d $body
```

### HTTP POST
```bash
curl -X POST http://localhost:8787/event \
  -H "Content-Type: application/json" \
  -d '{"action":"text","sender":"@ana","text":"Hola TikTok","duration":4}'
```

### PowerShell en Windows
Usa `curl.exe` y guarda el JSON en una variable para evitar problemas con comillas:

```powershell
$body = '{"action":"text","sender":"@ana","text":"Hola TikTok","duration":4}'

curl.exe -X POST http://localhost:8787/event `
  -H "Content-Type: application/json" `
  -d $body
```

---

## 5. Tipos de eventos soportados

| Acción | Campos | Descripción |
|--------|--------|-------------|
| `text` | `text`, `sender`, `mode`, `duration` | Muestra el nombre del remitente, seguido de `:`, pequeño sobre el texto principal |
| `gift` | `gift`, `sender`, `count`, `duration` | Animación 3D de regalo, con donante y cantidad |
| `show-image` | `image`, `x`, `y`, `scale`, `duration` | Imagen flotante PNG/WebP |
| `particles` | `preset`, `x`, `y`, `duration` | Sistema de partículas |
| `explosion` | `preset`, `x`, `y`, `duration` | Partículas + luz puntual |
| `spawn` | `asset`, `animation`, `duration` | Carga modelo GLB o geometría fallback |
| `set-mode` | `mode` | Cambia paleta de colores |
| `clear` | — | Recarga la página (limpia efectos) |

Los comentarios se ajustan al espacio del lienzo: se muestran hasta 10 líneas (máximo teórico de 240 caracteres sin remitente). Si se incluye un remitente, el espacio disponible para el comentario baja a un máximo teórico de 8 líneas (192 caracteres). El excedente se indica con `…`; el evento API puede contener más texto, pero no todo será visible a la vez.

### Ejemplos

```json
{ "action": "text", "sender": "@ana", "text": "¡Gracias por la rosa!", "mode": "gold", "duration": 5 }
{ "action": "gift", "sender": "@ana", "gift": "Rosa", "count": 334, "duration": 5 }
{ "action": "show-image", "image": "gift.png", "x": 0, "y": -2, "scale": 3, "duration": 4 }
{ "action": "spawn", "asset": "dragon", "animation": "fly", "duration": 8 }
{ "action": "particles", "preset": "gold-explosion", "x": 0, "y": 0, "duration": 2 }
{ "action": "set-mode", "mode": "cyber" }
```

---

## 6. Modos de animación

Los modos cambian colores, fuente y acentos. IDs disponibles:

- `default` — neón rosa/amarillo
- `cyber` — azul cian/morado
- `gold` — dorado
- `forest` — verde mágico

Puedes añadir más en `src/config/modes.ts`.

---

## 7. Assets

Coloca tus archivos en `public/assets/`:

```
public/assets/
  videos/background.mp4   → vídeo de fondo (H.264)
  images/gift.png         → imágenes para show-image
  models/dragon.glb       → modelos para spawn
```

Si no colocas nada, el motor usa **fallbacks automáticos**:

- Vídeo: gradiente animado.
- Imagen: caja rosa con el nombre del archivo.
- Modelo: icosaedro brillante con el nombre del asset.

### Formatos recomendados

- Vídeo: `.mp4` H.264, 1080x1920, 30 FPS.
- Imágenes: `.webp` o `.png` con transparencia.
- Modelos: `.glb` optimizado, < 5 MB, animaciones incluidas.

---

## 8. Estructura del proyecto

```
src/
  core/
    scene.ts              escena Three.js
    camera.ts             cámara vertical 9:16
    renderer.ts           WebGL renderer
    animation-engine.ts   loop y cola de efectos
    video-background.ts   vídeo de fondo + fallback
  api/
    events.ts             Event Manager
    websocket.ts          cliente WebSocket
  effects/
    text-animation.ts     texto animado con GSAP
    image-float.ts        imágenes flotantes
    particles.ts          sistema de partículas
    explosion.ts          explosión con luz
    model-actor.ts        modelos GLB / fallback
  config/
    modes.ts              modos visuales
  main.ts                 punto de entrada
server/
  api-server.js           servidor WebSocket/HTTP de ejemplo
public/assets/            vídeos, imágenes y modelos
```

---

## 9. Build para producción

```bash
pnpm run build
```

Sirve la carpeta `dist/` con `pnpm run preview` o con cualquier servidor estático.

Configura la URL del WebSocket en `.env`:

```env
VITE_WS_URL=ws://TU_SERVIDOR:8787
```

---

## 10. Conectar a TikTok / OBS en el futuro

Este proyecto **no incluye** esa integración. Para conectarlo:

1. Crea un bridge que escuche eventos de TikTok (gifts, follows, likes) u OBS (cambios de escena).
2. Transforma esos eventos en el JSON de este motor.
3. Envíalos por WebSocket o HTTP a `http://localhost:8787/event`.

Ejemplo conceptual:

```
TikTok Live API  →  Tu Bridge  →  POST /event  →  Visual Reactive Engine
```

---

## 11. Rendimiento

- El motor limita `devicePixelRatio` a 2.
- Usa `requestAnimationFrame` con delta time capado.
- Los efectos se destruyen automáticamente al terminar.
- Para mantener 60 FPS: usa modelos bajos en polígonos, texturas comprimidas y pocos efectos simultáneos.

---

## 12. Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `pnpm run dev` | Modo desarrollo |
| `pnpm run build` | Build de producción |
| `pnpm run preview` | Previsualizar build |
| `pnpm run api` | Levantar API de eventos |
| `pnpm run demo` | Alias de `pnpm run api` |

---

Hecho con TypeScript, Vite, Three.js y GSAP.
