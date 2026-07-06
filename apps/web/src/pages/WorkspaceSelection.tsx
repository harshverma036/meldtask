import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace, type Workspace } from "@/hooks/useWorkspace";
import { CreateWorkspaceDialog } from "@/components/workspaces/CreateWorkspaceDialog";
import { WorkspaceCard } from "@/components/workspaces/WorkspaceCard";
import { Building, LogOut, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/axios";

/**
 * Workspace selection screen shown after login when no workspace is active.
 *
 * - Admin users: sees workspace list + "Create Workspace" button + empty state with create prompt
 * - Manager/Developer users: sees workspace list or "no workspaces" message
 */
export function WorkspaceSelection() {
  const { user, logout } = useAuth();
  const { setActiveWorkspace, refreshWorkspaces } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);

  const {
    data: workspaces = [],
    isLoading,
  } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const res = await api.get<{ workspaces: Workspace[] }>("/workspaces");
      return res.data.workspaces;
    },
  });

  const isAdmin = user?.role === "Admin";

  /**
   * Handle workspace selection — set it directly as active.
   * Uses setActiveWorkspace (passes the full object) instead of switchWorkspace
   * (which looks up by ID in the context's internal array, which may be stale).
   */
  const handleSelect = (workspace: Workspace) => {
    setActiveWorkspace(workspace);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-xl font-bold text-foreground">meldtask</h1>
        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </header>

      {/* Main content */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-6 animate-fade-in">
          <div className="text-center">
            <Building className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
              {workspaces.length > 0
                ? "Select a Workspace"
                : "Welcome to meldtask"}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {workspaces.length > 0
                ? "Choose a workspace to continue."
                : isAdmin
                  ? "Create your first workspace to get started."
                  : "You don't have access to any workspaces yet. Contact your admin to get invited."}
            </p>
          </div>

          {/* Workspace list */}
          {workspaces.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {workspaces.map((ws) => (
                <WorkspaceCard
                  key={ws.id}
                  workspace={ws}
                  onClick={() => handleSelect(ws)}
                />
              ))}
            </div>
          )}

          {/* Admin: Create workspace button */}
          {isAdmin && (
            <div className="text-center">
              <Button
                onClick={() => setCreateOpen(true)}
                variant={workspaces.length === 0 ? "default" : "outline"}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {workspaces.length === 0
                  ? "Create Your First Workspace"
                  : "Create Workspace"}
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Create workspace dialog */}
      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          refreshWorkspaces();
        }}
      />
    </div>
  );
}
