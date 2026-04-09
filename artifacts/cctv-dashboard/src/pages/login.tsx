import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, XCircle, ShieldCheck, Wifi, Bell } from "lucide-react";
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
    <div className="min-h-screen w-full flex">
      {/* Left branding panel */}
      <div
        className="hidden lg:flex flex-col justify-between flex-1 p-12 relative overflow-hidden"
        style={{
          background: "linear-gradient(145deg, #1e40af 0%, #1d4ed8 40%, #2563eb 70%, #3b82f6 100%)",
        }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -right-16 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-blue-900/40" />
        <div className="absolute bottom-1/4 right-12 w-32 h-32 rounded-full bg-white/5" />

        {/* Logo */}
        <div className="relative z-10">
          <img src={logo} alt="Light Finance" className="h-12 w-auto object-contain brightness-0 invert" />
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8 max-w-md">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium tracking-wide">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              Live System Active
            </div>
            <h2 className="text-4xl font-bold text-white leading-tight">
              CCTV Monitoring<br />Portal
            </h2>
            <p className="text-blue-100 text-sm leading-relaxed opacity-90">
              Light Finance branches ka real-time CCTV network monitor karein. Sabhi devices ki live status ek jagah.
            </p>
          </div>

          {/* Feature pills */}
          <div className="space-y-3">
            {[
              { icon: ShieldCheck, text: "Secure role-based access" },
              { icon: Wifi, text: "255+ branches — All India" },
              { icon: Bell, text: "Instant offline alerts" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-blue-50 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-blue-200/60 text-xs">
          © 2026 Light Finance. All rights reserved.
        </p>
      </div>

      {/* Right login panel — white/light */}
      <div className="flex flex-1 lg:max-w-[440px] items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <img src={logo} alt="Light Finance" className="h-10 w-auto object-contain" />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back</h1>
            <p className="text-sm text-gray-500 mt-1">Apna account se sign in karein</p>
          </div>

          {/* Login card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                  Username
                </Label>
                <Input
                  id="username"
                  placeholder="Enter username"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(""); }}
                  disabled={loading}
                  className="h-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30 focus-visible:border-blue-400"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(""); }}
                    disabled={loading}
                    className="h-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30 focus-visible:border-blue-400 pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                  <XCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium gap-2 mt-1"
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            Default credentials: <span className="font-mono text-gray-500">admin</span> / <span className="font-mono text-gray-500">admin@123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
