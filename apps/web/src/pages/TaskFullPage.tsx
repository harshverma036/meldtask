import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Pencil,
  Check,
  Flag,
  Calendar,
  UserPlus,
  Layers,
  Trash2,
} from "lucide-react";
import { useTask, useUpdateTask, useDeleteTask } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import { Breadcrumb } from "@/components/tasks/Breadcrumb";
import { CommentSection } from "@/components/tasks/CommentSection";
import { AssetSection } from "@/components/tasks/AssetSection";
import { TaskCard } from "@/components/tasks/TaskCard";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaskPriority } from "@/lib/types/task";

/** Priority color mapping */
const priorityColors: Record<string, string> = {
  Urgent: "bg-red-500/10 text-red-400 border-red-500/30",
  High: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  Low: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

/**
 * Dedicated full-screen task page.
 * Rendered at /tasks/:projectId/:taskId.
 * Shows the same content as TaskDetailSheet but as a full page.
 */
export function TaskFullPage() {
  const { projectId, taskId } = useParams<{
    projectId: string;
    taskId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: task, isLoading } = useTask(projectId, taskId);
  const updateTask = useUpdateTask(projectId!, taskId!);
  const deleteTask = useDeleteTask(projectId!);

  // Statuses and members come from the project (simplified for full page)
  const projectStatuses: string[] = [];
  const memberOptions: { id: string; label: string }[] = [];

  // Inline editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");

  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDesc(task.description || "");
    }
  }, [task?.id]);

  const saveTitle = () => {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === task?.title) {
      setEditTitle(task?.title || "");
      setIsEditingTitle(false);
      return;
    }
    updateTask.mutate({ title: trimmed });
    setIsEditingTitle(false);
  };

  const saveDesc = () => {
    const trimmed = editDesc.trim();
    if (trimmed === (task?.description || "")) {
      setIsEditingDesc(false);
      return;
    }
    updateTask.mutate({ description: trimmed || null });
    setIsEditingDesc(false);
  };

  const updateField = (field: string, value: string | null) => {
    updateTask.mutate({ [field]: value } as any);
  };

  const handleDelete = () => {
    if (
      window.confirm(
        `Delete task "${task?.title}"? This action cannot be undone.`
      )
    ) {
      deleteTask.mutate(taskId!, {
        onSuccess: () => {
          navigate("/tasks", { replace: true });
        },
      });
    }
  };

  if (isLoading || !task) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  const breadcrumbSegments = [{ label: task.title }];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
        {/* ── Header: Back + Breadcrumb + Actions ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/tasks")}
              className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label="Back to tasks"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Breadcrumb segments={breadcrumbSegments} />
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteTask.isPending}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>

        {/* ── Title ── */}
        {isEditingTitle ? (
          <div className="flex items-center gap-2">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") {
                  setEditTitle(task.title);
                  setIsEditingTitle(false);
                }
              }}
              onBlur={saveTitle}
              className="text-2xl font-bold"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={saveTitle}
            >
              <Check className="h-5 w-5 text-green-400" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">
              {task.title}
            </h1>
            <button
              onClick={() => setIsEditingTitle(true)}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Description ── */}
        {isEditingDesc ? (
          <div>
            <Textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              onBlur={saveDesc}
              placeholder="Add a description..."
              rows={4}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Click outside to save, Esc to cancel
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <p className="flex-1 text-muted-foreground whitespace-pre-wrap">
              {task.description || "No description"}
            </p>
            <button
              onClick={() => setIsEditingDesc(true)}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Meta Fields ── */}
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card/50 p-4 sm:grid-cols-4">
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Flag className="h-3 w-3" /> Priority
            </label>
            <Select
              value={task.priority}
              onValueChange={(value) =>
                updateField("priority", value as TaskPriority)
              }
            >
              <SelectTrigger
                className={`h-9 border-0 bg-transparent text-sm ${priorityColors[task.priority]}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Layers className="h-3 w-3" /> Status
            </label>
            <Select
              value={task.status}
              onValueChange={(value) => updateField("status", value)}
            >
              <SelectTrigger className="h-9 border-0 bg-transparent text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projectStatuses.length > 0 ? (
                  projectStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value={task.status}>{task.status}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3 w-3" /> Due Date
            </label>
            <Input
              type="date"
              value={
                task.dueDate
                  ? format(new Date(task.dueDate), "yyyy-MM-dd")
                  : ""
              }
              onChange={(e) =>
                updateField(
                  "dueDate",
                  e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null
                )
              }
              className="h-9 border-0 bg-transparent text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <UserPlus className="h-3 w-3" /> Assignee
            </label>
            <Select
              value={task.assignedTo || "none"}
              onValueChange={(value) =>
                updateField("assignedTo", value === "none" ? null : value)
              }
            >
              <SelectTrigger className="h-9 border-0 bg-transparent text-sm">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {memberOptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Info bar ── */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {task.assignee && (
            <span className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarImage
                  src={task.assignee.avatarUrl || undefined}
                  alt={task.assignee.name || task.assignee.email}
                />
                <AvatarFallback className="text-[8px]">
                  {(task.assignee.name || task.assignee.email)
                    .charAt(0)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              assigned to{" "}
              <span className="font-medium text-foreground">
                {task.assignee.name || task.assignee.email}
              </span>
            </span>
          )}
          <span>
            created{" "}
            {formatDistanceToNow(new Date(task.createdAt), {
              addSuffix: true,
            })}
          </span>
          {task.assigner && (
            <span>
              by{" "}
              <span className="font-medium text-foreground">
                {task.assigner.name || task.assigner.email}
              </span>
            </span>
          )}
        </div>

        <Separator />

        {/* ── Subtasks ── */}
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Subtasks
            {task._count && task._count.children > 0 && (
              <span className="ml-2 text-sm text-muted-foreground">
                ({task._count.children})
              </span>
            )}
          </h3>
          {task.children && task.children.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {task.children.map((child) => (
                <TaskCard
                  key={child.id}
                  task={child}
                  onClick={() =>
                    navigate(`/tasks/${projectId}/${child.id}`)
                  }
                />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No subtasks yet.
            </p>
          )}
        </div>

        <Separator />

        {/* ── Comments ── */}
        <CommentSection projectId={projectId!} taskId={taskId!} />

        <Separator />

        {/* ── Assets ── */}
        <AssetSection projectId={projectId!} taskId={taskId!} />

        <div className="h-8" />
      </div>
    </DashboardLayout>
  );
}
