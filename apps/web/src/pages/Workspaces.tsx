import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/axios";
import type { Workspace } from "@/hooks/useWorkspace";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CreateWorkspaceDialog } from "@/components/workspaces/CreateWorkspaceDialog";
import { WorkspaceCard } from "@/components/workspaces/WorkspaceCard";
import { WorkspaceDetailSheet } from "@/components/workspaces/WorkspaceDetailSheet";
import { Button } from "@/components/ui/button";
import { Plus, Building } from "lucide-react";

interface WorkspaceWithMembers extends Workspace {
  members: Array<{
    id: string;
    role: string;
    joinedAt: string;
    user: {
      id: string;
      email: string;
      name: string | null;
      avatarUrl: string | null;
    };
  }>;
}

/**
 * Workspaces management page.
 * Lists all workspaces with create, view details, and delete functionality.
 */
export function Workspaces() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] =
    useState<WorkspaceWithMembers | null>(null);

  const isAdmin = user?.role === "Admin";

  const {
    data: workspaces = [],
    isLoading,
  } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const res = await api.get<{ workspaces: WorkspaceWithMembers[] }>(
        "/workspaces"
      );
      return res.data.workspaces;
    },
  });

  /** Delete a workspace */
  const deleteMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      await api.delete(`/workspaces/${workspaceId}`);
    },
    onSuccess: () => {
      toast.success("Workspace deleted successfully!");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to delete workspace";
      toast.error(message);
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Workspaces
            </h2>
            <p className="text-muted-foreground">
              Manage your workspaces and their members.
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Workspace
            </Button>
          )}
        </div>

        {/* Empty state */}
        {workspaces.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center">
            <Building className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              No workspaces yet
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin
                ? "Create your first workspace to start organizing projects."
                : "You don't have access to any workspaces."}
            </p>
            {isAdmin && (
              <Button
                onClick={() => setCreateOpen(true)}
                className="mt-4 gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Workspace
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                workspace={ws}
                onClick={() => setSelectedWorkspace(ws)}
                onDelete={() => {
                  if (
                    window.confirm(
                      `Delete workspace "${ws.name}"? This action cannot be undone.`
                    )
                  ) {
                    deleteMutation.mutate(ws.id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      {selectedWorkspace && (
        <WorkspaceDetailSheet
          workspace={selectedWorkspace}
          open={!!selectedWorkspace}
          onOpenChange={(open) => {
            if (!open) setSelectedWorkspace(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}
