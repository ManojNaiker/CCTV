import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Wifi, WifiOff, ShieldCheck, Save, TestTube2, Mail, Send } from "lucide-react";

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
  const [emailTo, setEmailTo] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailTestStatus, setEmailTestStatus] = useState<TestStatus>("idle");
  const [emailMessage, setEmailMessage] = useState("");

  // Load existing settings on mount
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
        if (data.to) setEmailTo(String(data.to));
        if (data.enabled !== undefined) setEmailEnabled(Boolean(data.enabled));
      })
      .catch(() => {});
  }, []);

  const handleTestConnection = async () => {
    if (!account || !password) {
      setTestStatus("failed");
      setTestMessage("User ID aur Password dono required hain.");
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
      setTestMessage("Network error — API server se connect nahi ho saka.");
    }
  };

  const handleSaveSettings = async () => {
    if (!account || !password) {
      setSaveMessage("User ID aur Password required hain.");
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
        // Clear test state on save
        setTestStatus("idle");
      } else {
        setSaveMessage(data.error || "Save failed.");
      }
    } catch {
      setSaveMessage("Network error — save nahi ho saka.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!emailHost || !emailUser || !emailPassword || !emailTo) {
      setEmailTestStatus("failed");
      setEmailMessage("SMTP Host, User, Password, aur To email required hain.");
      return;
    }
    setEmailTestStatus("testing");
    setEmailMessage("");
    try {
      const res = await fetch(`${BASE}/api/settings/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: emailHost, port: parseInt(emailPort), secure: emailSecure, user: emailUser, password: emailPassword, from: emailFrom || emailUser, to: emailTo }),
      });
      const data = await res.json() as { success: boolean; message: string };
      setEmailTestStatus(data.success ? "success" : "failed");
      setEmailMessage(data.message);
    } catch {
      setEmailTestStatus("failed");
      setEmailMessage("Network error — test nahi ho saka.");
    }
  };

  const handleSaveEmail = async () => {
    if (!emailHost || !emailUser || !emailPassword || !emailTo) {
      setEmailMessage("SMTP Host, User, Password, aur To email required hain.");
      return;
    }
    setEmailSaving(true);
    setEmailMessage("");
    try {
      const res = await fetch(`${BASE}/api/settings/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: emailHost, port: parseInt(emailPort), secure: emailSecure, user: emailUser, password: emailPassword, from: emailFrom || emailUser, to: emailTo, enabled: emailEnabled }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (res.ok) {
        setEmailMessage("Email settings saved successfully!");
        setEmailTestStatus("idle");
      } else {
        setEmailMessage(data.error || "Save failed.");
      }
    } catch {
      setEmailMessage("Network error — save nahi ho saka.");
    } finally {
      setEmailSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Application preferences aur Hik-Connect integration configure karein.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Hik-Connect Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle>Hik-Connect Configuration</CardTitle>
            </div>
            <CardDescription>
              Apna Hik-Connect account credentials yahan configure karein. Yeh credentials use hote hain
              real-time device status fetch karne ke liye.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* User ID */}
            <div className="space-y-2">
              <Label htmlFor="hik-account">User ID / Account</Label>
              <Input
                id="hik-account"
                placeholder="e.g. light_rajasthan"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Hik-Connect portal ka account username daalein.
              </p>
            </div>

            {/* Password Type Toggle */}
            <div className="space-y-3">
              <Label>Password Type</Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPasswordType("encrypted")}
                  className={`flex-1 rounded-lg border-2 p-3 text-left transition-all ${
                    passwordType === "encrypted"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <div className="font-medium text-sm">Encrypted Password</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    RSA/Base64 encoded password (Python code wali encrypted string)
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordType("normal")}
                  className={`flex-1 rounded-lg border-2 p-3 text-left transition-all ${
                    passwordType === "normal"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <div className="font-medium text-sm">Normal Password</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Hik-Connect portal ka plain text password (RSA encrypt auto hoga)
                  </div>
                </button>
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
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
                      ? "RSA encrypted base64 string paste karein..."
                      : "Hik-Connect portal ka password daalein..."
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
              {passwordType === "encrypted" && (
                <p className="text-xs text-muted-foreground">
                  Yeh woh encrypted string hai jo aapke Python code mein thi (tz7jHgGW... wali).
                  Isko seedha paste karein.
                </p>
              )}
              {passwordType === "normal" && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Normal password automatically RSA encrypt hoga Hik-Connect ke saath bhejne se pehle.
                </p>
              )}
            </div>

            {/* Test Status */}
            {testStatus !== "idle" && (
              <div
                className={`flex items-start gap-3 rounded-lg p-3 text-sm ${
                  testStatus === "testing"
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    : testStatus === "success"
                    ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                }`}
              >
                {testStatus === "testing" && <Loader2 className="h-4 w-4 mt-0.5 animate-spin shrink-0" />}
                {testStatus === "success" && <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />}
                {testStatus === "failed" && <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                <span>{testStatus === "testing" ? "Hik-Connect se connect ho raha hai..." : testMessage}</span>
              </div>
            )}

            {/* Save message */}
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

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
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
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Settings
              </Button>
            </div>

            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground">
                <strong>Tip:</strong> "Test Connection" pehle try karein. Agar successful ho toh
                "Save Settings" karein. Save hone ke baad Dashboard se "Refresh Now" karein.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>Email / SMTP Configuration</CardTitle>
            </div>
            <CardDescription>
              User creation aur offline alerts ke liye email notifications configure karein.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
              <div>
                <Label className="text-sm font-medium">Email Notifications</Label>
                <p className="text-xs text-muted-foreground mt-0.5">User creation aur alerts ke liye emails bhejein</p>
              </div>
              <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
            </div>

            {/* SMTP Row 1: Host + Port */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="email-host">SMTP Host</Label>
                <Input id="email-host" placeholder="smtp.gmail.com" value={emailHost} onChange={e => setEmailHost(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email-port">Port</Label>
                <Select value={emailPort} onValueChange={v => { setEmailPort(v); setEmailSecure(v === "465"); }}>
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

            {/* SMTP User + Password */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="email-user">SMTP Username / Email</Label>
                <Input id="email-user" type="email" placeholder="alerts@yourcompany.com" value={emailUser} onChange={e => setEmailUser(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email-password">SMTP Password / App Password</Label>
                <div className="relative">
                  <Input id="email-password" type={showEmailPassword ? "text" : "password"} placeholder="••••••••" value={emailPassword} onChange={e => setEmailPassword(e.target.value)} className="pr-10" />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowEmailPassword(!showEmailPassword)}>
                    {showEmailPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* From + To */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="email-from">From Address (optional)</Label>
                <Input id="email-from" type="email" placeholder="noreply@yourcompany.com" value={emailFrom} onChange={e => setEmailFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email-to">Notification Recipients</Label>
                <Input id="email-to" type="email" placeholder="admin@yourcompany.com, it@company.com" value={emailTo} onChange={e => setEmailTo(e.target.value)} />
                <p className="text-xs text-muted-foreground">Multiple emails comma se separate karein</p>
              </div>
            </div>

            {/* Status Message */}
            {emailMessage && (
              <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                emailMessage.includes("successfully") || emailMessage.includes("sent")
                  ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                  : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              }`}>
                {emailMessage.includes("successfully") || emailMessage.includes("sent")
                  ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                  : <XCircle className="h-4 w-4 shrink-0" />}
                {emailMessage}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-1">
              <Button variant="outline" onClick={handleTestEmail} disabled={emailTestStatus === "testing" || emailSaving} className="gap-2">
                {emailTestStatus === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> :
                 emailTestStatus === "success" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                 emailTestStatus === "failed" ? <XCircle className="h-4 w-4 text-red-600" /> :
                 <Send className="h-4 w-4" />}
                Test Email
              </Button>
              <Button onClick={handleSaveEmail} disabled={emailSaving || emailTestStatus === "testing"} className="gap-2">
                {emailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Email Settings
              </Button>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground">
                <strong>Gmail tip:</strong> 2-Step Verification enable karein aur "App Password" generate karein (Google Account → Security → App passwords). Regular password kaam nahi karega.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
            <CardDescription>
              Current installation ki technical details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-muted-foreground">Version</div>
              <div className="font-mono">v1.2.0</div>
              <div className="text-muted-foreground">Hik-Connect Region</div>
              <div className="font-mono">India (iindia.hik-connect.com)</div>
              <div className="text-muted-foreground">Auto-Refresh Interval</div>
              <div className="font-mono">2 minutes</div>
              <div className="text-muted-foreground">Total Devices Tracked</div>
              <div className="font-mono">255 branches</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
