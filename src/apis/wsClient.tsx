// src/raspi/wsClient.ts
type Listener = (msg: any) => void;

export class RaspiWS {
  private url: string;
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private maxDelay = 8000;
  private listeners: Record<string, Listener[]> = {};
  public connected = false;

  constructor(url: string) {
    this.url = url;
  }

  on(type: string, fn: Listener) {
    (this.listeners[type] ||= []).push(fn);
    return () => {
      this.listeners[type] = (this.listeners[type] || []).filter(
        (f) => f !== fn
      );
    };
  }

  private emit(type: string, payload: any) {
    (this.listeners[type] || []).forEach((fn) => fn(payload));
  }

  connect() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.connected = true;
      this.emit("open", null);
      this.reconnectDelay = 1000;
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const t = msg?.type;
        if (t) this.emit(t, msg);
      } catch {}
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.emit("close", null);
      // auto-reconnect
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay);
    };

    this.ws.onerror = () => {
      // let onclose manage reconnects
    };
  }

  close() {
    try {
      this.ws?.close();
    } catch {}
    this.ws = null;
    this.connected = false;
  }

  send(obj: any) {
    const s = JSON.stringify(obj);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(s);
    }
  }

  requestCombo(level?: string) {
    this.send({ type: "request_combo", level });
  }

  reportResult(payload: any) {
    this.send({ type: "result", payload });
  }
}
