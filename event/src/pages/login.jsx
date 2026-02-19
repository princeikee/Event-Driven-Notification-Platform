import React, { useState } from "react";
import { BellRing, Lock, Mail } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { setDemoSession, setRealSession } from "../session/demoSession";
import { API_BASE_URL, API_ROUTES } from "../config/api";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get("mode") === "register" ? "register" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const endpoint = mode === "register" ? API_ROUTES.register : API_ROUTES.login;
      const payload =
        mode === "register"
          ? { name: name.trim(), email, password }
          : { email, password };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || (mode === "register" ? "Registration failed" : "Login failed"));
      }

      setRealSession({
        mode: "real",
        user: {
          id: data.user?.id || `user-${Date.now()}`,
          email: data.user?.email || email,
          name: data.user?.name || name || "User",
          role: data.user?.role || "user",
        },
      });
      navigate("/event");
    } catch (err) {
      setError(err.message || (mode === "register" ? "Unable to register" : "Unable to log in"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTryDemo() {
    setError("");
    setIsDemoLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}${API_ROUTES.demoStart}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to start demo");
      }

      setDemoSession({
        mode: "demo",
        user: {
          id: data.session?.user?.id || data.session?.id,
          email: data.session?.user?.email || "demo@notifyflow.com",
          name: data.session?.user?.name || "Demo Admin",
          role: data.session?.user?.role || "admin",
        },
      });

      navigate("/event");
    } catch (err) {
      setError(err.message || "Unable to start demo session");
    } finally {
      setIsDemoLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.15),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.15),_transparent_45%)] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 backdrop-blur p-8 shadow-2xl shadow-slate-300/30">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <BellRing className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            {mode === "register" ? "Create Your Account" : "NotifyFlow Login"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {mode === "register"
              ? "Register to save your dashboard data permanently"
              : "Sign in to manage your notification platform"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Full Name</span>
              <div className="rounded-lg border border-slate-200 px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                <input
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border-0 p-0 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  required
                />
              </div>
            </label>
          ) : null}

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
              <Mail className="h-4 w-4 text-slate-400" />
              <input
                type="email"
                placeholder="admin@notifyflow.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border-0 p-0 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                required
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
              <Lock className="h-4 w-4 text-slate-400" />
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border-0 p-0 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                required
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (mode === "register" ? "Creating account..." : "Signing in...") : mode === "register" ? "Create Account" : "Sign In"}
          </button>

          <button
            type="button"
            onClick={handleTryDemo}
            disabled={isDemoLoading}
            className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isDemoLoading ? "Starting demo..." : "Try Demo Account"}
          </button>
        </form>

        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <p className="mt-4 text-center text-sm text-slate-600">
          {mode === "register" ? "Already have an account? " : "Need an account? "}
          <button
            type="button"
            onClick={() => {
              setMode((prev) => (prev === "register" ? "login" : "register"));
              setError("");
            }}
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            {mode === "register" ? "Sign In" : "Register"}
          </button>
        </p>
        <p className="mt-2 text-center text-sm text-slate-500">
          <button type="button" onClick={() => navigate("/")} className="hover:text-slate-700">
            Back to landing page
          </button>
        </p>
      </div>
    </div>
  );
}
