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

function ThemeToggle() {
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
          className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10"
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
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/devices", label: "Devices", icon: ShieldCheck },
    ],
  },
  {
    items: [
      { href: "/offline-report", label: "Offline Report", icon: WifiOff },
      { href: "/status-report", label: "Status Report", icon: CalendarDays },
      { href: "/dvr-storage", label: "DVR Storage", icon: HardDrive },
    ],
  },
  {
    items: [
      { href: "/cc-list", label: "Branch CC List", icon: AtSign },
      { href: "/users", label: "Users", icon: Users },
      { href: "/audit-logs", label: "Audit Logs", icon: Activity },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const SIDEBAR_STYLE: React.CSSProperties = {
  background: "linear-gradient(175deg, #0a0f2e 0%, #0d1b4b 30%, #0a2a6e 60%, #071f52 100%)",
};

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
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi} className="mb-1">
          {gi > 0 && <div className="my-2 mx-2 h-px bg-white/10" />}
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} onClick={onNavigate}>
                <span
                  title={collapsed ? item.label : undefined}
                  className={`relative flex items-center gap-3 py-2.5 rounded-xl transition-all cursor-pointer text-sm font-medium mb-0.5 group
                    ${collapsed ? "justify-center px-2" : "px-3"}
                    ${isActive
                      ? "bg-white/20 text-white shadow-inner shadow-white/5"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                    }`}
                >
                  {isActive && !collapsed && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-white/80" />
                  )}
                  <Icon
                    className={`shrink-0 transition-all
                      ${collapsed ? "h-5 w-5" : "h-4 w-4"}
                      ${isActive ? "text-white" : "text-white/50 group-hover:text-white/90"}`}
                  />
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                  {isActive && !collapsed && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/60 shrink-0" />
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );

  const SidebarDecorations = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Large blurred circles for depth */}
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-blue-400/10 blur-2xl" />
      <div className="absolute top-1/3 -left-8 w-32 h-32 rounded-full bg-indigo-400/15 blur-xl" />
      <div className="absolute bottom-1/4 -right-6 w-28 h-28 rounded-full bg-blue-300/10 blur-xl" />
      <div className="absolute -bottom-10 left-4 w-36 h-36 rounded-full bg-violet-500/10 blur-2xl" />
      {/* Small dot pattern */}
      <div className="absolute top-0 right-0 w-full h-full opacity-5"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
    </div>
  );

  const LogoBlock = () => (
    <div className={`relative z-10 flex items-center mb-6 ${collapsed ? "justify-center px-1" : "px-2 gap-2"}`}>
      {collapsed ? (
        <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shadow-inner">
          <Wifi className="h-4.5 w-4.5 text-white" />
        </div>
      ) : (
        <img
          src="/logo.png"
          alt="Light Finance"
          className="h-11 w-auto object-contain brightness-0 invert"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
    </div>
  );

  const UserBlock = () => (
    <button
      onClick={() => setProfileOpen(true)}
      title={collapsed ? (user?.fullName ?? user?.username) : "Edit Profile"}
      className={`relative z-10 group w-full flex items-center mb-5 rounded-2xl border border-white/15 bg-white/10 hover:bg-white/20 transition-all text-left shadow-sm
        ${collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-3"}`}
    >
      <div className="flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-sky-300 to-blue-500 border-2 border-white/30 shrink-0 text-[12px] font-bold text-white shadow-md">
        {avatarInitials}
      </div>
      {!collapsed && (
        <>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white truncate">
              {user?.fullName ?? user?.username}
            </p>
            <p className="text-[10px] text-white/50 capitalize tracking-wide mt-0.5">
              {user?.role}
            </p>
          </div>
          <Pencil className="h-3 w-3 text-white/30 group-hover:text-white/70 shrink-0 transition-colors" />
        </>
      )}
    </button>
  );

  return (
    <div className="flex h-screen w-full flex-col bg-background md:flex-row overflow-hidden">

      {/* ── Desktop Sidebar ── */}
      <aside
        style={SIDEBAR_STYLE}
        className={`hidden md:flex flex-col py-5 h-screen sticky top-0 shrink-0 transition-all duration-300 relative overflow-hidden
          ${collapsed ? "w-[68px] px-2" : "w-64 px-4"}`}
      >
        <SidebarDecorations />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-16 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-gray-200 shadow-md hover:bg-gray-50 transition-colors"
        >
          {collapsed
            ? <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
            : <ChevronLeft className="h-3.5 w-3.5 text-gray-500" />}
        </button>

        <LogoBlock />
        {user && <UserBlock />}

        <nav className="relative z-10 flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
          <NavLinks />
        </nav>

        <div
          className={`relative z-10 mt-auto pt-4 border-t border-white/10 shrink-0 flex items-center gap-2
            ${collapsed ? "flex-col" : ""}`}
        >
          <Button
            variant="ghost"
            onClick={logout}
            title="Sign Out"
            className={`text-white/55 hover:text-white hover:bg-white/10 text-sm h-9 font-medium transition-all
              ${collapsed ? "w-full justify-center px-0" : "flex-1 justify-start gap-3"}`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && "Sign Out"}
          </Button>
          <ThemeToggle />
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-y-auto">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 md:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="sm:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 sm:max-w-none p-0 border-0">
              <div className="flex flex-col h-full relative overflow-hidden" style={SIDEBAR_STYLE}>
                <SidebarDecorations />
                <div className="relative z-10 flex flex-col h-full px-4 py-6">
                  <div className="px-2 mb-5">
                    <img src="/logo.png" alt="Light Finance" className="h-11 w-auto object-contain brightness-0 invert" />
                  </div>

                  {user && (
                    <button
                      onClick={() => { setMobileMenuOpen(false); setProfileOpen(true); }}
                      className="group w-full flex items-center gap-3 px-3 py-3 mb-4 rounded-2xl border border-white/15 bg-white/10 hover:bg-white/20 transition-all text-left"
                    >
                      <div className="flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-sky-300 to-blue-500 border-2 border-white/30 shrink-0 text-[12px] font-bold text-white shadow-md">
                        {avatarInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-white truncate">{user.fullName ?? user.username}</p>
                        <p className="text-[10px] text-white/50 capitalize mt-0.5">{user.role}</p>
                      </div>
                      <Pencil className="h-3 w-3 text-white/30 group-hover:text-white/70 shrink-0 transition-colors" />
                    </button>
                  )}

                  <nav className="flex flex-col flex-1 overflow-y-auto">
                    <NavLinks onNavigate={() => setMobileMenuOpen(false)} />
                  </nav>

                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                    <Button variant="ghost" className="justify-start gap-2 text-sm text-white/55 hover:text-white hover:bg-white/10 h-9" onClick={logout}>
                      <LogOut className="h-4 w-4" /> Sign Out
                    </Button>
                    <ThemeToggle />
                  </div>
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
