# CopyGuard Build Phases

Tracking the phase-by-phase construction of the system.

## Progress

- [x] **Phase 1 — Backend Foundation**
  - FastAPI app factory with lifespan logging
  - `config.py` (pydantic-settings, env-driven, no hardcoded secrets)
  - `database.py` (SQLAlchemy 2.0 engine, sessions, graceful DB probe)
  - `logging_config.py` (structured logging)
  - `main.py` (CORS, global exception handler, `/health`, `/health/db`, `/`)
  - `requirements.txt`, `.env.example`, `.gitignore`, package skeleton
  - Verified: server boots, health endpoints respond, DB-down handled gracefully

- [x] **Phase 2 — PostgreSQL Models**
  - `docker-compose.yml` (PostgreSQL 16, healthcheck, persistent volume)
  - SQLAlchemy 2.0 typed models: `users`, `connections`, `security_events`, `protection_settings`
  - Native PG enum types: `user_role`, `user_status`, `security_event_type`, `settings_scope`
  - Foreign keys with `ON DELETE CASCADE`
  - Indexes: `email` (unique), `status`, `last_seen`, `user_id`, `timestamp`, `event_type`, `connected_at`, composite `(user_id, timestamp)`, unique `(scope, user_id)`
  - Alembic configured (URL from settings, no hardcoded secrets) + initial migration
  - `security.py` password hashing (bcrypt direct, no passlib compat issues)
  - `scripts/seed_db.py` idempotent seeder (global policy + admin user)
  - Verified: 4 tables created, all enums/indexes/FKs confirmed, `/health/db` → connected

- [x] **Phase 3 — Authentication**
  - JWT service (HS256, access + refresh tokens, typed claims)
  - bcrypt password hashing (rounds=12)
  - `get_current_user` / `require_admin` dependencies (identity from JWT only)
  - Auth routes: login (rate-limited 5/min), register, refresh, me
  - User routes: list (paginated/filter/search), detail (+stats), events
  - Events + settings routes (admin-only writes)
  - Slowapi rate limiter wired in
  - 21-check E2E test — all pass

- [x] **Phase 4 — User WebSocket**
  - `ConnectionManager` — tracks user + admin WS connections, multi-tab support
  - `/ws/user` endpoint — JWT auth via query param, heartbeat, security events
  - Persists connections + security events to DB
  - Broadcasts presence + security events to admins
  - 15-check E2E test — all pass

- [x] **Phase 5 — Heartbeat / Presence**
  - Background sweep loop (configurable interval + timeout)
  - Detects stale connections (no heartbeat within timeout)
  - Force-closes stale connections, marks users offline
  - Multi-tab aware: user stays online if any tab remains active
  - 10-check E2E test — all pass

- [x] **Phase 6 — Admin WebSocket**
  - `/ws/admin` endpoint — admin-only JWT auth (4003 for non-admins)
  - Sends initial online-users snapshot on connect
  - Streams presence + security events in real time
  - Ping/pong + snapshot_request support
  - 15-check E2E test — all pass

- [x] **Phase 7 — Admin Dashboard**
  - Next.js 16 + React 19 + TypeScript + Tailwind CSS v4
  - Login page with JWT auth
  - Dashboard: stats cards, live users table, activity feed, settings panel
  - Real-time WebSocket hook with exponential backoff reconnect
  - Dark/light mode (system preference), glassmorphism, responsive
  - Toast notifications, user detail modal, search/filter
  - Verified: builds cleanly, all pages generated

- [x] **Phase 8 — Chrome Extension Shell**
  - Manifest V3 with service worker, content scripts, popup
  - Service worker: auth, WS management, heartbeat, reconnect, event queuing
  - Popup: login, connection status, protection state display

- [x] **Phase 9 — Copy/Cut/Paste Protection**
  - Content script blocks: copy, cut, paste, Ctrl+C/X/V, context menu, selection, drag/drop
  - Configurable via protection settings (cached locally)
  - CSS-based selection prevention (non-input elements only)
  - Reports blocked actions as security events (metadata only)

- [x] **Phase 10 — Security Event Reporting**
  - Content script → service worker → WebSocket → backend → admin WS
  - Events queued locally when offline, flushed on reconnect
  - 9 event types: COPY_ATTEMPT, CUT_ATTEMPT, PASTE_ATTEMPT, CTRL_C/X/V_BLOCKED, RIGHT_CLICK_BLOCKED, TEXT_SELECTION_BLOCKED, DRAG_DROP_BLOCKED

- [x] **Phase 11 — Protection Settings**
  - Global policy in DB, served to extension on WS connect + on settings_request
  - Admin dashboard settings panel with toggles (PUT /settings)
  - Settings cached in chrome.storage.local for offline operation
  - Broadcast to all tabs on update

- [x] **Phase 12 — Reconnect / Offline Handling**
  - Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max
  - Event queue (max 100) flushed on reconnect
  - Protection continues using cached settings when offline
  - Heartbeat sent every 10s when connected

- [x] **Phase 13 — Testing**
  - `test_auth_e2e.py` — 21 auth + protected route checks
  - `test_ws_user_e2e.py` — 15 user WebSocket checks
  - `test_presence_sweep.py` — 10 presence sweep checks
  - `test_ws_admin_e2e.py` — 15 admin WebSocket checks
  - `simulate_users.py` — demo script (10 users, events, disconnects)
  - Total: 61 automated checks, all passing

- [x] **Phase 14 — Documentation**
  - Comprehensive README with architecture, setup, usage
  - PHASES.md progress tracker
  - .env.example with all variables documented
  - Known browser limitations documented
