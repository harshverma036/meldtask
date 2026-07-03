import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { ReactNode } from "react";

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Topbar />
      <main className="pl-0 pt-16 lg:pl-72">
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
