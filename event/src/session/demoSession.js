let activeDemoSession = null;
const REAL_SESSION_KEY = "notifyflow_real_user";

export function setDemoSession(session) {
  const user = session.user || {
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role || "admin",
  };
  activeDemoSession = { mode: "demo", user };
}

export function getDemoSession() {
  return activeDemoSession;
}

export function clearDemoSession() {
  activeDemoSession = null;
}

export function setRealSession(session) {
  const user = session.user || {
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role || "user",
  };
  const payload = { mode: "real", user };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(REAL_SESSION_KEY, JSON.stringify(payload));
  }
}

export function getRealSession() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(REAL_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.mode && parsed?.user) return parsed;

    // Backward compatibility for older flat session shape.
    return {
      mode: "real",
      user: {
        id: parsed?.id,
        name: parsed?.name,
        email: parsed?.email,
        role: parsed?.role || "user",
      },
    };
  } catch (_error) {
    window.localStorage.removeItem(REAL_SESSION_KEY);
    return null;
  }
}

export function clearRealSession() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(REAL_SESSION_KEY);
  }
}

export function getActiveSession() {
  return getDemoSession() || getRealSession();
}
