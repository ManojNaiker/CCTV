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
  Pencil,
  ChevronLeft,
  ChevronRight,
  Wifi,
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
import { ProfileDialog } from "@/components/profile-dialog";

function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme();
  const icon =
    theme === "dark" ? <Moon className="h-4 w-4" /> :
    theme === "light" ? <Sun className="h-4 w-4" /> :
    <Monitor className="h-4 w-4" />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          title="Toggle theme"
        >
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

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/devices", label: "Devices", icon: ShieldCheck },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/offline-report", label: "Offline Report", icon: WifiOff },
      { href: "/status-report", label: "Status Report", icon: CalendarDays },
      { href: "/dvr-storage", label: "DVR Storage", icon: HardDrive },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/cc-list", label: "Branch CC List", icon: AtSign },
      { href: "/users", label: "Users", icon: Users },
      { href: "/audit-logs", label: "Audit Logs", icon: Activity },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { state, logout } = useAuth();

  const user = state.status === "authenticated" ? state.user : null;

  const avatarInitials = user?.fullName
    ? user.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.username?.slice(0, 2).toUpperCase() ?? "??";

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-2">
          {!collapsed && (
            <p className="text-[9px] font-bold text-sidebar-foreground/30 uppercase tracking-[0.15em] px-3 mb-1.5">
              {group.label}
            </p>
          )}
          {collapsed && <div className="my-1 mx-3 h-px bg-sidebar-border/30" />}
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} onClick={onNavigate}>
                <span
                  title={collapsed ? item.label : undefined}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer text-sm font-medium mb-0.5 group ${
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/20"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  } ${collapsed ? "justify-center px-2" : ""}`}
                >
                  {isActive && !collapsed && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-white/50" />
                  )}
                  <Icon
                    className={`shrink-0 transition-all ${
                      collapsed ? "h-5 w-5" : "h-4 w-4"
                    } ${isActive ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {isActive && !collapsed && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/70 shrink-0" />
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );

  const LogoBlock = () => (
    <div className={`flex items-center mb-5 ${collapsed ? "justify-center px-1" : "px-2 gap-2"}`}>
      {collapsed ? (
        <div className="h-8 w-8 rounded-xl bg-blue-600/20 flex items-center justify-center border border-blue-500/20">
          <Wifi className="h-4 w-4 text-blue-400" />
        </div>
      ) : (
        <>
          <img
            src="/logo.png"
            alt="Light Finance"
            className="h-10 w-auto object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </>
      )}
    </div>
  );

  const StatusBadge = () => (
    collapsed ? null : (
      <div className="mx-3 mb-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            System Live
          </span>
        </div>
        <p className="text-[10px] text-emerald-700/60 dark:text-emerald-400/50 mt-0.5 ml-4">
          All India monitoring active
        </p>
      </div>
    )
  );

  const UserBlock = () => (
    <button
      onClick={() => setProfileOpen(true)}
      title={collapsed ? (user?.fullName ?? user?.username) : "Edit Profile"}
      className={`group w-full flex items-center mb-4 rounded-xl bg-sidebar-accent/60 border border-sidebar-border/30 hover:bg-sidebar-accent hover:border-sidebar-border/60 transition-all text-left ${
        collapsed ? "justify-center p-2" : "gap-3 px-3 py-2.5"
      }`}
    >
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 border border-blue-400/30 shrink-0 text-[11px] font-bold text-white shadow-sm">
        {avatarInitials}
      </div>
      {!collapsed && (
        <>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">
              {user?.fullName ?? user?.username}
            </p>
            <p className="text-[10px] text-sidebar-foreground/40 capitalize tracking-wide">
              {user?.role}
            </p>
          </div>
          <Pencil className="h-3 w-3 text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60 shrink-0 transition-colors" />
        </>
      )}
    </button>
  );

  return (
    <div className="flex h-screen w-full flex-col bg-background md:flex-row overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-sidebar-border py-5 bg-sidebar h-screen sticky top-0 shrink-0 transition-all duration-300 relative ${
          collapsed ? "w-[68px] px-2" : "w-64 px-4"
        }`}
      >
        {/* Collapse toggle button */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-16 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-sidebar border border-sidebar-border shadow-md hover:bg-sidebar-accent transition-colors"
        >
          {collapsed
            ? <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/60" />
            : <ChevronLeft className="h-3.5 w-3.5 text-sidebar-foreground/60" />
          }
        </button>

        <LogoBlock />
        {user && <UserBlock />}
        <StatusBadge />

        {!collapsed && (
          <p className="text-[9px] font-bold text-sidebar-foreground/25 uppercase tracking-[0.15em] px-3 mb-2">
            Navigation
          </p>
        )}

        <nav className={`flex flex-1 flex-col overflow-y-auto overflow-x-hidden ${collapsed ? "gap-0" : "gap-0"}`}>
          <NavLinks />
        </nav>

        <div
          className={`mt-auto pt-4 border-t border-sidebar-border/40 shrink-0 flex items-center gap-2 ${
            collapsed ? "flex-col" : ""
          }`}
        >
          <Button
            variant="ghost"
            className={`text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent text-sm h-9 font-medium transition-all ${
              collapsed ? "w-full justify-center px-0" : "flex-1 justify-start gap-3"
            }`}
            onClick={logout}
            title="Sign Out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && "Sign Out"}
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
            <SheetContent side="left" className="w-64 sm:max-w-none p-0">
              <div className="flex flex-col h-full bg-sidebar px-4 py-6">
                <div className="px-2 mb-4">
                  <img src="/logo.png" alt="Light Finance" className="h-10 w-auto object-contain" />
                </div>

                {/* Mobile status badge */}
                <div className="mx-1 mb-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">System Live</span>
                  </div>
                  <p className="text-[10px] text-emerald-700/60 dark:text-emerald-400/50 mt-0.5 ml-4">All India monitoring active</p>
                </div>

                {user && (
                  <button
                    onClick={() => { setMobileMenuOpen(false); setProfileOpen(true); }}
                    className="group w-full flex items-center gap-2 px-2 mb-4 pb-4 border-b border-sidebar-border/40 hover:bg-sidebar-accent/50 rounded-lg p-2 transition-colors text-left"
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 border border-blue-400/30 shrink-0 text-[11px] font-bold text-white shadow-sm">
                      {avatarInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-sidebar-foreground truncate">{user.fullName ?? user.username}</p>
                      <p className="text-[10px] text-sidebar-foreground/40 capitalize">{user.role}</p>
                    </div>
                    <Pencil className="h-3 w-3 text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60 shrink-0 transition-colors" />
                  </button>
                )}

                <nav className="flex flex-col flex-1 overflow-y-auto">
                  <NavLinks onNavigate={() => setMobileMenuOpen(false)} />
                </nav>

                <div className="mt-4 pt-4 border-t border-sidebar-border/40 flex items-center justify-between">
                  <Button variant="ghost" className="justify-start gap-2 text-sm text-sidebar-foreground/55 hover:text-sidebar-foreground h-9" onClick={logout}>
                    <LogOut className="h-4 w-4" /> Sign Out
                  </Button>
                  <ThemeToggle />
                </div>
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

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
