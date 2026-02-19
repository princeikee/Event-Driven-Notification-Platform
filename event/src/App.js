import React from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import Event from "./pages/Event";
import Admin from "./pages/Admin";
import Landing from "./pages/Landing";
import Login from "./pages/login";
import { getActiveSession } from "./session/demoSession";

function ProtectedRoute({ children }) {
  const session = getActiveSession();
  if (!session) return <Navigate to="/" replace />;
  return children;
}

function AdminRoute({ children }) {
  const session = getActiveSession();
  if (!session) return <Navigate to="/" replace />;
  if (session.mode !== "demo" && session.user?.role !== "admin") {
    return <Navigate to="/event" replace />;
  }
  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Login />} />
        <Route path="/login" element={<Navigate to="/auth" replace />} />
        <Route
          path="/event"
          element={
            <ProtectedRoute>
              <Event />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />
      </Routes>
    </Router>
  );
}
export default App;
