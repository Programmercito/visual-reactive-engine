import { WebSocketServer } from 'ws';
import http from 'http';

const PORT = process.env.PORT || 8787;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/event') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const event = JSON.parse(body);
        broadcast(event);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, clients: wss.clients.size }));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocketServer({ server });

function broadcast(event) {
  const msg = JSON.stringify(event);
  let sent = 0;
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(msg);
      sent++;
    }
  }
  console.log(`[broadcast] ${event.action} -> ${sent} clients`);
}

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || 'unknown';
  console.log(`[ws] client connected from ${ip} — ${ua}`);

  ws.on('message', (data) => {
    try {
      const event = JSON.parse(data.toString());
      broadcast(event);
    } catch (err) {
      console.error('[ws] invalid message', err);
    }
  });

  ws.on('close', () => console.log('[ws] client disconnected'));
});

server.listen(PORT, () => {
  console.log(`Visual Reactive API running on http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
  console.log(`\nExample POST:`);
  console.log(`  curl -X POST http://localhost:${PORT}/event -H "Content-Type: application/json" -d "{\\"action\\":\\"text\\",\\"text\\":\\"Hola\\"}"`);
});
