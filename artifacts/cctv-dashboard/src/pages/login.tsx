import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye, EyeOff, Loader2, XCircle, ShieldCheck, Wifi, Bell,
  CheckCircle2, ArrowLeft, User, Lock, KeyRound,
} from "lucide-react";
import logo from "@assets/logo_1775302555993.png";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

type ForgotStep = "username" | "otp";

export default function LoginPage() {
  const { login } = useAuth();

  const [mode, setMode] = useState<"login" | "forgot">("login");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [forgotStep, setForgotStep] = useState<ForgotStep>("username");
  const [forgotUsername, setForgotUsername] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Username and password are required.");
      return;
    }
    setLoading(true);
    setError("");
    const result = await login(username.trim(), password);
    if (result.error) setError(result.error);
    setLoading(false);
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim()) {
      setForgotError("Please enter your username or email.");
      return;
    }
    setForgotLoading(true);
    setForgotError("");
    try {
      const res = await fetch(`${BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUsername.trim() }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setForgotError(data.error || "Failed to send OTP."); return; }
      setForgotStep("otp");
    } catch {
      setForgotError("Network error. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || !newPassword || !confirmPassword) { setForgotError("All fields are required."); return; }
    if (newPassword !== confirmPassword) { setForgotError("Passwords do not match."); return; }
    if (newPassword.length < 6) { setForgotError("Password must be at least 6 characters."); return; }
    setForgotLoading(true);
    setForgotError("");
    try {
      const res = await fetch(`${BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUsername.trim(), otp: otp.trim(), newPassword }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setForgotError(data.error || "Failed to reset password."); return; }
      setForgotSuccess(true);
    } catch {
      setForgotError("Network error. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const resetForgot = () => {
    setMode("login");
    setForgotStep("username");
    setForgotUsername("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setForgotError("");
    setForgotSuccess(false);
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Left branding panel */}
      <div
        className="hidden lg:flex flex-col justify-between flex-1 p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #1e40af 0%, #1d4ed8 40%, #2563eb 70%, #3b82f6 100%)" }}
      >
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -right-16 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-blue-900/40" />
        <div className="absolute bottom-1/4 right-12 w-32 h-32 rounded-full bg-white/5" />

        <div className="relative z-10">
          <img src={logo} alt="Light Finance" className="h-12 w-auto object-contain brightness-0 invert" />
        </div>

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
              Real-time CCTV network monitoring for all Light Finance branches. Live device status in one place.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: ShieldCheck, text: "Secure role-based access control" },
              { icon: Wifi, text: "255+ branches monitored — All India" },
              { icon: Bell, text: "Instant offline alerts & notifications" },
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

      {/* Right panel */}
      <div className="flex flex-1 lg:max-w-[460px] items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-6">
            <img src={logo} alt="Light Finance" className="h-10 w-auto object-contain" />
          </div>

          {mode === "login" ? (
            <>
              {/* Heading */}
              <div className="mb-7">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-3 tracking-wide">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  CCTV Monitoring Portal
                </div>
                <h1 className="text-[26px] font-bold text-gray-900 tracking-tight leading-tight">
                  Welcome Back
                </h1>
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                  Sign in with your credentials to access the<br className="hidden sm:block" /> monitoring dashboard.
                </p>
              </div>

              {/* Form card */}
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 space-y-5">
                <form onSubmit={handleSubmit} className="space-y-4">

                  {/* Username */}
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-sm font-semibold text-gray-700">
                      Username or Email
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <Input
                        id="username"
                        placeholder="Enter your username or email"
                        autoComplete="username"
                        autoFocus
                        value={username}
                        onChange={e => { setUsername(e.target.value); setError(""); }}
                        disabled={loading}
                        className="h-11 pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30 focus-visible:border-blue-400 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                        Password
                      </Label>
                      <button
                        type="button"
                        onClick={() => { setMode("forgot"); setForgotUsername(username); }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors hover:underline underline-offset-2"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError(""); }}
                        disabled={loading}
                        className="h-11 pl-10 pr-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30 focus-visible:border-blue-400 transition-colors"
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

                  {/* Error */}
                  {error && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                      <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    type="submit"
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl gap-2 shadow-sm shadow-blue-200 transition-all mt-1"
                    disabled={loading}
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? "Signing in…" : "Sign In"}
                  </Button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-400 font-medium">default credentials</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                {/* Default credentials */}
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-xs text-gray-500">
                    <span className="block font-semibold text-gray-600 mb-0.5">Administrator</span>
                    <span className="font-mono text-gray-700">admin</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="font-mono text-gray-700">admin@123</span>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-blue-400 shrink-0" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-7">
                <button
                  type="button"
                  onClick={resetForgot}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-4 transition-colors font-medium"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Login
                </button>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-3 tracking-wide">
                  <KeyRound className="h-3 w-3" />
                  Password Recovery
                </div>
                <h1 className="text-[26px] font-bold text-gray-900 tracking-tight">Reset Password</h1>
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                  {forgotStep === "username"
                    ? "Enter your username or email address to receive an OTP on your registered email."
                    : "OTP has been sent to your email. Enter it below along with your new password."}
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                {forgotSuccess ? (
                  <div className="text-center py-4 space-y-4">
                    <div className="flex justify-center">
                      <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-lg">Password Reset Successful!</p>
                      <p className="text-sm text-gray-500 mt-1">You can now sign in with your new password.</p>
                    </div>
                    <Button className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl" onClick={resetForgot}>
                      Go to Login
                    </Button>
                  </div>
                ) : forgotStep === "username" ? (
                  <form onSubmit={handleRequestOtp} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="forgotUsername" className="text-sm font-semibold text-gray-700">Username or Email</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        <Input
                          id="forgotUsername"
                          placeholder="Enter your username or email"
                          autoFocus
                          value={forgotUsername}
                          onChange={e => { setForgotUsername(e.target.value); setForgotError(""); }}
                          disabled={forgotLoading}
                          className="h-11 pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30 focus-visible:border-blue-400"
                        />
                      </div>
                    </div>

                    {forgotError && (
                      <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                        <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{forgotError}</span>
                      </div>
                    )}

                    <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl gap-2" disabled={forgotLoading}>
                      {forgotLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {forgotLoading ? "Sending OTP…" : "Send OTP via Email"}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="otp" className="text-sm font-semibold text-gray-700">One-Time Password (OTP)</Label>
                      <Input
                        id="otp"
                        placeholder="Enter 6-digit OTP"
                        autoFocus
                        maxLength={6}
                        value={otp}
                        onChange={e => { setOtp(e.target.value.replace(/\D/g, "")); setForgotError(""); }}
                        disabled={forgotLoading}
                        className="h-11 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30 focus-visible:border-blue-400 font-mono text-center tracking-[0.35em] text-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="newPassword" className="text-sm font-semibold text-gray-700">New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        <Input
                          id="newPassword"
                          type={showNew ? "text" : "password"}
                          placeholder="Minimum 6 characters"
                          value={newPassword}
                          onChange={e => { setNewPassword(e.target.value); setForgotError(""); }}
                          disabled={forgotLoading}
                          className="h-11 pl-10 pr-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30 focus-visible:border-blue-400"
                        />
                        <button type="button" tabIndex={-1} onClick={() => setShowNew(s => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                          {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-700">Confirm New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        <Input
                          id="confirmPassword"
                          type={showConfirm ? "text" : "password"}
                          placeholder="Re-enter new password"
                          value={confirmPassword}
                          onChange={e => { setConfirmPassword(e.target.value); setForgotError(""); }}
                          disabled={forgotLoading}
                          className="h-11 pl-10 pr-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30 focus-visible:border-blue-400"
                        />
                        <button type="button" tabIndex={-1} onClick={() => setShowConfirm(s => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {forgotError && (
                      <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                        <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{forgotError}</span>
                      </div>
                    )}

                    <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl gap-2" disabled={forgotLoading}>
                      {forgotLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {forgotLoading ? "Resetting…" : "Reset Password"}
                    </Button>

                    <button
                      type="button"
                      onClick={() => { setForgotStep("username"); setForgotError(""); setOtp(""); }}
                      className="w-full text-sm text-gray-500 hover:text-blue-600 font-medium transition-colors pt-1"
                    >
                      ← Resend OTP
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
