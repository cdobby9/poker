import { CONFIG } from "./config";

let ws = null;
let onMessageCb = null;

export function connectWS({ displayName }) {
  ws = new WebSocket(CONFIG.WS_URL);

  ws.onopen = () => {
    console.log("[WS] connected");

    send("AUTH", {
      token: "dev",        // dev only
      displayName,
    });

    send("JOIN_TABLE", {
      tableId: CONFIG.DEFAULT_TABLE_ID,
    });
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (onMessageCb) onMessageCb(msg);
    } catch (err) {
      console.error("[WS] bad message", e.data);
    }
  };

  ws.onerror = (e) => console.error("[WS] error", e);
  ws.onclose = () => console.log("[WS] closed");
}

export function onWSMessage(cb) {
  onMessageCb = cb;
}

export function send(type, payload = {}, requestId) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const msg = { type, payload };
  if (requestId) msg.requestId = requestId;

  ws.send(JSON.stringify(msg));
}
