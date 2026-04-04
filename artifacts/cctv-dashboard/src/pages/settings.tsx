import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure application preferences and integrations.
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Configure how you want to be alerted about offline devices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between space-x-2">
              <div className="flex flex-col space-y-1">
                <Label>Email Alerts</Label>
                <span className="text-sm text-muted-foreground">
                  Receive daily summaries of offline branches.
                </span>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between space-x-2">
              <div className="flex flex-col space-y-1">
                <Label>Critical Alerts</Label>
                <span className="text-sm text-muted-foreground">
                  Immediate notifications for extended offline streaks.
                </span>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
            <CardDescription>
              Technical details about the current installation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-muted-foreground">Version</div>
              <div className="font-mono">v1.2.0-beta</div>
              <div className="text-muted-foreground">API Endpoint</div>
              <div className="font-mono">/api/v1</div>
              <div className="text-muted-foreground">Environment</div>
              <div className="font-mono">Production</div>
            </div>
            <Button variant="outline" className="mt-4">Download Diagnostics</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
