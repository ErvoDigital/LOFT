// A minimal socket.io-client-compatible wrapper around a plain WebSocket,
// exposing only the surface this app actually uses (on/off/emit with an
// optional ack, plus "connect"/"disconnect" lifecycle events) — so the many
// components built against the old socket.io object keep working unchanged
// against the realtime service's raw-WebSocket protocol.
export class SocketLike {
  constructor(url, token) {
    this.url = url;
    this.token = token;
    this.connected = false;
    this._listeners = new Map();
    this._pendingAcks = new Map();
    this._nextAckId = 1;
    this._closed = false;
    this._retry = 0;
    this._reconnectTimer = null;
    this._ws = null;
    this._open();
  }

  _open() {
    if (this._closed) return;
    const base = this.url.replace(/^http/, "ws").replace(/\/$/, "");
    const ws = new WebSocket(`${base}/ws?token=${encodeURIComponent(this.token)}`);
    this._ws = ws;

    ws.onopen = () => {
      this.connected = true;
      this._retry = 0;
      this._fire("connect");
    };
    ws.onclose = () => {
      this.connected = false;
      this._fire("disconnect");
      if (this._closed) return;
      const delay = Math.min(1000 * 2 ** this._retry++, 15000);
      this._reconnectTimer = setTimeout(() => this._open(), delay);
    };
    ws.onerror = () => {};
    ws.onmessage = (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (msg.ackId != null) {
        const cb = this._pendingAcks.get(msg.ackId);
        if (cb) {
          this._pendingAcks.delete(msg.ackId);
          cb(msg.data);
        }
        return;
      }
      if (msg.event) this._fire(msg.event, msg.data);
    };
  }

  _fire(event, data) {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const fn of Array.from(set)) fn(data);
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
  }

  off(event, fn) {
    this._listeners.get(event)?.delete(fn);
  }

  emit(event, data, ack) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    const msg = { event, data };
    if (ack) {
      const id = this._nextAckId++;
      msg.id = id;
      this._pendingAcks.set(id, ack);
    }
    this._ws.send(JSON.stringify(msg));
  }

  disconnect() {
    this._closed = true;
    clearTimeout(this._reconnectTimer);
    this._ws?.close();
  }
}
