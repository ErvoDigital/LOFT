import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";

// Yjs updates are binary; the realtime service's wire protocol is JSON text,
// so binary payloads travel as base64 in both directions.
export function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function fromBase64(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// A minimal Yjs "provider" riding the app's single existing Socket.io
// connection instead of a separate y-websocket server — the whole app is
// built around one Socket.io instance (see SocketContext/sockets/io.js), so
// this reuses it rather than fragmenting auth/deployment with a second
// realtime service. Yjs's own docs explicitly support writing a custom
// provider for exactly this "reuse an existing transport" case.
//
// Exposes `.awareness` (a real y-protocols Awareness bound to the caller's
// Y.Doc) because Tiptap's CollaborationCaret extension only needs that one
// property off whatever "provider" object it's given.
export class SocketYjsProvider {
  constructor(socket, documentId, ydoc, user) {
    this.socket = socket;
    this.documentId = documentId;
    this.ydoc = ydoc;
    this.awareness = new Awareness(ydoc);
    this.awareness.setLocalStateField("user", { id: user.id, name: user.name, color: user.avatarColor });
    this.destroyed = false;
    this.synced = false;
    this._pendingConnects = new Set();

    // Tag every locally-applied update with `this` as its origin so applying
    // a remote update (which we also tag with `this`) doesn't get echoed
    // straight back out to the server that just sent it.
    this._onLocalUpdate = (update, origin) => {
      if (origin === this) return;
      this.socket.emit("document:update", { documentId: this.documentId, update: toBase64(update) });
    };
    this._onLocalAwareness = ({ added, updated, removed }) => {
      const changed = added.concat(updated, removed);
      if (!changed.length) return;
      this.socket.emit("document:awareness", {
        documentId: this.documentId,
        update: toBase64(encodeAwarenessUpdate(this.awareness, changed)),
      });
    };
    this._onRemoteUpdate = ({ update }) => Y.applyUpdate(this.ydoc, fromBase64(update), this);
    this._onRemoteAwareness = ({ update }) => applyAwarenessUpdate(this.awareness, fromBase64(update), this);
    this._onAwarenessRequest = () => {
      const state = this.awareness.getLocalState();
      if (!state) return;
      this.socket.emit("document:awareness", {
        documentId: this.documentId,
        update: toBase64(encodeAwarenessUpdate(this.awareness, [this.ydoc.clientID])),
      });
    };
    // The shared socket auto-reconnects on a network blip, but the server's
    // room membership doesn't survive that — without an explicit resync,
    // sync would silently stop for the rest of the session. Yjs updates are
    // CRDT-mergeable, so a full resync on reconnect is always safe.
    this._onSocketReconnect = () => {
      if (!this.synced) return; // The initial connect() waits for this event.
      this.connect().then(() => {
        if (!this.destroyed) this.socket.emit("document:update", { documentId: this.documentId, update: toBase64(Y.encodeStateAsUpdate(this.ydoc)) });
      }).catch(() => {});
    };

    ydoc.on("update", this._onLocalUpdate);
    this.awareness.on("update", this._onLocalAwareness);
    socket.on("document:update", this._onRemoteUpdate);
    socket.on("document:awareness", this._onRemoteAwareness);
    socket.on("document:awareness-request", this._onAwarenessRequest);
    socket.on("connect", this._onSocketReconnect);
  }

  connect() {
    return new Promise((resolve, reject) => {
      let timer;
      const cleanup = () => {
        clearTimeout(timer);
        this.socket.off("connect", join);
        this._pendingConnects.delete(cancel);
      };
      const cancel = () => { cleanup(); reject(new Error("Document closed")); };
      const join = () => {
        cleanup();
        if (this.destroyed) return reject(new Error("Document closed"));
        this.socket.emit("document:join", this.documentId, (res) => {
          if (this.destroyed) return reject(new Error("Document closed"));
          if (res?.error) return reject(new Error(res.error));
          try {
            Y.applyUpdate(this.ydoc, fromBase64(res.update), this);
            this.synced = true;
            // Updates made offline may never have reached the server. Merge
            // our full state after every authorized join, including reconnects.
            this.socket.emit("document:update", { documentId: this.documentId, update: toBase64(Y.encodeStateAsUpdate(this.ydoc)) });
            resolve(res);
          } catch {
            reject(new Error("Couldn't sync this document. Please reopen it."));
          }
        });
      };
      if (this.socket.connected) join();
      else {
        this._pendingConnects.add(cancel);
        this.socket.on("connect", join);
        timer = setTimeout(() => { cleanup(); reject(new Error("Live connection unavailable. Please reopen the document when you're connected.")); }, 15000);
      }
    });
  }

  destroy() {
    this.destroyed = true;
    this._pendingConnects.forEach((cancel) => cancel());
    removeAwarenessStates(this.awareness, [this.ydoc.clientID], "provider destroyed");
    this.ydoc.off("update", this._onLocalUpdate);
    this.awareness.off("update", this._onLocalAwareness);
    this.socket.off("document:update", this._onRemoteUpdate);
    this.socket.off("document:awareness", this._onRemoteAwareness);
    this.socket.off("document:awareness-request", this._onAwarenessRequest);
    this.socket.off("connect", this._onSocketReconnect);
    this.socket.emit("document:leave", this.documentId);
    this.awareness.destroy();
  }
}
