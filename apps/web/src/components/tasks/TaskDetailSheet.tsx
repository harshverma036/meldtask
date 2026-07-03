import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import {
  X,
  Maximize2,
  Pencil,
  Check,
  Calendar,
  Flag,
  UserPlus,
  Trash2,
  Layers,
  MessageSquare,
  Paperclip,
  Plus,
} from "lucide-react";
import { useTask, useUpdateTask, useDeleteTask } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import { Breadcrumb } from "@/components/tasks/Breadcrumb";
import { CommentSection } from "@/components/tasks/CommentSection";
import { AssetSection } from "@/components/tasks/AssetSection";
import { TaskCard } from "@/components/tasks/TaskCard";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Task, TaskPriority } from "@/lib/types/task";

/** Priority color mapping */
const priorityColors: Record<string, string> = {
  Urgent: "bg-red-500/10 text-red-400 border-red-500/30",
  High: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  Low: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

interface TaskDetailSheetProps {
  projectId: string;
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectStatuses: string[];
  memberOptions: { id: string; label: string }[];
  onEditTask?: (taskId: string) => void;
}

/**
 * Big slide-over sheet showing full task details.
 * - Breadcrumb at top
 * - Close (X) and Full-screen (expand) buttons top-right
 * - Inline editable title, description, priority, status, due date, assignee
 * - Subtasks list with add button
 * - Comments section
 * - Assets section
 * - Delete button
 */
export function TaskDetailSheet({
  projectId,
  taskId,
  open,
  onOpenChange,
  projectStatuses,
  memberOptions,
  onEditTask,
}: TaskDetailSheetProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: task, isLoading } = useTask(projectId, taskId);
  const updateTask = useUpdateTask(projectId, taskId);
  const deleteTask = useDeleteTask(projectId);

  // Inline editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when task loads
  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDesc(task.description || "");
      setIsEditingTitle(false);
      setIsEditingDesc(false);
    }
  }, [task?.id, task?.title, task?.description]);

  // Focus title input
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  /** Navigate to full page view */
  const handleFullScreen = () => {
    navigate(`/tasks/${projectId}/${taskId}`);
    onOpenChange(false);
  };

  /** Save title inline */
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

  /** Save description inline */
  const saveDesc = () => {
    const trimmed = editDesc.trim();
    if (trimmed === (task?.description || "")) {
      setIsEditingDesc(false);
      return;
    }
    updateTask.mutate({ description: trimmed || null });
    setIsEditingDesc(false);
  };

  /** Quick field update */
  const updateField = (
    field: string,
    value: string | null
  ) => {
    updateTask.mutate({ [field]: value } as any);
  };

  /** Delete task */
  const handleDelete = () => {
    if (window.confirm(`Delete task "${task?.title}"? This action cannot be undone.`)) {
      deleteTask.mutate(taskId, {
        onSuccess: () => {
          onOpenChange(false);
        },
      });
    }
  };

  if (isLoading || !task) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const breadcrumbSegments = [{ label: task.title }];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        {/* ── Header: Breadcrumb + Actions ── */}
        <div className="flex items-center justify-between">
          <Breadcrumb segments={breadcrumbSegments} />
          <div className="flex items-center gap-1">
            <button
              onClick={handleFullScreen}
              className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label="Open full screen"
              title="Full screen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-2 flex-1 space-y-5">
          {/* ── Title (inline editable) ── */}
          <SheetHeader className="text-left">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  ref={titleInputRef}
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
                  className="text-lg font-semibold"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={saveTitle}
                >
                  <Check className="h-4 w-4 text-green-400" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <SheetTitle className="flex-1">{task.title}</SheetTitle>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  aria-label="Edit title"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </SheetHeader>

          {/* ── Description (inline editable) ── */}
          {isEditingDesc ? (
            <div>
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey) {
                    saveDesc();
                  }
                  if (e.key === "Escape") {
                    setEditDesc(task.description || "");
                    setIsEditingDesc(false);
                  }
                }}
                onBlur={saveDesc}
                placeholder="Add a description..."
                rows={3}
                className="text-sm"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Cmd+Enter to save, Esc to cancel
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <p className="flex-1 text-sm text-muted-foreground whitespace-pre-wrap">
                {task.description || "No description"}
              </p>
              <button
                onClick={() => setIsEditingDesc(true)}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                aria-label="Edit description"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* ── Meta Fields ── */}
          <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-card/50 p-3">
            {/* Priority */}
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <Flag className="h-3 w-3" /> Priority
              </label>
              <Select
                value={task.priority}
                onValueChange={(value) =>
                  updateField("priority", value as TaskPriority)
                }
              >
                <SelectTrigger
                  className={`h-8 border-0 bg-transparent p-0 text-xs ${priorityColors[task.priority]}`}
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

            {/* Status */}
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <Layers className="h-3 w-3" /> Status
              </label>
              <Select
                value={task.status}
                onValueChange={(value) => updateField("status", value)}
              >
                <SelectTrigger className="h-8 border-0 bg-transparent p-0 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projectStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due date */}
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
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
                className="h-8 border-0 bg-transparent p-0 text-xs"
              />
            </div>

            {/* Assigned to */}
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <UserPlus className="h-3 w-3" /> Assigned To
              </label>
              <Select
                value={task.assignedTo || "none"}
                onValueChange={(value) =>
                  updateField("assignedTo", value === "none" ? null : value)
                }
              >
                <SelectTrigger className="h-8 border-0 bg-transparent p-0 text-xs">
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

          {/* Assigned by + created info */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
          </div>

          <Separator />

          {/* ── Subtasks ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">
                Subtasks
                {task._count && task._count.children > 0 && (
                  <span className="ml-1 text-muted-foreground">
                    ({task._count.children})
                  </span>
                )}
              </h4>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => onEditTask?.(task.id)}
              >
                <Plus className="h-3 w-3" />
                Add Subtask
              </Button>
            </div>

            {task.children && task.children.length > 0 ? (
              <div className="space-y-1">
                {task.children.map((child) => (
                  <TaskCard
                    key={child.id}
                    task={child}
                    onClick={() => {
                      // Navigate to child task — reload the sheet with new task
                      navigate(`/tasks/${projectId}/${child.id}`);
                      onOpenChange(false);
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No subtasks yet.
              </p>
            )}
          </div>

          <Separator />

          {/* ── Comments ── */}
          <CommentSection projectId={projectId} taskId={taskId} />

          <Separator />

          {/* ── Assets ── */}
          <AssetSection projectId={projectId} taskId={taskId} />

          <Separator />

          {/* ── Delete ── */}
          <div className="flex justify-end pb-4">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteTask.isPending}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {deleteTask.isPending ? "Deleting..." : "Delete Task"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
