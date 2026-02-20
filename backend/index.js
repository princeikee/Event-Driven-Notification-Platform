const express = require("express");
const http = require("http");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Server } = require("socket.io");
const { all, get, initDb, run } = require("./db");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://Event-Driven-Notification-Platform-1";

app.use(
  cors({
    origin: [FRONTEND_URL, "http://localhost:3000"],
  })
);
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: [FRONTEND_URL, "http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});

const demoSessions = new Map();
const onlineUsers = new Map();
const systemStatusState = {
  status: "operational",
  uptime: 99.3,
  region: process.env.SYSTEM_REGION || "us-east-1",
  latencyMs: 82,
  eventProcessingRate: 180,
  lastUpdatedAt: Date.now(),
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getUserIdFromRequest(req) {
  const userId = Number(req.headers["x-user-id"]);
  return Number.isFinite(userId) ? userId : null;
}

async function writeLog({ userId = null, level = "info", category = "system", message }) {
  await run(
    "INSERT INTO system_logs (user_id, level, category, message) VALUES ($1, $2, $3, $4)",
    [userId, level, category, message]
  );
}

function emitPresence() {
  io.emit("presence:update", {
    count: onlineUsers.size,
    users: Array.from(onlineUsers.values()).map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      role: item.role,
      sockets: item.sockets.size,
      lastSeen: item.lastSeen,
    })),
  });
}

async function resolvePresenceUser(userId) {
  if (!userId) return null;
  const user = await get(
    'SELECT id, name, email, role, is_active as "isActive" FROM users WHERE id = $1',
    [userId]
  );
  if (!user || Number(user.isActive) === 0) return null;
  return user;
}

io.on("connection", (socket) => {
  socket.on("presence:join", async (payload = {}) => {
    const userId = Number(payload.userId);
    const user = await resolvePresenceUser(userId);
    if (!user) return;

    socket.data.userId = user.id;
    const existing = onlineUsers.get(user.id);
    if (existing) {
      existing.sockets.add(socket.id);
      existing.lastSeen = new Date().toISOString();
      onlineUsers.set(user.id, existing);
    } else {
      onlineUsers.set(user.id, {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || "user",
        sockets: new Set([socket.id]),
        lastSeen: new Date().toISOString(),
      });
    }
    emitPresence();
  });

  socket.on("disconnect", () => {
    const userId = socket.data.userId;
    if (!userId) return;
    const existing = onlineUsers.get(userId);
    if (!existing) return;
    existing.sockets.delete(socket.id);
    existing.lastSeen = new Date().toISOString();
    if (existing.sockets.size === 0) {
      onlineUsers.delete(userId);
    } else {
      onlineUsers.set(userId, existing);
    }
    emitPresence();
  });
});

async function requireAuth(req, res) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ message: "Missing x-user-id header" });
    return null;
  }

  const user = await get(
    'SELECT id, name, email, role, is_active as "isActive" FROM users WHERE id = $1',
    [userId]
  );

  if (!user) {
    res.status(401).json({ message: "Invalid session user" });
    return null;
  }
  const isSuspended = Number(user.isActive) === 0;
  if (isSuspended) {
    res.status(403).json({ message: "Account is suspended" });
    return null;
  }

  await run("UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = $1", [user.id]);
  req.authUser = user;
  return user;
}

async function requireAdmin(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (String(user.role || "").toLowerCase() !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return null;
  }
  return user;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const existing = await get("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    if (existing) return res.status(409).json({ message: "Email already registered" });

    const countRow = await get("SELECT COUNT(*) as total FROM users");
    const assignedRole = Number(countRow?.total || 0) === 0 ? "admin" : "user";

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run(
      "INSERT INTO users (name, email, role, is_active, password_hash, last_active) VALUES ($1, $2, $3, 1, $4, CURRENT_TIMESTAMP) RETURNING *",
      [String(name).trim(), normalizedEmail, assignedRole, passwordHash]
    );

    await writeLog({
      userId: result.lastID,
      category: "auth",
      message: `User registered: ${normalizedEmail}`,
    });

    return res.status(201).json({
      user: {
        id: result.lastID,
        name: String(name).trim(),
        email: normalizedEmail,
        role: assignedRole,
      },
    });
  } catch (error) {
    console.error("Register error:", error.message);
    return res.status(500).json({ message: "Unable to register user" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await get(
      'SELECT id, name, email, role, is_active as "isActive", password_hash FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (!user) return res.status(401).json({ message: "Invalid email or password" });
    const isSuspended = Number(user.isActive) === 0;
    if (isSuspended) return res.status(403).json({ message: "Account is suspended" });

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) return res.status(401).json({ message: "Invalid email or password" });

    await run("UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = $1", [user.id]);
    await writeLog({ userId: user.id, category: "auth", message: `User login: ${user.email}` });

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || "user",
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ message: "Unable to log in" });
  }
});

