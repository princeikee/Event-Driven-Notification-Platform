import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  BellRing, Cpu, Database, Globe, Layers, Megaphone, ShieldCheck, 
  Activity, PlayCircle, Zap, ArrowRight, Sparkles 
} from "lucide-react";
import { API_BASE_URL, API_ROUTES } from "../config/api";
import { setDemoSession } from "../session/demoSession";

function CtaButton({
  children,
  onClick,
  variant = "primary",
  className = "",
  disabled = false,
  ariaLabel,
  icon: Icon,
}) {
  const base =
    "btn-hover group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-semibold text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 transition-all active:scale-[0.985]";

  const styles =
    variant === "primary"
      ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 focus-visible:outline-blue-600"
      : variant === "success"
      ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 focus-visible:outline-emerald-600"
      : "border-2 border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-slate-500";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${disabled ? "opacity-70 cursor-not-allowed" : ""} ${className}`}
      aria-label={ariaLabel}
    >
      {Icon && <Icon className="h-5 w-5" aria-hidden="true" />}
      {children}
      {!Icon && variant !== "ghost" && <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition" />}
    </button>
  );
}

function FeatureCard({ title, description, icon: Icon }) {
  return (
    <article 
      className="group relative rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 overflow-hidden"
      data-reveal
    >
      {/* Subtle shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
        <Icon className="h-7 w-7 text-indigo-600" aria-hidden="true" />
      </div>
      
      <h3 className="font-semibold text-xl sm:text-2xl text-slate-900 mb-3 tracking-tight">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
      
      <div className="absolute bottom-6 right-6 text-indigo-200 group-hover:text-indigo-300 transition-colors">
        <Sparkles className="h-8 w-8" />
      </div>
    </article>
  );
}

function ArchitectureNode({ icon: IconComp, label, tintClass, delay }) {
  return (
    <div 
      className="arch-node group relative rounded-3xl border border-slate-200 bg-white p-6 flex flex-col items-center text-center hover:border-indigo-200 hover:shadow-xl transition-all duration-300"
      style={{ animationDelay: `${delay}ms` }}
      role="listitem"
    >
      <div className="relative w-16 h-16 rounded-3xl bg-gradient-to-br from-slate-50 to-white flex items-center justify-center mb-5 ring-1 ring-slate-100 group-hover:ring-indigo-200 transition-all">
        <IconComp aria-hidden="true" className={`h-8 w-8 ${tintClass} transition-transform group-hover:scale-110`} />
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-60 transition" />
      </div>
      <span className="text-sm font-medium text-slate-700 tracking-tight">{label}</span>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState("");

  const features = useMemo(
    () => [
      {
        title: "Role-Based Access",
        description: "Enterprise-grade admin & user authorization with protected routes and audit trails.",
        icon: ShieldCheck,
      },
      {
        title: "Live Event Analytics",
        description: "Real-time dashboards, queue depth, worker health, latency metrics & instant notifications.",
        icon: Activity,
      },
      {
        title: "Real-Time Operations",
        description: "Jump straight into a fully simulated production environment. No signup required.",
        icon: PlayCircle,
      },
    ],
    []
  );

  useEffect(() => {
    document.title = "NotifyFlow — Real-Time Notification Platform";
    
    // Meta description
    const metaName = "description";
    const description = "NotifyFlow is a beautiful, production-ready event-driven notification dashboard. Try the live demo with real-time events, workers, analytics & admin tools.";
    let meta = document.querySelector(`meta[name="${metaName}"]`);
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", metaName);
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);

    // Reveal animations
    const items = document.querySelectorAll("[data-reveal]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    
    if (reducedMotion) {
      items.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }
    );

    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, []);

  async function startDemo() {
    setDemoError("");
    setIsDemoLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}${API_ROUTES.demoStart}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.message || "Failed to start demo");

      setDemoSession({
        mode: "demo",
        user: data.session?.user,
      });
      
      // Tiny delay for nice UX feel
      setTimeout(() => navigate("/event"), 180);
    } catch (error) {
      setDemoError(error.message || "Something went wrong. Please try again.");
    } finally {
      setIsDemoLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-hidden">
      <style>{`
        [data-reveal] {
          opacity: 0;
          transform: translateY(30px);
          transition: all 700ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        [data-reveal].is-visible {
          opacity: 1;
          transform: translateY(0);
        }

        .hero-glow {
          background:
            radial-gradient(circle at 15% 25%, rgba(99, 102, 241, 0.22), transparent 45%),
            radial-gradient(circle at 85% 35%, rgba(16, 185, 129, 0.18), transparent 45%),
            radial-gradient(circle at 35% 85%, rgba(139, 92, 246, 0.15), transparent 40%),
            linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%);
        }

        .btn-hover {
          transition: all 220ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-hover:hover {
          transform: translateY(-3px) scale(1.02);
        }

        .arch-node {
          transition: all 280ms cubic-bezier(0.23, 1, 0.32, 1);
        }

        .live-dot {
          animation: pulse 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .floating {
          animation: float 6s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-18px); }
        }
      `}</style>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 lg:py-12">
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sticky top-0 z-50 bg-white/80 backdrop-blur-xl py-4 sm:py-5 border-b border-slate-100" data-reveal>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-inner">
              <BellRing className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-bold text-xl sm:text-2xl tracking-tighter">NotifyFlow</div>
              <div className="text-[10px] text-slate-500 -mt-1">EVENT-DRIVEN</div>
            </div>
          </div>

          <nav className="grid grid-cols-2 sm:flex items-center gap-3 w-full sm:w-auto">
            <CtaButton 
              variant="ghost" 
              onClick={() => navigate("/auth")} 
              className="px-4 sm:px-5 text-sm w-full sm:w-auto"
              ariaLabel="Sign in"
            >
              Sign In
            </CtaButton>
            <CtaButton 
              variant="primary" 
              onClick={() => navigate("/auth?mode=register")} 
              className="px-4 sm:px-5 text-sm w-full sm:w-auto"
              ariaLabel="Get started free"
            >
              Get Started
            </CtaButton>
          </nav>
        </header>

        <main>
          {/* HERO */}
          <section 
            className="hero-glow mt-8 sm:mt-12 lg:mt-20 rounded-3xl p-5 sm:p-8 md:p-14 border border-slate-100 shadow-xl" 
            data-reveal 
            aria-labelledby="hero-title"
          >
            <div className="grid lg:grid-cols-12 gap-8 sm:gap-12 items-center">
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-1 border shadow-sm mb-6">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 live-dot" />
                  <span className="text-xs font-medium tracking-widest text-emerald-700">Launch Live Dashboard</span>
                </div>

                <h1 id="hero-title" className="text-3xl sm:text-5xl md:text-6xl font-bold leading-tight sm:leading-none tracking-tighter text-balance">
                  Real-time notifications.<br />
                  <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">Built to feel alive.</span>
                </h1>

                <p className="mt-4 sm:mt-6 text-base sm:text-xl text-slate-600 max-w-lg">
                  Manage live events, monitor workers, and analyze notifications in real-time production ready from day one
                </p>

                <div className="mt-8 sm:mt-10 grid sm:flex gap-3 sm:gap-4">
                  <CtaButton
                    onClick={startDemo}
                    disabled={isDemoLoading}
                    variant="success"
                    className="px-6 sm:px-8 py-3.5 sm:py-4 text-base sm:text-lg font-semibold shadow-2xl w-full sm:w-auto"
                    ariaLabel="Start live demo"
                    icon={Zap}
                  >
                    {isDemoLoading ? "Launching demo..." : "Try Live Demo Now"}
                  </CtaButton>

                  <CtaButton 
                    onClick={() => navigate("/auth?mode=register")} 
                    variant="primary" 
                    className="px-6 sm:px-8 py-3.5 sm:py-4 text-base sm:text-lg w-full sm:w-auto"
                    ariaLabel="Create account"
                  >
                    Create Free Account
                  </CtaButton>
                </div>

                {demoError && (
                  <p className="mt-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-2xl px-5 py-3 inline-block" role="alert">
                    ⚠️ {demoError}
                  </p>
                )}

                <div className="mt-12 flex items-center gap-8 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                    <div className="text-emerald-500">✓</div>
                    Real-time simulation
                  </div>
                </div>
              </div>

              {/* ARCHITECTURE DIAGRAM - NOW MORE LIVELY */}
              <div className="lg:col-span-5 relative">
                <div className="rounded-3xl border border-slate-200 bg-white/95 backdrop-blur p-5 sm:p-8 shadow-2xl">
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <div>
                      <div className="uppercase tracking-[2px] text-xs font-mono text-slate-500">System Architecture</div>
                      <div className="text-base sm:text-lg font-semibold text-slate-900">Fully connected &amp; live</div>
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-medium px-3 py-1 rounded-full">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full live-dot" />
                      LIVE
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" role="list" aria-label="System architecture">
                    <ArchitectureNode icon={Globe} label="REST API" tintClass="text-indigo-600" delay={100} />
                    <ArchitectureNode icon={Layers} label="Message Queue" tintClass="text-amber-600" delay={200} />
                    <ArchitectureNode icon={Cpu} label="Background Workers" tintClass="text-blue-600" delay={300} />
                    <ArchitectureNode icon={Activity} label="Events Processed" tintClass="text-purple-600" delay={400} />
                    <ArchitectureNode icon={Database} label="PostgreSQL" tintClass="text-emerald-600" delay={500} />
                    <ArchitectureNode icon={Megaphone} label="Broadcast Engine" tintClass="text-rose-600" delay={600} />
                  </div>

                  <div className="mt-8 text-center">
                    <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <div className="h-px w-8 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
                      Scalable • Resilient • Real-time
                      <div className="h-px w-8 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
                    </div>
                  </div>
                </div>

                {/* Floating badge */}
                <div className="hidden sm:flex absolute -top-5 -right-5 bg-white shadow-xl rounded-2xl px-5 py-2.5 items-center gap-3 text-sm border border-slate-100 floating">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="font-medium">Simulated 1.2k events/sec</span>
                </div>
              </div>
            </div>
          </section>

          {/* FEATURES */}
          <section className="mt-16 sm:mt-28" data-reveal aria-labelledby="features-title">
            <div className="text-center mb-8 sm:mb-12">
              <div className="inline-flex items-center gap-2 text-indigo-600 text-sm font-medium tracking-widest">
                <div className="h-px w-6 bg-indigo-200" /> POWERFUL BY DEFAULT
              </div>
              <h2 id="features-title" className="text-3xl sm:text-5xl font-bold tracking-tighter mt-3">Everything you need.<br />Nothing you don’t.</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <FeatureCard 
                  key={index}
                  title={feature.title} 
                  description={feature.description} 
                  icon={feature.icon} 
                />
              ))}
            </div>
          </section>

          {/* FINAL CTA */}
          <section 
            className="mt-16 sm:mt-28 rounded-3xl bg-gradient-to-br from-slate-900 to-zinc-900 text-white p-6 sm:p-12 md:p-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 shadow-2xl" 
            data-reveal
          >
            <div>
              <div className="uppercase tracking-widest text-emerald-400 text-sm font-medium">Ready when you are</div>
              <h3 className="text-2xl sm:text-4xl font-bold tracking-tight mt-3">Start exploring instantly.</h3>
              <p className="mt-3 text-slate-400 max-w-md">
                Try the full-featured demo in one click or create a permanent account and keep everything.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <CtaButton 
                onClick={startDemo} 
                variant="success" 
                className="px-8 sm:px-10 py-3.5 sm:py-4 text-base sm:text-lg flex-1 md:flex-none justify-center"
                ariaLabel="Try demo"
                icon={PlayCircle}
              >
                {isDemoLoading ? "Starting..." : "Launch Demo"}
              </CtaButton>
              
              <CtaButton 
                onClick={() => navigate("/auth?mode=register")} 
                variant="primary" 
                className="px-8 sm:px-10 py-3.5 sm:py-4 text-base sm:text-lg flex-1 md:flex-none justify-center border-white/30"
                ariaLabel="Sign up"
              >
                Sign Up Free
              </CtaButton>
            </div>
          </section>
        </main>

        {/* FOOTER */}
        <footer className="mt-16 sm:mt-28 border-t border-slate-100 pt-10 sm:pt-12 pb-12 sm:pb-20 text-center text-slate-400 text-sm">
          <div className="flex items-center justify-center gap-2 mb-4">
            <BellRing className="h-5 w-5 text-slate-300" />
            <span className="font-medium tracking-tight text-slate-900">NotifyFlow</span>
          </div>
          <p>© 2026 • A real-time notification platform</p>
        </footer>
      </div>
    </div>
  );
}
