import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Wifi, WifiOff, ShieldCheck, Save, TestTube2, Mail, Send, Clock, Plus, Trash2, Bell, BellOff } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

type PasswordType = "normal" | "encrypted";
type TestStatus = "idle" | "testing" | "success" | "failed";

export default function Settings() {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [passwordType, setPasswordType] = useState<PasswordType>("encrypted");
  const [showPassword, setShowPassword] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Email settings state
  const [emailHost, setEmailHost] = useState("");
  const [emailPort, setEmailPort] = useState("587");
  const [emailSecure, setEmailSecure] = useState(false);
  const [emailUser, setEmailUser] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [emailFrom, setEmailFrom] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailTestStatus, setEmailTestStatus] = useState<TestStatus>("idle");
  const [emailMessage, setEmailMessage] = useState("");

  // Scheduler state
  const [schedulerEnabled, setSchedulerEnabled] = useState(true);
  const [schedulerTimes, setSchedulerTimes] = useState<string[]>(["09:30", "17:30"]);
  const [newScheduleTime, setNewScheduleTime] = useState("09:00");
  const [schedulerSaving, setSchedulerSaving] = useState(false);
  const [schedulerMessage, setSchedulerMessage] = useState("");

  // Offline auto-alert state
  const [offlineAlertEnabled, setOfflineAlertEnabled] = useState(false);
  const [offlineAlertDelayHours, setOfflineAlertDelayHours] = useState("1");
  const [offlineAlertReminderHours, setOfflineAlertReminderHours] = useState("4");
  const [offlineAlertSaving, setOfflineAlertSaving] = useState(false);
  const [offlineAlertMessage, setOfflineAlertMessage] = useState("");

  useEffect(() => {
    fetch(`${BASE}/api/settings`)
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        if (data.hik_account) setAccount(data.hik_account);
        if (data.hik_password_type) setPasswordType(data.hik_password_type as PasswordType);
        setIsLoaded(true);
      })
      .catch(() => setIsLoaded(true));

    fetch(`${BASE}/api/settings/email`)
      .then((r) => r.json())
      .then((data: Record<string, string | number | boolean>) => {
        if (data.host) setEmailHost(String(data.host));
        if (data.port) setEmailPort(String(data.port));
        if (data.secure !== undefined) setEmailSecure(Boolean(data.secure));
        if (data.user) setEmailUser(String(data.user));
        if (data.from) setEmailFrom(String(data.from));
        if (data.enabled !== undefined) setEmailEnabled(Boolean(data.enabled));
      })
      .catch(() => {});

    fetch(`${BASE}/api/settings/scheduler`)
      .then((r) => r.json())
      .then((data: { enabled: boolean; times: string[] }) => {
        if (data.enabled !== undefined) setSchedulerEnabled(data.enabled);
        if (Array.isArray(data.times)) setSchedulerTimes(data.times);
      })
      .catch(() => {});

    fetch(`${BASE}/api/settings/offline-alerts`)
      .then((r) => r.json())
      .then((data: { enabled: boolean; delayHours: number; reminderHours: number }) => {
        if (data.enabled !== undefined) setOfflineAlertEnabled(data.enabled);
        if (data.delayHours !== undefined) setOfflineAlertDelayHours(String(data.delayHours));
        if (data.reminderHours !== undefined) setOfflineAlertReminderHours(String(data.reminderHours));
      })
      .catch(() => {});
  }, []);

  const handleTestConnection = async () => {
    if (!account || !password) {
      setTestStatus("failed");
      setTestMessage("User ID and Password are required.");
      return;
    }
    setTestStatus("testing");
    setTestMessage("");
    try {
      const res = await fetch(`${BASE}/api/settings/hikconnect/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, password, passwordType }),
      });
      const data = await res.json() as { success: boolean; message: string };
      setTestStatus(data.success ? "success" : "failed");
      setTestMessage(data.message);
    } catch {
      setTestStatus("failed");
      setTestMessage("Network error — could not connect to the API server.");
    }
  };

  const handleSaveSettings = async () => {
    if (!account || !password) {
      setSaveMessage("User ID and Password are required.");
      return;
    }
    setSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch(`${BASE}/api/settings/hikconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, password, passwordType }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (res.ok) {
        setSaveMessage("Settings saved successfully!");
        setTestStatus("idle");
      } else {
        setSaveMessage(data.error || "Save failed.");
      }
    } catch {
      setSaveMessage("Network error — could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!emailHost || !emailUser || !emailPassword) {
      setEmailTestStatus("failed");
      setEmailMessage("SMTP Host, Username, and Password are required.");
      return;
    }
    setEmailTestStatus("testing");
    setEmailMessage("");
    try {
      const res = await fetch(`${BASE}/api/settings/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: emailHost,
          port: parseInt(emailPort),
          secure: emailSecure,
          user: emailUser,
          password: emailPassword,
          from: emailFrom || emailUser,
          to: emailUser,
        }),
      });
      const data = await res.json() as { success: boolean; message: string };
      setEmailTestStatus(data.success ? "success" : "failed");
      setEmailMessage(data.message);
    } catch {
      setEmailTestStatus("failed");
      setEmailMessage("Network error — test could not be completed.");
    }
  };

  const handleSaveEmail = async () => {
    if (!emailHost || !emailUser || !emailPassword) {
      setEmailMessage("SMTP Host, Username, and Password are required.");
      return;
    }
    setEmailSaving(true);
    setEmailMessage("");
    try {
      const res = await fetch(`${BASE}/api/settings/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: emailHost,
          port: parseInt(emailPort),
          secure: emailSecure,
          user: emailUser,
          password: emailPassword,
          from: emailFrom || emailUser,
          to: "",
          enabled: emailEnabled,
        }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (res.ok) {
        setEmailMessage("Email settings saved successfully!");
        setEmailTestStatus("idle");
      } else {
        setEmailMessage(data.error || "Save failed.");
      }
    } catch {
      setEmailMessage("Network error — could not save changes.");
    } finally {
      setEmailSaving(false);
    }
  };

  const handleAddScheduleTime = () => {
    if (!newScheduleTime) return;
    if (schedulerTimes.includes(newScheduleTime)) return;
    setSchedulerTimes((prev) => [...prev, newScheduleTime].sort());
    setSchedulerMessage("");
  };

  const handleRemoveScheduleTime = (t: string) => {
    setSchedulerTimes((prev) => prev.filter((x) => x !== t));
    setSchedulerMessage("");
  };

  const handleSaveOfflineAlerts = async () => {
    setOfflineAlertSaving(true);
    setOfflineAlertMessage("");
    try {
      const res = await fetch(`${BASE}/api/settings/offline-alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: offlineAlertEnabled,
          delayHours: parseFloat(offlineAlertDelayHours) || 1,
          reminderHours: parseFloat(offlineAlertReminderHours) || 4,
        }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (res.ok) {
        setOfflineAlertMessage("Offline alert settings saved successfully!");
      } else {
        setOfflineAlertMessage(data.error || "Save failed.");
      }
    } catch {
      setOfflineAlertMessage("Network error — could not save changes.");
    } finally {
      setOfflineAlertSaving(false);
    }
  };

  const handleSaveScheduler = async () => {
    setSchedulerSaving(true);
    setSchedulerMessage("");
    try {
      const res = await fetch(`${BASE}/api/settings/scheduler`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: schedulerEnabled, times: schedulerTimes }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (res.ok) {
        setSchedulerMessage("Scheduler settings saved successfully!");
      } else {
        setSchedulerMessage(data.error || "Save failed.");
      }
    } catch {
      setSchedulerMessage("Network error — could not save changes.");
    } finally {
      setSchedulerSaving(false);
    }
  };

  void isLoaded;

  return (
    <div className="flex flex-col h-full gap-4 min-h-0">
      {/* ── Warm Header Banner ── */}
      <div
        className="rounded-2xl text-white p-6 shadow-lg relative overflow-hidden shrink-0"
        style={{ background: "linear-gradient(135deg, #78350f 0%, #b45309 45%, #d97706 100%)" }}
      >
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute -right-4 top-12 h-24 w-24 rounded-full bg-white/5" />
        <div className="absolute -left-6 -bottom-6 h-20 w-20 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-amber-100 text-sm mt-0.5">
              Configure Hik-Connect integration and email notification preferences.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="hikconnect" className="flex flex-col min-h-0 flex-1">
        <TabsList className="shrink-0 w-fit bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
          <TabsTrigger value="hikconnect" className="gap-2 data-[state=active]:bg-amber-700 data-[state=active]:text-white">
            <ShieldCheck className="h-4 w-4" />
            Hik-Connect
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2 data-[state=active]:bg-amber-700 data-[state=active]:text-white">
            <Mail className="h-4 w-4" />
            Email Settings
          </TabsTrigger>
          <TabsTrigger value="scheduler" className="gap-2 data-[state=active]:bg-amber-700 data-[state=active]:text-white">
            <Clock className="h-4 w-4" />
            Email Scheduler
          </TabsTrigger>
        </TabsList>

        {/* ── Hik-Connect Tab ── */}
        <TabsContent value="hikconnect" className="flex-1 overflow-y-auto mt-4">
          <div className="max-w-2xl">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <ShieldCheck className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                  </div>
                  <CardTitle>Hik-Connect Configuration</CardTitle>
                </div>
                <CardDescription>
                  Enter your Hik-Connect account credentials to fetch real-time device status.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* User ID */}
                <div className="space-y-1.5">
                  <Label htmlFor="hik-account">User ID / Account</Label>
                  <Input
                    id="hik-account"
                    placeholder="e.g. light_rajasthan"
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Account username from the Hik-Connect portal.
                  </p>
                </div>

                {/* Password Type */}
                <div className="space-y-2">
                  <Label>Password Type</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPasswordType("encrypted")}
                      className={`rounded-lg border-2 p-3 text-left transition-all ${
                        passwordType === "encrypted"
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                          : "border-border hover:border-amber-300"
                      }`}
                    >
                      <div className="font-medium text-sm">Encrypted Password</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        RSA/Base64 encoded string from Python code
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPasswordType("normal")}
                      className={`rounded-lg border-2 p-3 text-left transition-all ${
                        passwordType === "normal"
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                          : "border-border hover:border-amber-300"
                      }`}
                    >
                      <div className="font-medium text-sm">Normal Password</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Plain text — auto RSA-encrypted before sending
                      </div>
                    </button>
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="hik-password">
                    Password{" "}
                    <Badge variant="outline" className="ml-1 text-xs">
                      {passwordType === "encrypted" ? "Encrypted" : "Normal"}
                    </Badge>
                  </Label>
                  <div className="relative">
                    <Input
                      id="hik-password"
                      type={showPassword ? "text" : "password"}
                      placeholder={
                        passwordType === "encrypted"
                          ? "Paste RSA encrypted base64 string..."
                          : "Enter your Hik-Connect portal password..."
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordType === "normal" && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ Will be automatically RSA-encrypted before sending to Hik-Connect.
                    </p>
                  )}
                </div>

                {/* Test Status */}
                {testStatus !== "idle" && (
                  <div
                    className={`flex items-start gap-3 rounded-lg p-3 text-sm ${
                      testStatus === "testing"
                        ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : testStatus === "success"
                        ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {testStatus === "testing" && <Loader2 className="h-4 w-4 mt-0.5 animate-spin shrink-0" />}
                    {testStatus === "success" && <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />}
                    {testStatus === "failed" && <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                    <span>{testStatus === "testing" ? "Connecting to Hik-Connect..." : testMessage}</span>
                  </div>
                )}

                {saveMessage && (
                  <div
                    className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
                      saveMessage.includes("successfully")
                        ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {saveMessage.includes("successfully") ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0" />
                    )}
                    {saveMessage}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testStatus === "testing" || saving}
                    className="gap-2"
                  >
                    {testStatus === "testing" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : testStatus === "success" ? (
                      <Wifi className="h-4 w-4 text-green-600" />
                    ) : testStatus === "failed" ? (
                      <WifiOff className="h-4 w-4 text-red-600" />
                    ) : (
                      <TestTube2 className="h-4 w-4" />
                    )}
                    Test Connection
                  </Button>
                  <Button
                    onClick={handleSaveSettings}
                    disabled={saving || testStatus === "testing"}
                    className="gap-2"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Settings
                  </Button>
                </div>

                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    <strong>Tip:</strong> Test the connection first, then save. After saving, use "Refresh Now" on the Dashboard.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Email Settings Tab ── */}
        <TabsContent value="email" className="flex-1 overflow-y-auto mt-4">
          <div className="max-w-2xl">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Mail className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                  </div>
                  <CardTitle>Email / SMTP Configuration</CardTitle>
                </div>
                <CardDescription>
                  Configure SMTP settings for sending offline alert and user notification emails.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Enable Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <div>
                    <Label className="text-sm font-medium">Email Notifications</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Enable sending emails for user creation and offline alerts
                    </p>
                  </div>
                  <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                </div>

                {/* Host + Port */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="email-host">SMTP Host</Label>
                    <Input
                      id="email-host"
                      placeholder="smtp.gmail.com"
                      value={emailHost}
                      onChange={(e) => setEmailHost(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email-port">Port</Label>
                    <Select
                      value={emailPort}
                      onValueChange={(v) => { setEmailPort(v); setEmailSecure(v === "465"); }}
                    >
                      <SelectTrigger id="email-port">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="587">587 (TLS)</SelectItem>
                        <SelectItem value="465">465 (SSL)</SelectItem>
                        <SelectItem value="25">25 (SMTP)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Username + Password */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email-user">SMTP Username / Email</Label>
                    <Input
                      id="email-user"
                      type="email"
                      placeholder="alerts@yourcompany.com"
                      value={emailUser}
                      onChange={(e) => setEmailUser(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email-password">SMTP Password / App Password</Label>
                    <div className="relative flex items-center">
                      <Input
                        id="email-password"
                        type={showEmailPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={emailPassword}
                        onChange={(e) => setEmailPassword(e.target.value)}
                        className="pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmailPassword(!showEmailPassword)}
                        className="absolute right-2.5 text-muted-foreground hover:text-foreground"
                      >
                        {showEmailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* From Address */}
                <div className="space-y-1.5">
                  <Label htmlFor="email-from">From Address <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="email-from"
                    type="email"
                    placeholder="noreply@yourcompany.com"
                    value={emailFrom}
                    onChange={(e) => setEmailFrom(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    If left blank, the SMTP username will be used as the sender address.
                  </p>
                </div>

                {/* Status Message */}
                {emailMessage && (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                      emailMessage.includes("successfully") || emailMessage.includes("sent")
                        ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {emailMessage.includes("successfully") || emailMessage.includes("sent")
                      ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                      : <XCircle className="h-4 w-4 shrink-0" />}
                    {emailMessage}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <Button
                    variant="outline"
                    onClick={handleTestEmail}
                    disabled={emailTestStatus === "testing" || emailSaving}
                    className="gap-2"
                  >
                    {emailTestStatus === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> :
                     emailTestStatus === "success" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                     emailTestStatus === "failed" ? <XCircle className="h-4 w-4 text-red-600" /> :
                     <Send className="h-4 w-4" />}
                    Test Email
                  </Button>
                  <Button
                    onClick={handleSaveEmail}
                    disabled={emailSaving || emailTestStatus === "testing"}
                    className="gap-2"
                  >
                    {emailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Email Settings
                  </Button>
                </div>

                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    <strong>Gmail tip:</strong> Enable 2-Step Verification and generate an App Password (Google Account → Security → App passwords). Your regular password will not work.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Email Scheduler Tab ── */}
        <TabsContent value="scheduler" className="flex-1 overflow-y-auto mt-4">
          <div className="max-w-2xl space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                  </div>
                  <CardTitle>Email Scheduler</CardTitle>
                </div>
                <CardDescription>
                  Set the times when offline alert emails are automatically sent each day (IST).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Enable toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <div>
                    <Label className="text-sm font-medium">Scheduled Emails</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Automatically send offline alerts at the configured times every day
                    </p>
                  </div>
                  <Switch checked={schedulerEnabled} onCheckedChange={setSchedulerEnabled} />
                </div>

                {/* Add new time */}
                <div className="space-y-1.5">
                  <Label>Add Schedule Time <span className="text-muted-foreground font-normal text-xs">(IST, 24-hour)</span></Label>
                  <div className="flex gap-2">
                    <Input
                      type="time"
                      value={newScheduleTime}
                      onChange={(e) => setNewScheduleTime(e.target.value)}
                      className="w-36"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddScheduleTime}
                      disabled={!newScheduleTime || schedulerTimes.includes(newScheduleTime)}
                      className="gap-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      Add Time
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select a time and click Add. You can add multiple daily schedule times.
                  </p>
                </div>

                {/* Current scheduled times */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Scheduled Times ({schedulerTimes.length})
                  </Label>
                  {schedulerTimes.length > 0 ? (
                    <div className="rounded-lg border border-border/60 divide-y divide-border/40 overflow-hidden">
                      {schedulerTimes.map((t) => {
                        const [hh, mm] = t.split(":");
                        const h = parseInt(hh, 10);
                        const ampm = h >= 12 ? "PM" : "AM";
                        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                        const label = `${String(h12).padStart(2, "0")}:${mm} ${ampm}`;
                        return (
                          <div key={t} className="flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                <Clock className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{label} IST</p>
                                <p className="text-xs text-muted-foreground">{t} (24hr)</p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => handleRemoveScheduleTime(t)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/50 p-6 text-center">
                      <Clock className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No schedule times added yet.</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">Add a time above to start scheduling.</p>
                    </div>
                  )}
                </div>

                {/* Status message */}
                {schedulerMessage && (
                  <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                    schedulerMessage.includes("successfully")
                      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                  }`}>
                    {schedulerMessage.includes("successfully")
                      ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                      : <XCircle className="h-4 w-4 shrink-0" />}
                    {schedulerMessage}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <Button onClick={handleSaveScheduler} disabled={schedulerSaving} className="gap-2">
                    {schedulerSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Schedule
                  </Button>
                </div>

                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    <strong>Note:</strong> Times are in IST (Indian Standard Time). The system checks every minute and sends the email automatically when the time matches.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Offline Auto-Alert Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Bell className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div>
                    <CardTitle>Automatic Offline Alert Trigger</CardTitle>
                    <CardDescription className="mt-0.5">
                      Auto-send email when a device goes offline for a set duration, with optional periodic reminders.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Enable Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2">
                    {offlineAlertEnabled
                      ? <Bell className="h-4 w-4 text-green-600 shrink-0" />
                      : <BellOff className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <div>
                      <Label className="text-sm font-medium">Auto Offline Alert</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {offlineAlertEnabled
                          ? "Active — notifications will be sent automatically"
                          : "Disabled — no automatic notifications"}
                      </p>
                    </div>
                  </div>
                  <Switch checked={offlineAlertEnabled} onCheckedChange={setOfflineAlertEnabled} />
                </div>

                <div className={`space-y-4 transition-opacity ${offlineAlertEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                  {/* Delay Hours */}
                  <div className="space-y-1.5">
                    <Label htmlFor="alert-delay">
                      Initial Alert Delay{" "}
                      <span className="text-muted-foreground font-normal text-xs">(hours after device goes offline)</span>
                    </Label>
                    <div className="flex items-center gap-3">
                      <Select
                        value={offlineAlertDelayHours}
                        onValueChange={setOfflineAlertDelayHours}
                        disabled={!offlineAlertEnabled}
                      >
                        <SelectTrigger id="alert-delay" className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.25">15 minutes</SelectItem>
                          <SelectItem value="0.5">30 minutes</SelectItem>
                          <SelectItem value="1">1 hour</SelectItem>
                          <SelectItem value="2">2 hours</SelectItem>
                          <SelectItem value="3">3 hours</SelectItem>
                          <SelectItem value="4">4 hours</SelectItem>
                          <SelectItem value="6">6 hours</SelectItem>
                          <SelectItem value="8">8 hours</SelectItem>
                          <SelectItem value="12">12 hours</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Wait this long before sending the first notification
                      </p>
                    </div>
                  </div>

                  {/* Reminder Hours */}
                  <div className="space-y-1.5">
                    <Label htmlFor="alert-reminder">
                      Reminder Interval{" "}
                      <span className="text-muted-foreground font-normal text-xs">(repeat notifications while device stays offline)</span>
                    </Label>
                    <div className="flex items-center gap-3">
                      <Select
                        value={offlineAlertReminderHours}
                        onValueChange={setOfflineAlertReminderHours}
                        disabled={!offlineAlertEnabled}
                      >
                        <SelectTrigger id="alert-reminder" className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">No reminders</SelectItem>
                          <SelectItem value="1">Every 1 hour</SelectItem>
                          <SelectItem value="2">Every 2 hours</SelectItem>
                          <SelectItem value="3">Every 3 hours</SelectItem>
                          <SelectItem value="4">Every 4 hours</SelectItem>
                          <SelectItem value="6">Every 6 hours</SelectItem>
                          <SelectItem value="8">Every 8 hours</SelectItem>
                          <SelectItem value="12">Every 12 hours</SelectItem>
                          <SelectItem value="24">Every 24 hours</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Set to "No reminders" to send only once
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 p-3 text-xs text-blue-800 dark:text-blue-300 space-y-1">
                    <p className="font-semibold">How it works:</p>
                    <p>1. A device goes offline and is detected by the system.</p>
                    <p>2. After <strong>{offlineAlertDelayHours === "0.25" ? "15 min" : offlineAlertDelayHours === "0.5" ? "30 min" : `${offlineAlertDelayHours} hr`}</strong>, the first alert email is sent automatically.</p>
                    {offlineAlertReminderHours !== "0"
                      ? <p>3. A reminder is sent every <strong>{offlineAlertReminderHours} hr</strong> until the device comes back online.</p>
                      : <p>3. No reminders — alert sent only once per offline event.</p>
                    }
                    <p>The check runs automatically every 5 minutes.</p>
                  </div>
                </div>

                {/* Status message */}
                {offlineAlertMessage && (
                  <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                    offlineAlertMessage.includes("successfully")
                      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                  }`}>
                    {offlineAlertMessage.includes("successfully")
                      ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                      : <XCircle className="h-4 w-4 shrink-0" />}
                    {offlineAlertMessage}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <Button onClick={handleSaveOfflineAlerts} disabled={offlineAlertSaving} className="gap-2">
                    {offlineAlertSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Alert Settings
                  </Button>
                </div>

              </CardContent>
            </Card>

          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