app.post("/api/demo/start", (_req, res) => {
  const sessionId = crypto.randomUUID();
  const session = {
    id: sessionId,
    mode: "demo",
    user: {
      id: sessionId,
      email: "demo@notifyflow.com",
      name: "Demo Admin",
      role: "admin",
    },
    createdAt: new Date().toISOString(),
    logs: [],
    notifications: [],
  };

  demoSessions.set(sessionId, session);
  res.status(201).json({ session });
});

app.post("/api/demo/logout", (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ message: "sessionId is required" });
  demoSessions.delete(sessionId);
  return res.status(200).json({ ok: true });
});

app.get("/api/dashboard/stats", async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    const stats = await get(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE is_active = 1) AS "activeUsers",
        (SELECT COUNT(*) FROM events WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE) AS "eventsToday",
        (SELECT COUNT(*) FROM notifications WHERE user_id = $2) AS "notificationsSent",
        (SELECT COUNT(*) FROM notifications WHERE user_id = $3 AND status IN ('queued', 'processing', 'pending')) AS "queueDepth"`,
      [auth.id, auth.id, auth.id]
    );

    const systemHealth = randomInt(96, 100);
    return res.status(200).json({
      activeUsers: Number(stats?.activeUsers || 0),
      eventsToday: Number(stats?.eventsToday || 0),
      notificationsSent: Number(stats?.notificationsSent || 0),
      queueDepth: Number(stats?.queueDepth || 0),
      systemHealth,
    });
  } catch (error) {
    console.error("Stats error:", error.message);
    return res.status(500).json({ message: "Unable to load stats" });
  }
});

app.get("/api/dashboard/events", async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    const events = await all(
      `SELECT id, type, message, created_at as "createdAt"
       FROM events
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 20`,
      [auth.id]
    );
    return res.status(200).json({ events });
  } catch (error) {
    console.error("Events error:", error.message);
    return res.status(500).json({ message: "Unable to load events" });
  }
});

app.get("/api/dashboard/notifications", async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    const notifications = await all(
      `SELECT id, type, title, message, status, created_at as "createdAt"
       FROM notifications
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 20`,
      [auth.id]
    );
    return res.status(200).json({ notifications });
  } catch (error) {
    console.error("Notifications error:", error.message);
    return res.status(500).json({ message: "Unable to load notifications" });
  }
});

app.get("/api/dashboard/analytics", async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    const rows = await all(
      `SELECT TO_CHAR(DATE_TRUNC('hour', created_at), 'HH24:00') as "hourSlot", COUNT(*) as total
       FROM events
       WHERE user_id = $1
       GROUP BY DATE_TRUNC('hour', created_at)
       ORDER BY DATE_TRUNC('hour', created_at) ASC`,
      [auth.id]
    );
    return res.status(200).json({ points: rows });
  } catch (error) {
    console.error("Analytics error:", error.message);
    return res.status(500).json({ message: "Unable to load analytics" });
  }
});

app.get("/api/system/status", (_req, res) => {
  const now = Date.now();
  const elapsedMs = now - systemStatusState.lastUpdatedAt;
  if (elapsedMs >= 30000) {
    systemStatusState.uptime = Math.min(
      99.99,
      Math.max(98.9, Number((systemStatusState.uptime + (Math.random() * 0.06 - 0.03)).toFixed(2)))
    );
    systemStatusState.latencyMs = Math.max(35, Math.min(180, systemStatusState.latencyMs + randomInt(-4, 4)));
    systemStatusState.eventProcessingRate = Math.max(
      100,
      Math.min(320, systemStatusState.eventProcessingRate + randomInt(-8, 8))
    );
    systemStatusState.status = systemStatusState.uptime >= 99.2 ? "operational" : "degraded";
    systemStatusState.lastUpdatedAt = now;
  }

  res.status(200).json({
    status: systemStatusState.status,
    uptime: systemStatusState.uptime,
    region: systemStatusState.region,
    latencyMs: systemStatusState.latencyMs,
    eventProcessingRate: systemStatusState.eventProcessingRate,
  });
});

app.get("/api/system/workers", async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    const metrics = await get(
      `SELECT
        (SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND status = 'queued') AS "queuedCount",
        (SELECT COUNT(*) FROM notifications WHERE user_id = $2 AND status = 'processing') AS "processingCount",
        (SELECT COUNT(*) FROM notifications WHERE user_id = $3 AND DATE(created_at) = CURRENT_DATE) AS "notificationsToday",
        (SELECT COUNT(*) FROM events WHERE user_id = $4 AND DATE(created_at) = CURRENT_DATE) AS "eventsToday"`,
      [auth.id, auth.id, auth.id, auth.id]
    );

    const queuedCount = Number(metrics?.queuedCount || 0);
    const processingCount = Number(metrics?.processingCount || 0);
    const notificationsToday = Number(metrics?.notificationsToday || 0);
    const eventsToday = Number(metrics?.eventsToday || 0);

    let jobsPool = queuedCount + processingCount + Math.floor((notificationsToday + eventsToday) / 4);
    const workers = Array.from({ length: 4 }, (_, idx) => {
      const slotsLeft = 4 - idx;
      const jobs = slotsLeft > 0 ? Math.floor(jobsPool / slotsLeft) : 0;
      jobsPool -= jobs;
      const status = jobs > 0 ? "Active" : "Idle";
      return {
        name: `Worker-0${idx + 1}`,
        status,
        detail: status === "Active" ? `Processing: ${jobs} jobs` : "Standby",
      };
    });

    return res.status(200).json({ workers });
  } catch (error) {
    console.error("System workers error:", error.message);
    return res.status(500).json({ message: "Unable to load worker instances" });
  }
});

app.post("/api/events/trigger", async (req, res) => {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const { type, message } = req.body || {};
  if (!type || !message) return res.status(400).json({ message: "type and message are required" });

  try {
    const result = await run(
      "INSERT INTO events (user_id, type, message, is_demo) VALUES ($1, $2, $3, 0) RETURNING *",
      [auth.id, type, message]
    );
    await writeLog({ userId: auth.id, category: "event", message: `Event ${type}: ${message}` });
    return res.status(201).json({
      event: { id: result.lastID, type, message, createdAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error("Event save error:", error.message);
    return res.status(500).json({ message: "Unable to save event" });
  }
});

// Only admins can broadcast to all users.
app.post("/api/broadcasts", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) return;
  const { title, message } = req.body || {};
  if (!title || !message) return res.status(400).json({ message: "title and message are required" });

  try {
    const activeUsers = await all("SELECT id FROM users WHERE is_active = 1");
    for (const target of activeUsers) {
      await run(
        "INSERT INTO notifications (user_id, type, title, message, status, is_demo) VALUES ($1, $2, $3, $4, $5, 0)",
        [target.id, "broadcast", title, message, "delivered"]
      );
    }
    await run(
      "INSERT INTO events (user_id, type, message, is_demo) VALUES ($1, $2, $3, 0)",
      [auth.id, "broadcast", `Broadcast sent: "${title}" to ${activeUsers.length} recipients`]
    );
    await writeLog({ userId: auth.id, category: "broadcast", message: `Broadcast "${title}": ${message}` });

    return res.status(201).json({
      notification: {
        id: null,
        type: "broadcast",
        title,
        message,
        status: "delivered",
        createdAt: new Date().toISOString(),
      },
      recipients: activeUsers.length,
    });
  } catch (error) {
    console.error("Broadcast save error:", error.message);
    return res.status(500).json({ message: "Unable to send broadcast" });
  }
});

app.get("/api/admin/stats", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const row = await get(
      `SELECT
        (SELECT COUNT(*) FROM users) AS "totalUsers",
        (SELECT COUNT(*) FROM events WHERE DATE(created_at) = CURRENT_DATE) AS "eventsToday",
        (SELECT COUNT(*) FROM notifications WHERE status IN ('queued', 'processing', 'pending')) AS "queueDepth"`
    );
    res.status(200).json({
      totalUsers: Number(row?.totalUsers || 0),
      eventsToday: Number(row?.eventsToday || 0),
      queueDepth: Number(row?.queueDepth || 0),
      systemHealth: Number(systemStatusState.uptime.toFixed(2)),
    });
  } catch (error) {
    console.error("Admin stats error:", error.message);
    res.status(500).json({ message: "Unable to load admin stats" });
  }
});

app.get("/api/admin/users", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const users = await all(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.role,
         u.is_active as "isActive",
         u.created_at as "createdAt",
         u.last_active as "lastActive",
         (SELECT COUNT(*) FROM notifications n WHERE n.user_id = u.id) as "totalNotificationsSent"
       FROM users u
       ORDER BY u.id DESC`
    );
    return res.status(200).json({ users });
  } catch (error) {
    console.error("Admin users error:", error.message);
    return res.status(500).json({ message: "Unable to load users" });
  }
});

