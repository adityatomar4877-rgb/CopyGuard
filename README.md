# CopyGuard

> Browser copy/cut/paste protection + real-time admin monitoring dashboard.

CopyGuard is a full-stack system that protects webpages from normal
copy/cut/paste interactions while giving an administrator a real-time
dashboard to monitor connected users, connection status, and security
events.

```
Chrome Extension ──► Real WebSocket ──► FastAPI Backend ──► PostgreSQL
                                                       │
                                          Real Admin WebSocket
                                                       │
                                               Next.js Dashboard
```

---

## Architecture

```
copyguard/
├── extension/              # Chrome Manifest V3 extension
│   ├── manifest.json
│   ├── background/
│   │   └── service-worker.js    # WS management, auth, heartbeat, reconnect
│   ├── content/
│   │   ├── protection.js        # Copy/cut/paste blocking + event reporting
│   │   └── protection.css
│   ├── popup/
│   │   ├── popup.html           # Login + status UI
│   │   ├── popup.css
│   │   └── popup.js
│   └── icons/
├── backend/                # FastAPI + WebSockets + PostgreSQL
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── logging_config.py
│   │   ├── limiter.py
│   │   ├── websocket_manager.py
│   │   ├── auth/dependencies.py
│   │   ├── models/              # User, Connection, SecurityEvent, ProtectionSettings
│   │   ├── schemas/             # Pydantic request/response models
│   │   ├── routes/              # auth, users, events, settings, ws_user, ws_admin
│   │   └── services/            # jwt_service, security, presence
│   ├── alembic/                 # Database migrations
│   ├── scripts/                 # seed, simulate, test
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── admin/                  # Next.js admin dashboard
│   ├── app/
│   │   ├── page.tsx             # Dashboard (stats, users, activity, settings)
│   │   ├── login/page.tsx       # Admin login
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── lib/
│   │   ├── api.ts               # API client + auth token management
│   │   └── types.ts             # TypeScript types
│   ├── hooks/
│   │   └── useAdminWs.ts         # WebSocket hook (reconnect, presence, events)
│   └── package.json
├── docker-compose.yml
├── PHASES.md
└── README.md
```

---

## Requirements

- Python 3.12+
- Node.js 22+
- Docker Desktop (for PostgreSQL)
- Chrome/Chromium (for the extension)

---

## Installation & Setup

### 1. Start PostgreSQL

```bash
cd copyguard
docker compose up -d postgres
```

### 2. Backend Setup

```bash
cd copyguard/backend

# Create virtual environment
uv venv --python 3.12 .venv      # or: python -m venv .venv

# Install dependencies
uv pip install -r requirements.txt   # or: pip install -r requirements.txt

# Configure environment
cp .env.example .env

# Run database migrations
python -m alembic upgrade head

# Seed the database (creates admin + global protection policy)
python scripts/seed_db.py

# Start the server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify:
- http://localhost:8000/health → `{"status":"ok"}`
- http://localhost:8000/health/db → `{"status":"ok","database":"connected"}`
- http://localhost:8000/docs → Swagger UI

### 3. Admin Dashboard Setup

```bash
cd copyguard/admin

# Install dependencies
npm install

# Start dev server
npm run dev
```

Visit http://localhost:3000 → redirects to /login

### 4. Load the Chrome Extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `copyguard/extension` folder
5. The CopyGuard icon appears in the toolbar

### 5. Using the Extension

1. Click the CopyGuard icon in the toolbar
2. Login with `admin@copyguard.com` / `Admin@12345`
3. The popup shows "🟢 Connected" and protection status
4. Navigate to any webpage — copy/cut/paste are now blocked
5. Security events appear in the admin dashboard in real time

---

## Default Admin Credentials (dev only)

| Field | Value |
|-------|-------|
| Email | `admin@copyguard.com` |
| Password | `Admin@12345` |

Override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars or
`--email` / `--password` flags when running `seed_db.py`.
**Change these in production.**

---

## Environment Variables

See [`backend/.env.example`](backend/.env.example) for the full list.

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql+psycopg2://copyguard:copyguard@localhost:5432/copyguard` | PostgreSQL DSN |
| `JWT_SECRET` | `change-me...` | Secret for signing JWTs (set a strong value) |
| `CORS_ORIGINS` | `http://localhost:3000,chrome-extension://*` | Allowed CORS origins |
| `HEARTBEAT_INTERVAL_SECONDS` | `10` | Expected client heartbeat interval |
| `HEARTBEAT_TIMEOUT_SECONDS` | `30` | Timeout before marking a user offline |
| `WS_USER_PATH` | `/ws/user` | Extension WebSocket path |
| `WS_ADMIN_PATH` | `/ws/admin` | Admin WebSocket path |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL (admin dashboard) |

---

## API Endpoints

