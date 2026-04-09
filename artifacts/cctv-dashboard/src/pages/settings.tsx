import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailTestStatus, setEmailTestStatus] = useState<TestStatus>("idle");
  const [emailMessage, setEmailMessage] = useState("");

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

  void isLoaded;

  return (
    <div className="flex flex-col h-full gap-4 min-h-0">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Configure Hik-Connect integration and email notification preferences.
        </p>
      </div>

      <Tabs defaultValue="hikconnect" className="flex flex-col min-h-0 flex-1">
        <TabsList className="shrink-0 w-fit">
          <TabsTrigger value="hikconnect" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Hik-Connect
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email Settings
          </TabsTrigger>
        </TabsList>

        {/* ── Hik-Connect Tab ── */}
        <TabsContent value="hikconnect" className="flex-1 overflow-y-auto mt-4">
          <div className="max-w-2xl">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
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
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/40"
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
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/40"
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
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
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
                  <Mail className="h-5 w-5 text-primary" />
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
      </Tabs>
    </div>
  );
}
