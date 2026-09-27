"""CopyGuard — minimal backend.

No database, no JWT, no user accounts.  Just:
  - /ws/user  : anonymous extension connections (presence + copy/paste events)
  - /ws/admin : admin dashboard (password auth via query param)
  - POST /api/login : simple password check -> session token
"""

import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s")
log = logging.getLogger("copyguard")

# Read admin password from environment (set on Render), fallback for local dev
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
HEARTBEAT_TIMEOUT = 30  # seconds before marking stale

app = FastAPI(title="CopyGuard")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------

# user_id -> { "id", "name", "connected_at", "last_heartbeat", "ws" }
online_users: dict = {}

# admin session tokens (set of strings)
admin_sessions: set = set()

# active admin websockets (list)
admin_wss: list = []

# recent activity feed (list of dicts, newest first, max 200)
activity_feed: list = []


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def add_activity(item: dict):
    activity_feed.insert(0, item)
    del activity_feed[200:]


async def broadcast_to_admins(message: dict):
    """Send a message to all connected admin dashboards."""
    dead = []
    for ws in admin_wss:
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in admin_wss:
            admin_wss.remove(ws)


# ---------------------------------------------------------------------------
# REST: simple admin login
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    password: str


@app.post("/api/login")
async def login(req: LoginRequest):
    if req.password != ADMIN_PASSWORD:
        log.info("AUTH_FAILURE: bad admin password")
        return {"error": "wrong password"}
    token = uuid.uuid4().hex
    admin_sessions.add(token)
    log.info("ADMIN_LOGIN: session=%s", token[:8])
    return {"token": token}


@app.get("/api/verify")
async def verify(token: str):
    return {"valid": token in admin_sessions}


# ---------------------------------------------------------------------------
# WebSocket: extension (anonymous, auto-connects)
# ---------------------------------------------------------------------------

@app.websocket("/ws/user")
async def ws_user(ws: WebSocket, name: str = ""):
    await ws.accept()
    user_id = uuid.uuid4().hex[:8]
    # Use the name provided by the extension, or fall back to User-xxxx
    user_name = name.strip() if name and name.strip() else f"User-{user_id}"

    online_users[user_id] = {
        "id": user_id,
        "name": user_name,
        "connected_at": now_iso(),
        "last_heartbeat": time.monotonic(),
        "ws": ws,
        "protection_enabled": True,  # default ON
    }
    log.info("USER_CONNECTED id=%s name=%s (online=%s)", user_id, user_name, len(online_users))

    # Notify admins
    await broadcast_to_admins({
        "type": "presence",
        "event": "USER_CONNECTED",
        "user_id": user_id,
        "name": user_name,
        "status": "online",
        "protection_enabled": True,
        "timestamp": now_iso(),
    })
    add_activity({
        "type": "presence",
        "event": "USER_CONNECTED",
        "user_id": user_id,
        "name": user_name,
        "timestamp": now_iso(),
    })

    # Send connected ack to the extension
    await ws.send_text(json.dumps({
        "type": "connected",
        "user_id": user_id,
        "name": user_name,
    }))

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)

            if msg.get("type") == "heartbeat":
                if user_id in online_users:
                    online_users[user_id]["last_heartbeat"] = time.monotonic()

            elif msg.get("type") == "toggle":
                # User enabled/disabled protection from popup
                enabled = msg.get("enabled", True)
                if user_id in online_users:
                    online_users[user_id]["protection_enabled"] = enabled
                state = "PROTECTION_ENABLED" if enabled else "PROTECTION_DISABLED"
                log.info("TOGGLE user=%s enabled=%s", user_name, enabled)
                await broadcast_to_admins({
                    "type": "presence",
                    "event": state,
                    "user_id": user_id,
                    "name": user_name,
                    "status": "online",
                    "protection_enabled": enabled,
                    "timestamp": now_iso(),
                })
                add_activity({
                    "type": "presence",
                    "event": state,
                    "user_id": user_id,
                    "name": user_name,
                    "timestamp": now_iso(),
                })

            elif msg.get("type") == "security_event":
                event = msg.get("event", "UNKNOWN")
                # Broadcast to admins
                await broadcast_to_admins({
                    "type": "security_event",
                    "event": event,
                    "user_id": user_id,
                    "name": user_name,
                    "timestamp": now_iso(),
                })
                add_activity({
                    "type": "security_event",
                    "event": event,
                    "user_id": user_id,
                    "name": user_name,
                    "timestamp": now_iso(),
                })
                log.info("SECURITY_EVENT user=%s event=%s", user_name, event)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        log.error("WS user error: %s", e)
    finally:
        online_users.pop(user_id, None)
        log.info("USER_DISCONNECTED id=%s (online=%s)", user_id, len(online_users))
        await broadcast_to_admins({
            "type": "presence",
            "event": "USER_DISCONNECTED",
            "user_id": user_id,
            "name": user_name,
            "status": "offline",
            "timestamp": now_iso(),
        })
        add_activity({
            "type": "presence",
            "event": "USER_DISCONNECTED",
            "user_id": user_id,
            "name": user_name,
            "timestamp": now_iso(),
        })


# ---------------------------------------------------------------------------
# WebSocket: admin dashboard
# ---------------------------------------------------------------------------

@app.websocket("/ws/admin")
async def ws_admin(ws: WebSocket, token: str = ""):
    if token not in admin_sessions:
        await ws.close(code=4001, reason="Not authenticated")
        return

    await ws.accept()
    admin_wss.append(ws)
    log.info("ADMIN_CONNECTED (admins=%s)", len(admin_wss))

    # Send snapshot of currently online users
    await ws.send_text(json.dumps({
        "type": "snapshot",
        "users": [
            {
                "id": u["id"],
                "name": u["name"],
                "connected_at": u["connected_at"],
                "protection_enabled": u.get("protection_enabled", True),
            }
            for u in online_users.values()
        ],
        "activity": activity_feed[:50],
    }))

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            if msg.get("type") == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        log.error("WS admin error: %s", e)
    finally:
        if ws in admin_wss:
            admin_wss.remove(ws)
        log.info("ADMIN_DISCONNECTED (admins=%s)", len(admin_wss))


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Full health check — used by Render for uptime monitoring."""
    return {
        "status": "ok",
        "service": "copyguard",
        "online_users": len(online_users),
        "connected_admins": len(admin_wss),
        "total_events": len(activity_feed),
        "timestamp": now_iso(),
    }


@app.get("/")
async def root():
    """Root info endpoint."""
    return {
        "service": "CopyGuard",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "login": "POST /api/login",
            "ws_user": "/ws/user",
            "ws_admin": "/ws/admin",
        },
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