app.patch("/api/admin/users/:id/suspend", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) return;
  const userId = Number(req.params.id);
  const { suspended } = req.body || {};
  const isActive = suspended ? 0 : 1;
  if (userId === auth.id && suspended) {
    return res.status(400).json({ message: "You cannot deactivate your own account" });
  }

  try {
    await run("UPDATE users SET is_active = $1 WHERE id = $2", [isActive, userId]);
    await writeLog({
      userId: auth.id,
      category: "admin",
      message: `${suspended ? "Suspended" : "Reactivated"} user #${userId}`,
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Suspend user error:", error.message);
    return res.status(500).json({ message: "Unable to update user status" });
  }
});

app.patch("/api/admin/users/:id/role", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) return;
  const userId = Number(req.params.id);
  const role = String(req.body?.role || "user");
  if (!["user", "admin"].includes(role)) {
    return res.status(400).json({ message: "Role must be user or admin" });
  }

  try {
    await run("UPDATE users SET role = $1 WHERE id = $2", [role, userId]);
    await writeLog({ userId: auth.id, category: "admin", message: `Changed user #${userId} role to ${role}` });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Change role error:", error.message);
    return res.status(500).json({ message: "Unable to change user role" });
  }
});

app.delete("/api/admin/users/:id", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) return;
  const userId = Number(req.params.id);
  if (userId === auth.id) {
    return res.status(400).json({ message: "Admin cannot delete own account" });
  }

  try {
    await run("DELETE FROM notifications WHERE user_id = $1", [userId]);
    await run("DELETE FROM events WHERE user_id = $1", [userId]);
    await run("DELETE FROM system_logs WHERE user_id = $1", [userId]);
    await run("DELETE FROM users WHERE id = $1", [userId]);
    await writeLog({ userId: auth.id, category: "admin", message: `Deleted user #${userId}` });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Delete user error:", error.message);
    return res.status(500).json({ message: "Unable to delete user" });
  }
});

