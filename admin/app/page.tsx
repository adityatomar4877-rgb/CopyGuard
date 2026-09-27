"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface OnlineUser {
  id: string;
  name: string;
  connected_at: string;
  protection_enabled?: boolean;
}

interface ActivityItem {
  type: "presence" | "security_event";
  event: string;
  user_id: string;
  name: string;
  timestamp: string;
}

interface UserLog {
  event: string;
  timestamp: string;
  protection_enabled: boolean;
}

const EVENT_ICONS: Record<string, string> = {
  USER_CONNECTED: "🟢",
  USER_DISCONNECTED: "🔴",
  COPY_ATTEMPT: "📋",
  CUT_ATTEMPT: "✂️",
  PASTE_ATTEMPT: "📝",
  COPY_ALLOWED: "✅",
  CUT_ALLOWED: "✅",
  PASTE_ALLOWED: "✅",
  PROTECTION_ENABLED: "🟢",
  PROTECTION_DISABLED: "🟡",
};

export default function Dashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userLogs, setUserLogs] = useState<UserLog[]>([]);
  const [userDetail, setUserDetail] = useState<{ name: string; protection_enabled: boolean; connected_at: string } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);

  const addActivity = useCallback((item: ActivityItem) => {
    setActivities((prev) => [item, ...prev].slice(0, 100));
  }, []);

  const connectWs = useCallback(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/login"); return; }

    const ws = new WebSocket(`wss://copyguard-backend-production-f05e.up.railway.app/ws/admin?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => { setConnected(true); attemptsRef.current = 0; };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "snapshot") {
        setOnlineUsers(msg.users);
        if (msg.activity) setActivities(msg.activity);
      } else if (msg.type === "presence") {
        if (msg.event === "USER_CONNECTED") {
          setOnlineUsers((prev) =>
            prev.some((u) => u.id === msg.user_id)
              ? prev
              : [...prev, { id: msg.user_id, name: msg.name, connected_at: msg.timestamp, protection_enabled: msg.protection_enabled ?? true }]
          );
        } else if (msg.event === "USER_DISCONNECTED") {
          setOnlineUsers((prev) => prev.filter((u) => u.id !== msg.user_id));
        } else if (msg.event === "PROTECTION_DISABLED" || msg.event === "PROTECTION_ENABLED") {
          setOnlineUsers((prev) => prev.map((u) => u.id === msg.user_id ? { ...u, protection_enabled: msg.protection_enabled } : u));
        }
        addActivity({ type: "presence", event: msg.event, user_id: msg.user_id, name: msg.name, timestamp: msg.timestamp });
      } else if (msg.type === "security_event") {
        addActivity({ type: "security_event", event: msg.event, user_id: msg.user_id, name: msg.name, timestamp: msg.timestamp });
      } else if (msg.type === "user_logs") {
        // Response to our get_user_logs request
        setUserLogs(msg.logs || []);
        setUserDetail({ name: msg.name, protection_enabled: msg.protection_enabled, connected_at: msg.connected_at });
      }
    };

    ws.onclose = () => {
      setConnected(false);
      const delay = Math.min(1000 * Math.pow(2, attemptsRef.current), 30000);
      attemptsRef.current++;
      reconnectRef.current = setTimeout(connectWs, delay);
    };

    ws.onerror = () => {};
  }, [router, addActivity]);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/login"); return; }
    setReady(true);
    connectWs();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    };
  }, [router, connectWs]);

  const handleLogout = () => { localStorage.removeItem("admin_token"); router.replace("/login"); };

  const handleUserClick = (userId: string) => {
    setSelectedUser(userId);
    setUserLogs([]);
    setUserDetail(null);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "get_user_logs", user_id: userId }));
    }
  };

  if (!ready) return null;

  const copyCount = activities.filter((a) => a.event.includes("COPY") || a.event.includes("CUT")).length;
  const pasteCount = activities.filter((a) => a.event.includes("PASTE")).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🛡️</span>
            <div>
              <h1 className="text-lg font-bold tracking-tight">CopyGuard</h1>
              <p className="text-xs text-slate-500">Real-Time Monitor</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-400"}`} />
            <span className="text-sm text-slate-400">{connected ? "Connected" : "Disconnected"}</span>
            <button onClick={handleLogout} className="px-3 py-1.5 text-sm rounded-lg border border-slate-700 hover:bg-slate-800 transition">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Online Users" value={onlineUsers.length} icon="🟢" />
          <StatCard label="Total Events" value={activities.length} icon="📊" />
          <StatCard label="Copy/Cut Attempts" value={copyCount} icon="📋" />
          <StatCard label="Paste Attempts" value={pasteCount} icon="📝" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Online Users */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <h3 className="font-semibold text-sm">Online Users</h3>
              <p className="text-xs text-slate-500 mt-0.5">Click a user to see their activity logs</p>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {onlineUsers.length === 0 ? (
                <div className="px-4 py-12 text-center text-slate-500 text-sm">No users online</div>
              ) : (
                onlineUsers.map((u) => {
                  const isProtected = u.protection_enabled !== false;
                  return (
                    <div
                      key={u.id}
                      onClick={() => handleUserClick(u.id)}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-slate-800 last:border-0 cursor-pointer transition hover:bg-slate-800/50 ${selectedUser === u.id ? "bg-indigo-900/20" : ""}`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${isProtected ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-slate-500">
                          {isProtected ? "Protected" : "Protection Disabled"} · {new Date(u.connected_at).toLocaleTimeString()}
                        </p>
                      </div>
                      {isProtected ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400">🟢 Protected</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400">🟡 Disabled</span>
                      )}
                      <span className="text-slate-600 text-sm">→</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Live Activity</h3>
              {connected && <span className="text-xs text-green-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live</span>}
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {activities.length === 0 ? (
                <div className="px-4 py-12 text-center text-slate-500 text-sm">No activity yet</div>
              ) : (
                activities.map((item, i) => {
                  const icon = EVENT_ICONS[item.event] || "•";
                  const isSecurity = item.type === "security_event";
                  const isToggle = item.event === "PROTECTION_ENABLED" || item.event === "PROTECTION_DISABLED";
                  const isAllowed = item.event.includes("ALLOWED");
                  return (
                    <div key={i} className="flex items-start gap-3 px-4 py-2.5 border-b border-slate-800 last:border-0">
                      <span className="text-lg">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-300">
                          <span className={isSecurity ? (isAllowed ? "text-green-400" : "text-amber-400") : isToggle ? "text-yellow-400" : "text-green-400"}>{item.name}</span>{" "}
                          {item.event === "USER_CONNECTED" ? "connected"
                            : item.event === "USER_DISCONNECTED" ? "disconnected"
                            : item.event === "PROTECTION_ENABLED" ? "enabled protection"
                            : item.event === "PROTECTION_DISABLED" ? "disabled protection"
                            : isAllowed ? `${item.event.replace("_ALLOWED", "").toLowerCase()} (allowed — protection off)`
                            : `attempted ${item.event.replace(/_/g, " ").toLowerCase()}`}
                        </p>
                        <p className="text-xs text-slate-500">{new Date(item.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
          <div className="w-full max-w-lg p-6 rounded-2xl bg-slate-900 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">{userDetail?.name || "Loading..."}</h2>
                {userDetail && (
                  <p className="text-sm text-slate-400 mt-1">
                    {userDetail.protection_enabled ? "🟢 Protection ON" : "🟡 Protection OFF"} ·
                    Connected {userDetail.connected_at ? new Date(userDetail.connected_at).toLocaleString() : ""}
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">Activity Log</h3>
              {userLogs.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-8">No activity recorded yet</div>
              ) : (
                <div className="space-y-2">
                  {userLogs.map((log, i) => {
                    const icon = EVENT_ICONS[log.event] || "•";
                    const isAllowed = log.event.includes("ALLOWED");
                    const isBlocked = log.event.includes("ATTEMPT");
                    return (
                      <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-slate-800/50">
                        <span className="text-lg">{icon}</span>
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className={isAllowed ? "text-green-400" : isBlocked ? "text-amber-400" : "text-slate-300"}>
                              {log.event === "PROTECTION_ENABLED" ? "Enabled protection"
                                : log.event === "PROTECTION_DISABLED" ? "Disabled protection"
                                : log.event.replace(/_/g, " ").toLowerCase()}
                            </span>
                            {isAllowed && <span className="text-xs text-slate-500 ml-2">(protection was off)</span>}
                          </p>
                          <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <span className="text-2xl opacity-50">{icon}</span>
      </div>
    </div>
  );
}
