import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, XCircle } from "lucide-react";
import logo from "@assets/logo_1775302555993.png";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Username aur password dono required hain.");
      return;
    }
    setLoading(true);
    setError("");
    const result = await login(username.trim(), password);
    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex relative overflow-hidden bg-slate-950">
      {/* Background design */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-800/20 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-indigo-900/30 via-transparent to-transparent" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Left branding panel — hidden on small screens */}
      <div className="hidden lg:flex flex-col justify-between flex-1 p-12 relative z-10">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Light Finance" className="h-10 w-auto object-contain" />
        </div>

        <div className="space-y-6 max-w-md">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-medium tracking-wider uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              Live Monitoring
            </div>
            <h2 className="text-4xl font-bold text-white leading-tight">
              CCTV Monitoring<br />
              <span className="text-blue-400">Command Center</span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Real-time visibility across all Light Finance branches. Monitor device health, receive instant alerts, and keep your network secure.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Branches", value: "255+" },
              { label: "States", value: "All India" },
              { label: "Uptime", value: "24/7" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                <div className="text-white font-bold text-lg">{value}</div>
                <div className="text-slate-400 text-xs mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-xs">
          © 2026 Light Finance. All rights reserved.
        </p>
      </div>

      {/* Right login panel */}
      <div className="flex flex-1 lg:max-w-md items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-sm space-y-6">

          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center">
            <img src={logo} alt="Light Finance" className="h-10 w-auto object-contain" />
          </div>

          {/* Login card */}
          <div className="rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-xl shadow-2xl p-8 space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-xl font-bold text-white">Sign In</h1>
              <p className="text-sm text-slate-400">Apna account se portal access karein</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs text-slate-300 font-medium uppercase tracking-wider">
                  Username
                </Label>
                <Input
                  id="username"
                  placeholder="admin"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(""); }}
                  disabled={loading}
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50 h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs text-slate-300 font-medium uppercase tracking-wider">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(""); }}
                    disabled={loading}
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50 h-10 pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                  <XCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white font-medium gap-2 mt-2"
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-600">
            Default: <span className="font-mono text-slate-500">admin</span> / <span className="font-mono text-slate-500">admin@123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