### REST (all under `/api/v1`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/register` | none | Register a user, returns JWT |
| POST | `/auth/login` | none (5/min rate limit) | Login, returns JWT |
| POST | `/auth/refresh` | refresh token | Mint new access token |
| GET | `/auth/me` | user | Current user profile |
| GET | `/users` | admin | List users (paginated, filter, search) |
| GET | `/users/{id}` | admin | User detail + event stats |
| GET | `/users/{id}/events` | admin | Security events for a user |
| GET | `/events` | admin | Global recent events |
| GET | `/settings` | user | Effective protection policy |
| PUT | `/settings` | admin | Update global protection policy |

### WebSocket

| Path | Auth | Purpose |
|------|------|---------|
| `/ws/user` | JWT (query param `token`) | Extension connection |
| `/ws/admin` | JWT admin (query param `token`) | Dashboard real-time feed |

### User WS Messages

Client → Server:
```json
{"type": "heartbeat"}
{"type": "security_event", "event": "COPY_ATTEMPT", "metadata": {}}
{"type": "settings_request"}
{"type": "client_info", "browser": "Chrome", "os": "Windows"}
```

Server → Client:
```json
{"type": "connected", "conn_id": "...", "user_id": 1, "settings": {...}}
{"type": "settings", "copy_enabled": true, ...}
{"type": "error", "detail": "..."}
```

### Admin WS Messages

Server → Client:
```json
{"type": "connected", "admin_id": 1, ...}
{"type": "snapshot", "online_user_ids": [1, 2, 3]}
{"type": "presence", "event": "USER_CONNECTED", "user_id": 4, "status": "online"}
{"type": "security_event", "event": "COPY_ATTEMPT", "user_id": 4, ...}
```

---

## Demo / Test Mode

### Run the simulation script

```bash
cd copyguard/backend
python scripts/simulate_users.py --users 10 --duration 60
```

This registers 10 test users, connects them via WebSocket, sends
heartbeats and random security events, then disconnects them. Open the
admin dashboard to watch them appear/disappear in real time.

### Run automated tests

```bash
cd copyguard/backend

python scripts/test_auth_e2e.py         # 21 checks
python scripts/test_ws_user_e2e.py       # 15 checks
python scripts/test_presence_sweep.py    # 10 checks
python scripts/test_ws_admin_e2e.py      # 15 checks
```

Total: 61 automated checks, all passing.

---

## Security Events

9 event types are tracked (metadata only, never clipboard content):

| Event | Trigger |
|-------|---------|
| `COPY_ATTEMPT` | `copy` event blocked |
| `CUT_ATTEMPT` | `cut` event blocked |
| `PASTE_ATTEMPT` | `paste` event blocked |
| `CTRL_C_BLOCKED` | Ctrl+C / Cmd+C blocked |
| `CTRL_X_BLOCKED` | Ctrl+X / Cmd+X blocked |
| `CTRL_V_BLOCKED` | Ctrl+V / Cmd+V blocked |
| `RIGHT_CLICK_BLOCKED` | Context menu blocked |
| `TEXT_SELECTION_BLOCKED` | Text selection blocked |
| `DRAG_DROP_BLOCKED` | Drag/drop blocked |

---

## Database Schema

### Tables

| Table | Purpose | Key indexes |
|-------|---------|-------------|
| `users` | users + admins | email (unique), status, last_seen |
| `connections` | WebSocket sessions | user_id (FK CASCADE), connected_at |
| `security_events` | blocked-action metadata | user_id, timestamp, event_type, composite (user_id,timestamp) |
| `protection_settings` | global/per-user policy | unique (scope, user_id) |

---

## Security Considerations

- **JWT auth**: HS256, 30min access tokens, 7-day refresh tokens
- **Password hashing**: bcrypt (rounds=12)
- **Rate limiting**: login limited to 5/minute per IP
- **CORS**: configurable allowed origins
- **No user enumeration**: identical 401 for wrong email vs wrong password
- **Admin separation**: registration creates `role=user`; admins seeded via CLI
- **WebSocket auth**: JWT verified before WS accepted; no `?user_id=` trust
- **No secrets in code**: all via `.env` / `config.py`
- **SQL injection**: prevented via SQLAlchemy ORM
- **Input validation**: Pydantic schemas on all endpoints

---

## Privacy

CopyGuard does **not** collect clipboard contents, passwords, form values,
page contents, or keystrokes. It only records event *metadata* (event type,
timestamp) and basic connection state.

---

## Known Browser Limitations

Browser extensions can block normal copy/paste interactions, but cannot
stop determined users from using:
- Developer Tools
- Screenshots / OCR
- Accessibility features
- Alternate browsers
- Disabling/removing the extension
- Direct API/network access

CopyGuard is **copy/paste protection and monitoring**, not absolute DRM.

---

## Production Deployment

1. Set `APP_ENV=production` in `.env`
2. Set a strong `JWT_SECRET` (at least 32 random characters)
3. Change the default admin password
4. Set `CORS_ORIGINS` to your actual frontend URLs
5. Set `DB_ECHO=false`
6. Use HTTPS/WSS (reverse proxy with TLS)
7. Use `docker compose up -d` to run both PostgreSQL + backend
8. Build the admin dashboard: `cd admin && npm run build && npm start`
9. Load the extension in production Chrome via group policy or CRX
