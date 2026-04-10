import { Link, useLocation } from "wouter";
import { useTheme } from "next-themes";
import { 
  Users, 
  Activity, 
  Settings, 
  LogOut, 
  Menu, 
  ShieldCheck,
  LayoutDashboard,
  Sun,
  Moon,
  Monitor,
  WifiOff,
  UserCircle,
  AtSign,
  CalendarDays,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useAuth } from "@/context/auth-context";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const icon =
    theme === "dark" ? <Moon className="h-4 w-4" /> :
    theme === "light" ? <Sun className="h-4 w-4" /> :
    <Monitor className="h-4 w-4" />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent" title="Toggle theme">
          {icon}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[130px]">
        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setTheme("light")}>
          <Sun className="h-3.5 w-3.5" /> Light
          {theme === "light" && <span className="ml-auto text-primary text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setTheme("dark")}>
          <Moon className="h-3.5 w-3.5" /> Dark
          {theme === "dark" && <span className="ml-auto text-primary text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setTheme("system")}>
          <Monitor className="h-3.5 w-3.5" /> System
          {theme === "system" && <span className="ml-auto text-primary text-xs">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { state, logout } = useAuth();

  const user = state.status === "authenticated" ? state.user : null;

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/devices", label: "Devices", icon: ShieldCheck },
    { href: "/offline-report", label: "Offline Report", icon: WifiOff },
    { href: "/status-report", label: "Status Report", icon: CalendarDays },
    { href: "/dvr-storage", label: "DVR Storage", icon: HardDrive },
    { href: "/cc-list", label: "Branch CC List", icon: AtSign },
    { href: "/users", label: "Users", icon: Users },
    { href: "/audit-logs", label: "Audit Logs", icon: Activity },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const NavLinks = () => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
            <span
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer text-sm font-medium relative ${
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md font-semibold"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-sidebar-primary-foreground/60" />
              )}
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "opacity-100" : "opacity-70"}`} />
              {item.label}
            </span>
          </Link>
        );
      })}
    </>
  );

  const LogoBlock = () => (
    <div className="flex items-center gap-2 px-2 mb-6">
      <img
        src="/logo.png"
        alt="Light Finance"
        className="h-10 w-auto object-contain"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );

  const UserBlock = () => (
    <div className="flex items-center gap-3 px-3 py-2.5 mb-4 rounded-xl bg-sidebar-accent/60 border border-sidebar-border/30">
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-500/20 border border-blue-400/30 shrink-0">
        <UserCircle className="h-4 w-4 text-blue-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.fullName ?? user?.username}</p>
        <p className="text-[10px] text-sidebar-foreground/40 capitalize tracking-wide">{user?.role}</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full flex-col bg-background md:flex-row overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-sidebar-border px-4 py-6 md:flex bg-sidebar h-screen sticky top-0 shrink-0">
        <LogoBlock />
        {user && <UserBlock />}

        <p className="text-[10px] font-semibold text-sidebar-foreground/30 uppercase tracking-widest px-3 mb-2">Navigation</p>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          <NavLinks />
        </nav>

        <div className="mt-auto flex items-center justify-between gap-2 pt-4 border-t border-sidebar-border/40 shrink-0">
          <Button
            variant="ghost"
            className="flex-1 justify-start gap-3 text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent text-sm h-9 font-medium"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile Header & Content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-y-auto">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 md:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="sm:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 sm:max-w-none">
              <div className="px-2 mb-6 pt-2">
                <img src="/logo.png" alt="Light Finance" className="h-10 w-auto object-contain" />
              </div>
              {user && (
                <div className="flex items-center gap-2 px-2 mb-4 pb-4 border-b border-border/40">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted shrink-0">
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{user.fullName ?? user.username}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{user.role}</p>
                  </div>
                </div>
              )}
              <nav className="flex flex-col gap-1.5">
                <NavLinks />
              </nav>
              <div className="mt-6 pt-4 border-t border-border/40">
                <Button variant="ghost" className="w-full justify-start gap-2 text-sm text-muted-foreground" onClick={logout}>
                  <LogOut className="h-4 w-4" /> Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center flex-1">
            <img src="/logo.png" alt="Light Finance" className="h-8 w-auto object-contain" />
          </div>
          <ThemeToggle />
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