app.get("/api/admin/logs", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const logs = await all(
      `SELECT id, user_id as "userId", level, category, message, created_at as "createdAt"
       FROM system_logs
       ORDER BY id DESC
       LIMIT 200`
    );
    return res.status(200).json({ logs });
  } catch (error) {
    console.error("Admin logs error:", error.message);
    return res.status(500).json({ message: "Unable to load logs" });
  }
});

app.get("/api/admin/online-users", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  return res.status(200).json({
    count: onlineUsers.size,
    users: Array.from(onlineUsers.values()).map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      role: item.role,
      sockets: item.sockets.size,
      lastSeen: item.lastSeen,
    })),
  });
});

app.post("/api/admin/broadcast", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) return;
  const { title, message } = req.body || {};
  if (!title || !message) return res.status(400).json({ message: "title and message are required" });

  try {
    const activeUsers = await all("SELECT id FROM users WHERE is_active = 1");
    for (const target of activeUsers) {
      await run(
        "INSERT INTO notifications (user_id, type, title, message, status, is_demo) VALUES ($1, $2, $3, $4, $5, 0)",
        [target.id, "broadcast", title, message, "delivered"]
      );
    }
    await writeLog({ userId: auth.id, category: "admin-broadcast", message: `System broadcast "${title}": ${message}` });
    return res.status(201).json({ recipients: activeUsers.length });
  } catch (error) {
    console.error("Admin broadcast error:", error.message);
    return res.status(500).json({ message: "Unable to send system broadcast" });
  }
});

initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`NotifyFlow backend running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error.message);
    process.exit(1);
  });
