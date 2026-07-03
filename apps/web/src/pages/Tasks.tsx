import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";
import api from "@/lib/axios";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TaskListView } from "@/components/tasks/TaskListView";
import { TaskBoardView } from "@/components/tasks/TaskBoardView";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, List, LayoutGrid } from "lucide-react";
import type { Task, TaskViewMode, TaskGroupBy, TaskPriority } from "@/lib/types/task";

interface Project {
  id: string;
  name: string;
  description: string | null;
  statuses: string[];
  workspaceId: string;
  members: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      email: string;
      name: string | null;
      avatarUrl: string | null;
    };
  }>;
}

/**
 * Tasks page — the main entry point for task management.
 * Supports List and Board views with filters, grouped display,
 * task creation, and a detail slide-over sheet.
 * User selects a project from a dropdown at the top.
 */
export function Tasks() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  // ── State ──────────────────────────────────────────────────────────────
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [viewMode, setViewMode] = useState<TaskViewMode>("board");
  const [groupBy, setGroupBy] = useState<TaskGroupBy>("status");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<string | undefined>();
  const [subtaskParent, setSubtaskParent] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    search: string;
    priority?: TaskPriority;
    status?: string;
    assignedTo?: string;
  }>({ search: "" });

  // ── Fetch projects in workspace ────────────────────────────────────────
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
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

  // Auto-select first project
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0]!.id);
    }
  }, [projects, selectedProjectId]);

  // Reset selected project if it no longer exists
  useEffect(() => {
    if (
      selectedProjectId &&
      projects.length > 0 &&
      !projects.find((p) => p.id === selectedProjectId)
    ) {
      setSelectedProjectId(projects[0]?.id || "");
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const projectStatuses = selectedProject?.statuses ?? [];
  const memberOptions = (selectedProject?.members ?? []).map((m) => ({
    id: m.user.id,
    label: m.user.name || m.user.email,
  }));

  // ── Filter object for API queries ──────────────────────────────────────
  const apiFilters: Record<string, string | undefined> = {};
  if (filters.search) apiFilters.search = filters.search;
  if (filters.priority) apiFilters.priority = filters.priority;
  if (filters.status) apiFilters.status = filters.status;
  if (filters.assignedTo) apiFilters.assignedTo = filters.assignedTo;

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleCreateTask = (status?: string) => {
    setCreateStatus(status);
    setSubtaskParent(null);
    setCreateOpen(true);
  };

  const handleCreateSubtask = (parentId: string, parentTitle: string) => {
    setSubtaskParent({ id: parentId, title: parentTitle });
    setCreateStatus(undefined);
    setCreateOpen(true);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTaskId(task.id);
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (projectsLoading) {
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
      <div className="space-y-4">
        {/* ── Header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Tasks
            </h2>
            <p className="text-muted-foreground">
              {selectedProject
                ? `Managing tasks in ${selectedProject.name}`
                : "Select a project to manage tasks"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Project selector */}
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedProjectId && (
              <Button
                onClick={() => handleCreateTask()}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Task
              </Button>
            )}
          </div>
        </div>

        {/* ── No project state ── */}
        {!selectedProjectId && projects.length === 0 && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No projects available. Create a project first to manage tasks.
            </p>
          </div>
        )}

        {/* ── Task Content ── */}
        {selectedProjectId && (
          <>
            {/* View toggle + Filters row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* View toggle: Board / List */}
              <div className="flex items-center gap-3">
                <Tabs
                  value={viewMode}
                  onValueChange={(v) => setViewMode(v as TaskViewMode)}
                >
                  <TabsList>
                    <TabsTrigger value="board" className="gap-1.5">
                      <LayoutGrid className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Board</span>
                    </TabsTrigger>
                    <TabsTrigger value="list" className="gap-1.5">
                      <List className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">List</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Group by selector (only for list view) */}
                {viewMode === "list" && (
                  <Select
                    value={groupBy}
                    onValueChange={(v) => setGroupBy(v as TaskGroupBy)}
                  >
                    <SelectTrigger className="h-9 w-[140px] text-xs">
                      <SelectValue placeholder="Group by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="status">Group: Status</SelectItem>
                      <SelectItem value="priority">
                        Group: Priority
                      </SelectItem>
                      <SelectItem value="assignedTo">
                        Group: Assignee
                      </SelectItem>
                      <SelectItem value="createdAt">
                        Group: Created
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Filters */}
            <TaskFilters
              filters={filters}
              onFiltersChange={setFilters}
              statuses={projectStatuses}
              memberOptions={memberOptions}
            />

            {/* View content */}
            {viewMode === "board" ? (
              <TaskBoardView
                projectId={selectedProjectId}
                statuses={projectStatuses}
                filters={apiFilters}
                onTaskClick={handleTaskClick}
                onCreateTask={handleCreateTask}
              />
            ) : (
              <TaskListView
                projectId={selectedProjectId}
                groupBy={groupBy}
                filters={apiFilters}
                onTaskClick={handleTaskClick}
                onCreateTask={() => handleCreateTask()}
                onCreateSubtask={handleCreateSubtask}
              />
            )}
          </>
        )}

        {/* ── Dialogs ── */}
        {selectedProjectId && (
          <CreateTaskDialog
            projectId={selectedProjectId}
            open={createOpen}
            onOpenChange={setCreateOpen}
            parentTaskId={subtaskParent?.id}
            parentTaskTitle={subtaskParent?.title}
            projectStatuses={projectStatuses}
            memberOptions={memberOptions}
          />
        )}

        {selectedProjectId && selectedTaskId && (
          <TaskDetailSheet
            projectId={selectedProjectId}
            taskId={selectedTaskId}
            open={!!selectedTaskId}
            onOpenChange={(open) => {
              if (!open) setSelectedTaskId(null);
            }}
            projectStatuses={projectStatuses}
            memberOptions={memberOptions}
            onEditTask={(taskId) => {
              // Close sheet, open create subtask dialog
              setSelectedTaskId(null);
              setSubtaskParent({ id: taskId, title: "" });
              setCreateOpen(true);
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
