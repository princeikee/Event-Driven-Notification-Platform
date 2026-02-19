export const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:4000";

export const API_ROUTES = {
  register: "/api/auth/register",
  login: "/api/auth/login",
  dashboardStats: "/api/dashboard/stats",
  dashboardEvents: "/api/dashboard/events",
  dashboardNotifications: "/api/dashboard/notifications",
  dashboardAnalytics: "/api/dashboard/analytics",
  systemStatus: "/api/system/status",
  systemWorkers: "/api/system/workers",
  triggerEvent: "/api/events/trigger",
  sendBroadcast: "/api/broadcasts",
  adminUsers: "/api/admin/users",
  adminStats: "/api/admin/stats",
  adminLogs: "/api/admin/logs",
  adminOnlineUsers: "/api/admin/online-users",
  adminBroadcast: "/api/admin/broadcast",
  demoStart: "/api/demo/start",
  demoLogout: "/api/demo/logout",
};
