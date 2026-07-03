import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Target,
  Settings,
  Shield,
  Menu,
  X,
  Building,
  FolderKanban,
} from "lucide-react";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  adminOnly?: boolean;
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  const navItems: NavItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Building, label: "Workspaces", href: "/workspaces" },
    { icon: FolderKanban, label: "Projects", href: "/projects" },
    { icon: CheckSquare, label: "Tasks", href: "/tasks" },
    { icon: Users, label: "Teams", href: "/teams" },
    { icon: Target, label: "Goals", href: "/goals" },
    { icon: Shield, label: "Users", href: "/admin/users", adminOnly: true },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  // Filter admin-only items
  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || user?.role === "Admin"
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-md border border-border bg-sidebar p-2 text-sidebar-foreground lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-sidebar transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Close button (mobile) */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-4 top-4 rounded-md p-1 text-sidebar-foreground hover:bg-sidebar-accent lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>

        <Link
          to="/"
          className="flex h-16 items-center border-b border-border px-6"
          onClick={() => setMobileOpen(false)}
        >
          <h1 className="text-xl font-bold text-sidebar-foreground">meldtask</h1>
        </Link>

        <nav className="flex-1 space-y-1 p-4">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.label}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <p className="text-xs text-muted-foreground">meldtask v0.1.0</p>
        </div>
      </aside>
    </>
  );
}
