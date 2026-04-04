import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Wifi, WifiOff, ShieldCheck, Save, TestTube2 } from "lucide-react";

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

  // Load existing settings on mount
  useEffect(() => {
    fetch(`${BASE}/api/settings`)
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        if (data.hik_account) setAccount(data.hik_account);
        if (data.hik_password_type) setPasswordType(data.hik_password_type as PasswordType);
        // Don't show masked password
        setIsLoaded(true);
      })
      .catch(() => setIsLoaded(true));
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

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Offline devices ke liye alert preferences configure karein.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between space-x-2">
              <div className="flex flex-col space-y-1">
                <Label>Email Alerts</Label>
                <span className="text-sm text-muted-foreground">
                  Offline branches ki daily summary receive karein.
                </span>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between space-x-2">
              <div className="flex flex-col space-y-1">
                <Label>Critical Alerts</Label>
                <span className="text-sm text-muted-foreground">
                  3+ days offline branches ke liye immediate notification.
                </span>
              </div>
              <Switch defaultChecked />
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
