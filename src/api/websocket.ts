import { EventManager, type APIEvent } from './events';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8787';

export class APISocket {
  private ws: WebSocket | null = null;
  private reconnectTimer = 0;

  constructor(private events: EventManager) {}

  connect(): void {
    try {
      this.ws = new WebSocket(WS_URL);
      this.ws.onopen = () => {
        clearTimeout(this.reconnectTimer);
      };
      this.ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data) as APIEvent;
          this.events.process(data);
        } catch (err) {
          console.error('Invalid event payload', msg.data, err);
        }
      };
      this.ws.onclose = () => {
        this.scheduleReconnect();
      };
      this.ws.onerror = () => {
        this.scheduleReconnect();
      };
    } catch (err) {
      console.error('WebSocket connection failed', err);
      this.scheduleReconnect();
    }
  }

  send(event: APIEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  private scheduleReconnect(): void {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => this.connect(), 3000);
  }
}
