/**
 * CopyGuard service worker — minimal.
 * Auto-connects to backend, sends heartbeats, reconnects on disconnect.
 * Queues events when WS is down, flushes on reconnect.
 *
 * === SETUP ===
 * Change BACKEND_URL below to your Render URL after deploying.
 * The extension will automatically use wss:// for the WebSocket.
 */

// ============================================
//  CHANGE THIS to your Render URL after deploy
// ============================================
const BACKEND_URL = "copyguard-backend-production-f05e.up.railway.app";
// ============================================
//  Example: "copyguard-backend.onrender.com"
//  (no http://, no ws://, no trailing slash)
// ============================================

// Auto-detect ws:// vs wss://
const WS_URL = BACKEND_URL.includes("localhost")
  ? `ws://${BACKEND_URL}/ws/user`
  : `wss://${BACKEND_URL}/ws/user`;

const HEARTBEAT_INTERVAL = 10000;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

// NOTE: Blocking copy/paste is done in the content script and works
// even if this WebSocket never connects.  The WS is only for sending
// events to the admin dashboard.

let ws = null;
let heartbeatTimer = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let eventQueue = [];

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  console.log("[CopyGuard] Connecting to", WS_URL);
  try {
    ws = new WebSocket(WS_URL);
  } catch (e) {
    console.error("[CopyGuard] Connect failed:", e);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log("[CopyGuard] WebSocket connected");
    reconnectAttempts = 0;
    chrome.storage.local.set({ connected: true });
    startHeartbeat();
    flushQueue();
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "connected") {
        chrome.storage.local.set({ user_id: msg.user_id, user_name: msg.name });
        console.log("[CopyGuard] Server ack, user:", msg.name);
      }
    } catch (e) {}
  };

  ws.onclose = () => {
    console.log("[CopyGuard] WebSocket closed");
    chrome.storage.local.set({ connected: false });
    stopHeartbeat();
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = (e) => {
    console.error("[CopyGuard] WebSocket error");
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = RECONNECT_DELAYS[Math.min(reconnectAttempts, RECONNECT_DELAYS.length - 1)];
  reconnectAttempts++;
  console.log("[CopyGuard] Reconnecting in", delay, "ms");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "heartbeat" }));
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

function flushQueue() {
  if (eventQueue.length === 0) return;
  console.log("[CopyGuard] Flushing", eventQueue.length, "queued events");
  while (eventQueue.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
    const event = eventQueue.shift();
    ws.send(JSON.stringify(event));
  }
}

function sendEvent(eventType) {
  const payload = { type: "security_event", event: eventType };
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
    console.log("[CopyGuard] Sent event:", eventType);
  } else {
    eventQueue.push(payload);
    if (eventQueue.length > 50) eventQueue.shift();
    console.log("[CopyGuard] Queued event (WS not ready):", eventType);
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      connect();
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "security_event") {
    sendEvent(msg.event);
  }
  if (msg.type === "toggle") {
    // Forward toggle state to backend so admin sees it
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "toggle", enabled: msg.enabled }));
      console.log("[CopyGuard] Sent toggle:", msg.enabled);
    }
  }
  if (msg.type === "get_status") {
    sendResponse({ connected: ws && ws.readyState === WebSocket.OPEN });
  }
  return true;
});

connect();

chrome.runtime.onStartup.addListener(() => {
  console.log("[CopyGuard] onStartup — reconnecting");
  connect();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "reconnect") {
    connect();
  }
  return true;
});
