import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import {
  Bell,
  BellRing,
  Send,
  TrendingUp,
  CheckCircle,
  Layers,
  Wifi,
  Zap,
  UserPlus,
  ShieldAlert,
  MessageSquare,
  Megaphone,
  Activity,
  Globe,
  Cpu,
  Database,
  ArrowRight,
  X,
  LogOut,
} from "lucide-react";
import { clearDemoSession, clearRealSession, getActiveSession } from "../session/demoSession";
import { API_BASE_URL, API_ROUTES } from "../config/api";

const iconMap = {
  bell: Bell,
  "bell-ring": BellRing,
  send: Send,
  "trending-up": TrendingUp,
  "check-circle": CheckCircle,
  layers: Layers,
  wifi: Wifi,
  zap: Zap,
  "user-plus": UserPlus,
  "shield-alert": ShieldAlert,
  "message-square": MessageSquare,
  megaphone: Megaphone,
  activity: Activity,
  globe: Globe,
  cpu: Cpu,
  database: Database,
  "arrow-right": ArrowRight,
  x: X,
  "log-out": LogOut,
};

function Icon({ name, className }) {
  const Comp = iconMap[name];
  if (!Comp) return null;
  return <Comp className={className} />;
}

function ago(dateValue) {
  if (!dateValue) return "Just now";
  const mins = Math.floor((Date.now() - new Date(dateValue).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function Event() {
  const navigate = useNavigate();
  const chartRef = useRef(null);
  const initializedRealRef = useRef(false);
  const prevEventIdsRef = useRef(new Set());
  const prevNotifIdsRef = useRef(new Set());
  const session = getActiveSession();
  const isDemo = session?.mode === "demo";
  const user = session?.user || { id: "", name: "User", role: "user" };
  const canOpenAdmin = isDemo || user.role === "admin";

  const [eventsProcessed, setEventsProcessed] = useState(0);
  const [queueSize, setQueueSize] = useState(0);
  const [liveEvents, setLiveEvents] = useState("0 events/min");
  const [eventLog, setEventLog] = useState([]);
  const [recentNotifs, setRecentNotifs] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [analyticsPoints, setAnalyticsPoints] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [isWsLive, setIsWsLive] = useState(true);
  const [activityPulse, setActivityPulse] = useState(false);
  const [stats, setStats] = useState({
    totalNotifications: 0,
    successRate: 99.8,
    eventsToday: 0,
    activeUsers: 0,
  });
  const colorMap = {
    blue: {
      bg100: "bg-blue-100",
      text600: "text-blue-600",
      border500: "border-blue-500",
    },
    amber: {
      bg100: "bg-amber-100",
      text600: "text-amber-600",
      border500: "border-amber-500",
    },
    purple: {
      bg100: "bg-purple-100",
      text600: "text-purple-600",
      border500: "border-purple-500",
    },
    emerald: {
      bg100: "bg-emerald-100",
      text600: "text-emerald-600",
      border500: "border-emerald-500",
    },
    slate: {
      bg100: "bg-slate-100",
      text600: "text-slate-600",
      border500: "border-slate-500",
    },
  };

  const eventTypes = useMemo(
    () => ({
      signup: { icon: "user-plus", color: "blue", label: "User Signup" },
      security: { icon: "shield-alert", color: "amber", label: "Security Alert" },
      message: { icon: "message-square", color: "purple", label: "New Message" },
      broadcast: { icon: "megaphone", color: "emerald", label: "Broadcast" },
      queue: { icon: "layers", color: "slate", label: "Queue Processed" },
      ws: { icon: "wifi", color: "purple", label: "WebSocket" },
    }),
    []
  );

  const realEventMessages = useMemo(
    () => ({
      signup: [
        "New user registered: sarah.smith@example.com",
        "User signup completed: mike.jones@example.com",
        "Account created: demo@company.com",
      ],
      security: [
        "Login from new device: iPhone 15 Pro",
        "Suspicious activity detected: IP 192.168.1.1",
        "2FA verification required for user #4521",
      ],
      message: [
        "Direct message sent to user #8921",
        "Group notification delivered to 45 users",
        "Mention notification created",
      ],
    }),
    []
  );

  function buildFallbackAnalytics(seed = 0) {
    const base = Math.max(3, Number(seed || 0));
    return Array.from({ length: 8 }, (_, i) => ({
      hourSlot: `${i * 3}:00`,
      total: Math.max(1, Math.round(base * (0.35 + i * 0.08))),
    }));
  }

  function addEvent(type, message, time = "Just now") {
    setEventsProcessed((prev) => prev + 1);
    setEventLog((prev) => [{ id: Date.now() + Math.random(), type, message, time }, ...prev].slice(0, 10));
  }

  function addNotif(notif) {
    setRecentNotifs((prev) => [{ id: Date.now() + Math.random(), ...notif }, ...prev].slice(0, 6));
  }

  function showToast(title, message, type = "message") {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4500);
  }

  async function loadRealData() {
    try {
      const headers = {
        "Content-Type": "application/json",
        "x-user-id": String(user.id || ""),
        "x-user-role": String(user.role || "user"),
      };
      const [statsRes, eventsRes, notifRes, analyticsRes, workersRes] = await Promise.all([
        fetch(`${API_BASE_URL}${API_ROUTES.dashboardStats}`, { headers }),
        fetch(`${API_BASE_URL}${API_ROUTES.dashboardEvents}`, { headers }),
        fetch(`${API_BASE_URL}${API_ROUTES.dashboardNotifications}`, { headers }),
        fetch(`${API_BASE_URL}${API_ROUTES.dashboardAnalytics}`, { headers }),
        fetch(`${API_BASE_URL}${API_ROUTES.systemWorkers}`, { headers }),
      ]);
      const [s, e, n, a, w] = await Promise.all([
        statsRes.json(),
        eventsRes.json(),
        notifRes.json(),
        analyticsRes.json(),
        workersRes.json(),
      ]);
      const mappedEvents = (e.events || []).map((x) => ({ ...x, time: ago(x.createdAt) }));
      const mappedNotifs = (n.notifications || []).map((x) => ({ ...x, time: ago(x.createdAt) }));
      const mappedWorkers = (w.workers || []).map((item) => ({
        ...item,
        isActive: item.status === "Active",
      }));

      if (initializedRealRef.current) {
        const newEvent = mappedEvents.find((item) => !prevEventIdsRef.current.has(String(item.id)));
        const newNotif = mappedNotifs.find((item) => !prevNotifIdsRef.current.has(String(item.id)));
        if (newEvent) {
          showToast("New Event", newEvent.message, newEvent.type || "message");
          setActivityPulse(true);
          setTimeout(() => setActivityPulse(false), 700);
        }
        if (newNotif) {
          showToast("New Notification", newNotif.title || "Notification received", newNotif.type || "message");
        }
      } else {
        initializedRealRef.current = true;
      }

      prevEventIdsRef.current = new Set(mappedEvents.map((item) => String(item.id)));
      prevNotifIdsRef.current = new Set(mappedNotifs.map((item) => String(item.id)));

      setStats({
        totalNotifications: Number(s.notificationsSent || 0),
        successRate: Number(s.systemHealth || 99),
        eventsToday: Number(s.eventsToday || 0),
        activeUsers: Number(s.activeUsers || 0),
      });
      setQueueSize(Number(s.queueDepth || 0));
      setEventLog(mappedEvents);
      setRecentNotifs(mappedNotifs);
      setWorkers(mappedWorkers);
      setAnalyticsPoints((a.points || []).length ? a.points : buildFallbackAnalytics(Number(s.eventsToday || 0)));
      setLiveEvents(`${Number(s.eventsToday || 0)} events today`);
      setEventsProcessed(Math.max(Number(s.eventsToday || 0), mappedEvents.length));
    } catch (_error) {
      showToast("Error", "Failed to load live dashboard data", "security");
      setAnalyticsPoints((prev) => (prev.length ? prev : buildFallbackAnalytics(eventsProcessed)));
    }
  }

  function loadDemoData() {
    setStats({ totalNotifications: 2847, successRate: 99.8, eventsToday: 456, activeUsers: 8932 });
    setQueueSize(142);
    setLiveEvents("22 events/min");
    setAnalyticsPoints(Array.from({ length: 8 }, (_, i) => ({ hourSlot: `${i * 3}:00`, total: 15 + Math.floor(Math.random() * 40) })));
    setEventLog([
      { id: "d1", type: "signup", message: "New user registered: john.doe@example.com", time: "2 min ago" },
      { id: "d2", type: "security", message: "Login from new device detected", time: "5 min ago" },
      { id: "d3", type: "queue", message: "Batch processed: 1,234 notifications", time: "8 min ago" },
    ]);
    setEventsProcessed(3);
    setRecentNotifs([
      { id: "n1", type: "broadcast", title: "Platform Update", message: "New features available in v2.4", time: "1 hour ago", status: "delivered" },
      { id: "n2", type: "security", title: "New Login Detected", message: "Chrome on MacOS - San Francisco, CA", time: "12 min ago", status: "delivered" },
      { id: "n3", type: "signup", title: "Welcome Aboard!", message: "Thanks for joining NotifyFlow", time: "5 min ago", status: "delivered" },
    ]);
    setWorkers([
      { name: "Worker-01", status: "Active", detail: "Processing: 12 jobs", isActive: true },
      { name: "Worker-02", status: "Active", detail: "Processing: 8 jobs", isActive: true },
      { name: "Worker-03", status: "Active", detail: "Processing: 15 jobs", isActive: true },
      { name: "Worker-04", status: "Idle", detail: "Standby", isActive: false },
    ]);
  }

  useEffect(() => {
    if (isDemo) {
      loadDemoData();
      const id = setInterval(() => {
        const type = ["signup", "security", "message"][Math.floor(Math.random() * 3)];
        addEvent(type, `${eventTypes[type].label} generated in demo mode`);
        addNotif({
          type,
          title: `${eventTypes[type].label} (Demo)`,
          message: "This notification is demo account based and not real production data.",
          time: "Just now",
          status: "delivered",
        });
        setStats((prev) => ({ ...prev, totalNotifications: prev.totalNotifications + 1, eventsToday: prev.eventsToday + 1 }));
        setLiveEvents(`${10 + Math.floor(Math.random() * 50)} events/min`);
        setQueueSize((prev) => Math.max(0, prev + Math.floor(Math.random() * 9 - 4)));
        setWorkers((prev) =>
          prev.map((item) => {
            const jobs = Math.max(0, Math.floor(Math.random() * 16));
            const isActive = jobs > 0;
            return {
              ...item,
              status: isActive ? "Active" : "Idle",
              detail: isActive ? `Processing: ${jobs} jobs` : "Standby",
              isActive,
            };
          })
        );
        showToast(`${eventTypes[type].label} (Demo)`, "New simulated notification received.", type);
        setActivityPulse(true);
        setTimeout(() => setActivityPulse(false), 700);
      }, 3500);
      return () => clearInterval(id);
    }
    initializedRealRef.current = false;
    prevEventIdsRef.current = new Set();
    prevNotifIdsRef.current = new Set();
    loadRealData();
    const refreshId = setInterval(() => {
      loadRealData();
    }, 8000);
    return () => clearInterval(refreshId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  useEffect(() => {
    if (isDemo || !user?.id) {
      setIsWsLive(false);
      return undefined;
    }

    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setIsWsLive(true);
      socket.emit("presence:join", { userId: user.id });
    });

    socket.on("disconnect", () => {
      setIsWsLive(false);
    });

    return () => {
      socket.disconnect();
      setIsWsLive(false);
    };
  }, [isDemo, user?.id]);

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    ctx.clearRect(0, 0, width, height);
    const points = (analyticsPoints.length ? analyticsPoints : Array.from({ length: 8 }, () => ({ total: 20 + Math.random() * 30 }))).map((p, i, arr) => ({
      x: (i / Math.max(1, arr.length - 1)) * width,
      y: height - 30 - Math.min(height - 60, Number(p.total || 0) * 2),
    }));
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(59,130,246,0.2)");
    gradient.addColorStop(1, "rgba(59,130,246,0)");
    ctx.beginPath();
    ctx.moveTo(0, height);
    points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [analyticsPoints]);

  async function simulateEvent(type) {
    if (!isDemo) {
      try {
        const messageSet = realEventMessages[type] || [`${eventTypes[type]?.label || type} triggered`];
        const realMessage = messageSet[Math.floor(Math.random() * messageSet.length)];
        const response = await fetch(`${API_BASE_URL}${API_ROUTES.triggerEvent}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": String(user.id || ""),
            "x-user-role": String(user.role || "user"),
          },
          body: JSON.stringify({ type, message: realMessage }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed");
        showToast(eventTypes[type]?.label || "Event", data.event?.message || realMessage, type);
        await loadRealData();
      } catch (_error) {
        showToast("Error", "Unable to save event", type);
      }
      return;
    }
    addEvent(type, `${eventTypes[type].label} triggered`);
    showToast(`${eventTypes[type].label} demo`, "This action is simulated for demo account only.", type);
  }

  async function sendBroadcast(e) {
    e.preventDefault();
    const title = e.target.broadcastTitle.value;
    const message = e.target.broadcastMessage.value;
    if (!isDemo) {
      try {
        const response = await fetch(`${API_BASE_URL}${API_ROUTES.sendBroadcast}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": String(user.id || ""),
            "x-user-role": String(user.role || "user"),
          },
          body: JSON.stringify({ title, message }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed");
        showToast("Broadcast Sent", `"${title}" was delivered`, "broadcast");
        await loadRealData();
      } catch (_error) {
        showToast("Error", "Failed to send broadcast", "broadcast");
      }
    } else {
      addEvent("broadcast", `Broadcast queued: "${title}" - Demo`);
      addNotif({ type: "broadcast", title, message: `${message} (demo simulated)`, time: "Just now", status: "delivered" });
      showToast("Demo Broadcast", "This broadcast is demo account based and not real.", "broadcast");
    }
    setIsBroadcastOpen(false);
    e.target.reset();
  }

  async function handleLogout() {
    const active = getActiveSession();
    if (active?.mode === "demo" && active?.user?.id) {
      try {
        await fetch(`${API_BASE_URL}${API_ROUTES.demoLogout}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: active.user.id }),
        });
      } catch (_error) {
        // no-op
      }
    }
    clearDemoSession();
    clearRealSession();
    navigate("/");
  }

  const queuePercent = Math.min(100, (queueSize / 500) * 100);
  const eventsProcessedPercent = Math.min(100, (eventsProcessed / 500) * 100);

  return (
    <div className="mesh-bg min-h-screen">
      <style>{`
        * { font-family: 'Inter', sans-serif; }
        .glass-card { background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); border: 1px solid rgba(226,232,240,0.8); }
        .mesh-bg { background-color:#fafafa; background-image: radial-gradient(at 40% 20%, hsla(215,98%,61%,0.05) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(189,100%,56%,0.05) 0px, transparent 50%); }
      `}</style>

      <nav className="glass-card sticky top-0 z-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Icon name="bell-ring" className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">NotifyFlow</h1>
                <p className="text-xs text-slate-500">Event-Driven Notification Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isDemo ? <span className="px-2 py-1 text-xs rounded-full border border-amber-200 bg-amber-50 text-amber-700">DEMO MODE</span> : null}
              <div className="px-2 py-1 text-xs rounded-full border border-slate-200 bg-white text-slate-600 flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${isWsLive ? "bg-emerald-500" : "bg-rose-500"} ${activityPulse ? "animate-ping" : ""}`} />
                {isWsLive ? "System Live" : "Reconnecting"}
              </div>
              {canOpenAdmin ? <button onClick={() => navigate("/admin")} className="px-3 py-2 text-sm rounded-lg border border-slate-200">Admin Dashboard</button> : null}
              <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50"><Icon name="log-out" className="w-4 h-4" />Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isDemo ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            These notifications are demo account based and are not real production notifications. They are simulated and reset when you refresh or logout. Please create an account to explore real, persistent production data.
          </div>
        ) : null}

        <div className="glass-card rounded-2xl p-4 mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => simulateEvent("signup")} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium flex items-center gap-2"><Icon name="user-plus" className="w-4 h-4" />Simulate Signup</button>
            <button onClick={() => simulateEvent("security")} className="px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium flex items-center gap-2"><Icon name="shield-alert" className="w-4 h-4" />Security Alert</button>
            <button onClick={() => simulateEvent("message")} className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium flex items-center gap-2"><Icon name="message-square" className="w-4 h-4" />New Message</button>
            {user.role === "admin" || isDemo ? (
              <button onClick={() => setIsBroadcastOpen(true)} className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium flex items-center gap-2"><Icon name="megaphone" className="w-4 h-4" />Send Broadcast</button>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500"><Icon name="activity" className="w-4 h-4" /><span>{liveEvents}</span></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="glass-card rounded-2xl p-6">
            <div className="mb-3 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Icon name="send" className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-3xl font-bold">{stats.totalNotifications.toLocaleString()}</p>
            <p className="text-sm text-slate-500">Total Notifications</p>
            <div className="mt-3 h-2 bg-slate-100 rounded-full">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: "75%" }} />
            </div>
          </div>
          <div className="glass-card rounded-2xl p-6">
            <div className="mb-3 w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Icon name="check-circle" className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold">{stats.successRate}%</p>
            <p className="text-sm text-slate-500">Delivery Success Rate</p>
            <div className="mt-3 h-2 bg-slate-100 rounded-full">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, Number(stats.successRate) || 0)}%` }} />
            </div>
          </div>
          <div className="glass-card rounded-2xl p-6">
            <div className="mb-3 w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Icon name="layers" className="w-6 h-6 text-amber-600" />
            </div>
            <p className="text-3xl font-bold">{queueSize}</p>
            <p className="text-sm text-slate-500">Messages in Queue</p>
            <div className="mt-3 h-2 bg-slate-100 rounded-full">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${queuePercent}%` }} />
            </div>
          </div>
          <div className="glass-card rounded-2xl p-6">
            <div className="mb-3 w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Icon name="activity" className="w-6 h-6 text-purple-600" />
            </div>
            <p className="text-3xl font-bold">{eventsProcessed.toLocaleString()}</p>
            <p className="text-sm text-slate-500">Events Processed</p>
            <div className="mt-3 h-2 bg-slate-100 rounded-full">
              <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${eventsProcessedPercent}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-1">Notification Traffic</h3>
              <p className="text-sm text-slate-500 mb-4">Real-time event processing</p>
              <div className="h-64"><canvas ref={chartRef} className="w-full h-full" /></div>
            </div>
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-6">System Architecture</h3>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border-2 border-slate-200 min-w-[120px]">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-2">
                    <Icon name="globe" className="w-6 h-6 text-indigo-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">REST API</p>
                  <p className="text-xs text-slate-500">Node.js/Express</p>
                </div>

                <Icon name="arrow-right" className="w-5 h-5 text-slate-400" />

                <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border-2 border-slate-200 min-w-[120px]">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-2">
                    <Icon name="layers" className="w-6 h-6 text-amber-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">Redis Queue</p>
                  <p className="text-xs text-slate-500">BullMQ</p>
                </div>

                <Icon name="arrow-right" className="w-5 h-5 text-slate-400" />

                <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border-2 border-slate-200 min-w-[120px]">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                    <Icon name="cpu" className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">Workers</p>
                  <p className="text-xs text-slate-500">8 instances</p>
                </div>

                <Icon name="arrow-right" className="w-5 h-5 text-slate-400" />

                <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border-2 border-slate-200 min-w-[120px]">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                    <Icon name="wifi" className="w-6 h-6 text-purple-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">WebSockets</p>
                  <p className="text-xs text-slate-500">Socket.io</p>
                </div>

                <Icon name="arrow-right" className="w-5 h-5 text-slate-400" />

                <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border-2 border-slate-200 min-w-[120px]">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                    <Icon name="database" className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">PostgreSQL</p>
                  <p className="text-xs text-slate-500">Primary</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-1">Live Event Log</h3>
              <p className="text-sm text-slate-500 mb-4">Real-time system events</p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {eventLog.length === 0 ? (
                  <p className="text-xs text-slate-500">No events yet for this account. Trigger an event or send a broadcast.</p>
                ) : null}
                {eventLog.map((e) => (
                  <div key={e.id} className="p-3 rounded-lg border bg-slate-50">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          (colorMap[eventTypes[e.type]?.color] || colorMap.slate).bg100
                        }`}
                      >
                        <Icon
                          name={eventTypes[e.type]?.icon || "message-square"}
                          className={`w-4 h-4 ${(colorMap[eventTypes[e.type]?.color] || colorMap.slate).text600}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{eventTypes[e.type]?.label || e.type}</p>
                        <p className="text-xs text-slate-500">{e.message}</p>
                      </div>
                      <p className="text-xs text-slate-400">{e.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">Worker Instances</h3>
              <div className="space-y-2">
                {workers.map((w) => (
                  <div
                    key={w.name}
                    className={`p-3 rounded-lg border ${
                      w.isActive
                        ? "text-emerald-600 bg-emerald-50 border-emerald-100"
                        : "text-slate-600 bg-slate-50 border-slate-100"
                    }`}
                  >
                    <p className="text-sm font-medium">{w.name}</p>
                    <p className="text-xs">{w.detail}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Notifications</h3>
              <div className="space-y-2">
                {recentNotifs.length === 0 ? (
                  <p className="text-xs text-slate-500">No notifications yet for this account.</p>
                ) : null}
                {recentNotifs.map((n) => (
                  <div key={n.id} className="p-3 rounded-lg border bg-slate-50">
                    {(() => {
                      const cfg = eventTypes[n.type] || eventTypes.message;
                      const notifColor = colorMap[cfg.color] || colorMap.slate;
                      return (
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full ${notifColor.bg100} flex items-center justify-center flex-shrink-0`}>
                        <Icon name={cfg.icon} className={`w-5 h-5 ${notifColor.text600}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="text-xs text-slate-400">{n.time}</p>
                        </div>
                        <p className="text-xs text-slate-500">{n.message}</p>
                        <p className="text-xs text-emerald-600 mt-1">{n.status}</p>
                      </div>
                    </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {isBroadcastOpen ? (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={(e) => e.target === e.currentTarget && setIsBroadcastOpen(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold mb-4">Send Broadcast Notification</h3>
            <form onSubmit={sendBroadcast} className="space-y-3">
              <input name="broadcastTitle" type="text" placeholder="Enter notification title" className="w-full px-4 py-2 border rounded-lg" required />
              <textarea name="broadcastMessage" rows="4" placeholder="Enter your message..." className="w-full px-4 py-2 border rounded-lg resize-none" required />
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsBroadcastOpen(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center justify-center gap-2"><Icon name="send" className="w-4 h-4" />Send Broadcast</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => {
          const cfg = eventTypes[t.type] || eventTypes.message;
          const toastColor = colorMap[cfg.color] || colorMap.slate;
          return (
            <div key={t.id} className={`glass-card rounded-xl p-4 shadow-lg border-l-4 ${toastColor.border500} max-w-sm`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 ${toastColor.bg100} rounded-full flex items-center justify-center flex-shrink-0`}>
                  <Icon name={cfg.icon} className={`w-5 h-5 ${toastColor.text600}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-slate-500">{t.message}</p>
                </div>
                <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="text-slate-400 hover:text-slate-600">
                  <Icon name="x" className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

