import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";

export function Dashboard() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h2>
          <p className="text-muted-foreground">
            Here is an overview of your workspace.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-1">
          <div className="rounded-lg border border-border bg-card p-6 animate-fade-in">
            <h3 className="font-semibold text-card-foreground">Tasks</h3>
            <p className="mt-1 text-sm text-muted-foreground">No tasks yet</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6 animate-fade-in">
            <h3 className="font-semibold text-card-foreground">Teams</h3>
            <p className="mt-1 text-sm text-muted-foreground">No teams yet</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6 animate-fade-in">
            <h3 className="font-semibold text-card-foreground">Goals</h3>
            <p className="mt-1 text-sm text-muted-foreground">No goals yet</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
