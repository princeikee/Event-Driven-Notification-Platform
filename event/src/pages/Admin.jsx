import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download } from "lucide-react";
import { io } from "socket.io-client";
import { getActiveSession } from "../session/demoSession";
import { API_BASE_URL, API_ROUTES } from "../config/api";

function rel(dateValue) {
  if (!dateValue) return "N/A";
  const ms = Date.now() - new Date(dateValue).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function fmtDate(dateValue) {
  if (!dateValue) return "N/A";
  return new Date(dateValue).toLocaleDateString();
}

export default function Admin() {
  const navigate = useNavigate();
  const session = getActiveSession();
  const isDemo = session?.mode === "demo";
  const user = session?.user;

  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [query, setQuery] = useState("");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [adminStats, setAdminStats] = useState({
    totalUsers: 0,
    eventsToday: 0,
    queueDepth: 0,
    systemHealth: 99,
  });
  const [systemStatus, setSystemStatus] = useState({
    status: "operational",
    uptime: 99.9,
    latencyMs: 0,
    region: "us-east-1",
  });
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [presenceConnected, setPresenceConnected] = useState(false);
  const [lastPollOk, setLastPollOk] = useState(false);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      "x-user-id": String(user?.id || ""),
      "x-user-role": String(user?.role || "user"),
    }),
    [user?.id, user?.role]
  );

  async function loadRealData() {
    const [usersRes, logsRes, statusRes, statsRes, onlineRes] = await Promise.all([
      fetch(`${API_BASE_URL}${API_ROUTES.adminUsers}`, { headers }),
      fetch(`${API_BASE_URL}${API_ROUTES.adminLogs}`, { headers }),
      fetch(`${API_BASE_URL}${API_ROUTES.systemStatus}`, { headers }),
      fetch(`${API_BASE_URL}${API_ROUTES.adminStats}`, { headers }),
      fetch(`${API_BASE_URL}${API_ROUTES.adminOnlineUsers}`, { headers }),
    ]);
    const [usersJson, logsJson, statusJson, statsJson, onlineJson] = await Promise.all([
      usersRes.json(),
      logsRes.json(),
      statusRes.json(),
      statsRes.json(),
      onlineRes.json(),
    ]);
    if (!usersRes.ok) throw new Error(usersJson.message || "Admin users unavailable");
    setUsers(usersJson.users || []);
    setLogs((logsJson.logs || []).map((l) => ({ ...l, ago: rel(l.createdAt) })));
    setSystemStatus(statusJson || {});
    setAdminStats(statsJson || {});
    setOnlineCount(Number(onlineJson?.count || 0));
    setOnlineUsers(onlineJson?.users || []);
    setLastPollOk(true);
  }

  useEffect(() => {
    if (!user) {
      navigate("/event");
      return;
    }
    if (!isDemo && user.role !== "admin") {
      navigate("/event");
      return;
    }

    if (isDemo) {
      setUsers([
        { id: "d1", name: "Demo Admin", email: "demo@notifyflow.com", role: "admin", isActive: 1, createdAt: new Date().toISOString(), totalNotificationsSent: 123, lastActive: new Date().toISOString() },
        { id: "d2", name: "Demo User 1", email: "user1@demo.local", role: "user", isActive: 1, createdAt: new Date().toISOString(), totalNotificationsSent: 42, lastActive: new Date().toISOString() },
      ]);
      setLogs([
        { id: "l1", category: "auth", message: "Demo admin login", createdAt: new Date().toISOString(), ago: "Just now" },
        { id: "l2", category: "admin-broadcast", message: "Demo system broadcast", createdAt: new Date().toISOString(), ago: "2 min ago" },
      ]);
      setAdminStats({ totalUsers: 2, eventsToday: 19, queueDepth: 4, systemHealth: 99.8 });
      setSystemStatus({ status: "operational", uptime: 99.8, latencyMs: 62, region: "sandbox-us" });
      setOnlineCount(2);
      setPresenceConnected(true);
      setLastPollOk(true);
      setOnlineUsers([
        { id: "d1", name: "Demo Admin", email: "demo@notifyflow.com", role: "admin" },
        { id: "d2", name: "Demo User 1", email: "user1@demo.local", role: "user" },
      ]);
      setIsLoading(false);
      return;
    }

    let active = true;
    loadRealData()
      .catch((error) => {
        setNotice(error.message || "Failed to load admin data");
        setLastPollOk(false);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    const id = setInterval(() => {
      loadRealData().catch(() => {
        setLastPollOk(false);
      });
    }, 7000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [API_BASE_URL, headers, isDemo, navigate, user]);

  useEffect(() => {
    if (isDemo || !user || user.role !== "admin") return undefined;

    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setPresenceConnected(true);
      socket.emit("presence:join", { userId: user.id });
    });

    socket.on("disconnect", () => {
      setPresenceConnected(false);
    });

    socket.on("connect_error", () => {
      setPresenceConnected(false);
    });

    socket.on("presence:update", (payload = {}) => {
      setOnlineCount(Number(payload.count || 0));
      setOnlineUsers(payload.users || []);
    });

    return () => {
      socket.disconnect();
      setPresenceConnected(false);
    };
  }, [isDemo, user?.id, user?.role]);

  const presenceLabel = isDemo
    ? "Live"
    : presenceConnected
      ? "Live"
      : lastPollOk
        ? "Polling"
        : "Disconnected";

  async function suspendUser(targetId, suspended) {
    if (isDemo) {
      setUsers((prev) => prev.map((u) => (u.id === targetId ? { ...u, isActive: suspended ? 0 : 1 } : u)));
      setNotice("Demo: user status updated");
      return;
    }
    const response = await fetch(`${API_BASE_URL}${API_ROUTES.adminUsers}/${targetId}/suspend`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ suspended }),
    });
    if (response.ok) {
      setNotice("User status updated");
      loadRealData().catch(() => {});
    }
  }

  async function changeRole(targetId, role) {
    if (isDemo) {
      setUsers((prev) => prev.map((u) => (u.id === targetId ? { ...u, role } : u)));
      setNotice("Demo: role changed");
      return;
    }
    const response = await fetch(`${API_BASE_URL}${API_ROUTES.adminUsers}/${targetId}/role`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ role }),
    });
    if (response.ok) {
      setNotice(`Updated role to ${role}`);
      loadRealData().catch(() => {});
    }
  }

  async function deleteUser(targetId) {
    if (isDemo) {
      setUsers((prev) => prev.filter((u) => u.id !== targetId));
      setNotice("Demo: user deleted");
      return;
    }
    const response = await fetch(`${API_BASE_URL}${API_ROUTES.adminUsers}/${targetId}`, {
      method: "DELETE",
      headers,
    });
    const data = await response.json();
    if (response.ok) {
      setNotice("User deleted");
      loadRealData().catch(() => {});
    } else {
      setNotice(data.message || "Delete failed");
    }
  }

  async function sendSystemBroadcast(e) {
    e.preventDefault();
    if (!broadcastTitle || !broadcastMessage) return;
    if (isDemo) {
      setLogs((prev) => [{ id: `${Date.now()}`, category: "admin-broadcast", message: `Demo broadcast: ${broadcastTitle}`, ago: "Just now" }, ...prev]);
      setNotice("Demo broadcast sent");
      setBroadcastTitle("");
      setBroadcastMessage("");
      return;
    }
    const response = await fetch(`${API_BASE_URL}${API_ROUTES.adminBroadcast}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: broadcastTitle, message: broadcastMessage }),
    });
    const data = await response.json();
    if (response.ok) {
      setNotice(`Broadcast sent to ${data.recipients} users`);
      setBroadcastTitle("");
      setBroadcastMessage("");
      loadRealData().catch(() => {});
    }
  }

  function exportLogsJson() {
    const payload = JSON.stringify(logs, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notifyflow-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredUsers = users.filter((u) => {
    const q = query.toLowerCase();
    return (
      String(u.name || "").toLowerCase().includes(q) ||
      String(u.email || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-100 px-3 sm:px-4 py-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-slate-500">{isDemo ? "Demo Sandbox" : "Production Control Center"}</p>
            {!isDemo ? (
              <div className="mt-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm font-semibold">
                  {String(user?.name || user?.email || "U").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{user?.name || "Admin User"}</p>
                  <p className="text-xs text-slate-500">{user?.email || "N/A"}</p>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <button onClick={exportLogsJson} className="px-3 py-2 text-sm rounded border border-slate-200 flex items-center justify-center gap-1">
              <Download className="h-4 w-4" />
              Export Logs
            </button>
            <button onClick={() => navigate("/event")} className="px-3 py-2 text-sm rounded border border-slate-200">
              Back
            </button>
          </div>
        </div>

        {notice ? <div className="text-sm px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700">{notice}</div> : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: adminStats.totalUsers },
            { label: "Events Today", value: adminStats.eventsToday },
            { label: "Queue Depth", value: adminStats.queueDepth },
            { label: "System Health", value: `${adminStats.systemHealth}%` },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">{kpi.label}</p>
              <p className="text-2xl font-bold mt-1">{isLoading ? "-" : (kpi.value ?? "-")}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600 leading-relaxed">
          System: <span className="font-semibold capitalize">{systemStatus.status}</span> - Region:{" "}
          <span className="font-semibold">{systemStatus.region}</span> - API latency:{" "}
          <span className="font-semibold">{systemStatus.latencyMs}ms</span>
          <span className="mx-2">-</span>
          Presence:{" "}
          <span className={`font-semibold ${
            presenceLabel === "Live" ? "text-emerald-600" : presenceLabel === "Polling" ? "text-amber-600" : "text-rose-600"
          }`}>
            {presenceLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="font-semibold">User Management</h2>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users" className="border border-slate-200 rounded px-3 py-2 text-sm w-full sm:w-64" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2 pr-2">Name</th>
                    <th className="py-2 pr-2">Role</th>
                    <th className="py-2 pr-2">Created</th>
                    <th className="py-2 pr-2">Notifications</th>
                    <th className="py-2 pr-2">Last Active</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100">
                      <td className="py-2 pr-2">
                        <p className="font-medium text-slate-800">{u.name || "Unknown User"}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className="py-2 pr-2 capitalize">{u.role}</td>
                      <td className="py-2 pr-2">{fmtDate(u.createdAt)}</td>
                      <td className="py-2 pr-2">{u.totalNotificationsSent ?? 0}</td>
                      <td className="py-2 pr-2">{rel(u.lastActive)}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => changeRole(u.id, u.role === "admin" ? "user" : "admin")}
                            className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700"
                          >
                            {u.role === "admin" ? "Demote" : "Promote"}
                          </button>
                          <button
                            onClick={() => suspendUser(u.id, !!u.isActive)}
                            className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700"
                          >
                            {u.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button onClick={() => deleteUser(u.id)} className="text-xs px-2 py-1 rounded bg-rose-50 text-rose-700">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="font-semibold mb-3">System Broadcast</h2>
            <form onSubmit={sendSystemBroadcast} className="space-y-3">
              <input value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} placeholder="Broadcast title" className="w-full border border-slate-200 rounded px-3 py-2 text-sm" required />
              <textarea value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} placeholder="Broadcast message" rows="4" className="w-full border border-slate-200 rounded px-3 py-2 text-sm" required />
              <button className="w-full rounded bg-blue-600 text-white py-2 text-sm" type="submit">
                Send Broadcast
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-100">
              <h3 className="font-semibold text-sm mb-2">Users Online ({onlineCount})</h3>
              <div className="space-y-2 max-h-40 overflow-auto">
                {onlineUsers.length === 0 ? (
                  <p className="text-xs text-slate-500">No users online right now.</p>
                ) : null}
                {onlineUsers.map((onlineUser) => (
                  <div key={onlineUser.id} className="text-xs p-2 rounded border border-emerald-100 bg-emerald-50">
                    <p className="font-medium text-slate-700">{onlineUser.name || onlineUser.email}</p>
                    <p className="text-slate-500">{onlineUser.email}</p>
                    <p className="text-slate-500 capitalize">{onlineUser.role}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="font-semibold mb-3">System Logs</h2>
          <div className="space-y-2 max-h-80 overflow-auto">
            {logs.map((log) => (
              <div key={log.id} className="p-3 rounded border border-slate-100 bg-slate-50">
                <p className="text-sm font-medium">{log.category}</p>
                <p className="text-xs text-slate-600">{log.message}</p>
                <p className="text-[10px] text-slate-400">{log.ago || rel(log.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
