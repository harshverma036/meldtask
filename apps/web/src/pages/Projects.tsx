import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { useWorkspace } from "@/hooks/useWorkspace";
import api from "@/lib/axios";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectDetailSheet } from "@/components/projects/ProjectDetailSheet";
import { Button } from "@/components/ui/button";
import { Plus, FolderKanban } from "lucide-react";

interface ProjectMember {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  statuses: string[];
  workspaceId: string;
  createdBy: string;
  createdAt: string;
  members: ProjectMember[];
}

/**
 * Projects page scoped to the active workspace.
 * Shows all projects in the currently selected workspace.
 */
export function Projects() {
  const { activeWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const workspaceId = activeWorkspace?.id ?? "";

  const {
    data: projects = [],
    isLoading,
  } = useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await api.get<{ projects: Project[] }>(
        `/workspaces/${workspaceId}/projects`
      );
      return res.data.projects;
    },
    enabled: !!workspaceId,
  });

  // Keep selectedProject in sync when query data changes (e.g. after mutations refetch)
  useEffect(() => {
    if (selectedProject) {
      const updated = projects.find((p) => p.id === selectedProject.id);
      if (updated) {
        setSelectedProject(updated);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  /** Delete a project */
  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      await api.delete(
        `/workspaces/${workspaceId}/projects/${projectId}`
      );
    },
    onSuccess: () => {
      toast.success("Project deleted successfully!");
      queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to delete project";
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
              Projects
            </h2>
            <p className="text-muted-foreground">
              {activeWorkspace
                ? `Projects in ${activeWorkspace.name}`
                : "Select a workspace to view projects."}
            </p>
          </div>
          {workspaceId && (
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          )}
        </div>

        {/* Empty state */}
        {projects.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center">
            <FolderKanban className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              No projects yet
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first project in this workspace.
            </p>
            {workspaceId && (
              <Button
                onClick={() => setCreateOpen(true)}
                className="mt-4 gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Project
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => setSelectedProject(project)}
                onDelete={() => {
                  if (
                    window.confirm(
                      `Delete project "${project.name}"? This action cannot be undone.`
                    )
                  ) {
                    deleteMutation.mutate(project.id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {workspaceId && (
        <CreateProjectDialog
          workspaceId={workspaceId}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}

      {selectedProject && (
        <ProjectDetailSheet
          project={selectedProject}
          open={!!selectedProject}
          onOpenChange={(open) => {
            if (!open) setSelectedProject(null);
          }}
          onUpdate={(updated) => setSelectedProject(updated)}
        />
      )}
    </DashboardLayout>
  );
}
