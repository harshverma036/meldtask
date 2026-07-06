import { format, isPast, isToday } from "date-fns";
import { Calendar, MessageSquare, Paperclip, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { Task } from "@/lib/types/task";

/** Priority color mapping */
const priorityColors: Record<string, string> = {
  Urgent: "bg-red-500/10 text-red-400 border-red-500/30",
  High: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  Low: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

/**
 * Compact task card showing title, priority, status, due date,
 * assignee avatar, and counts for subtasks/comments/assets.
 */
export function TaskCard({ task, onClick }: TaskCardProps) {
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate);

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-lg border border-border bg-card p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
    >
      {/* Top row: title + priority */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-foreground line-clamp-2">
          {task.title}
        </h4>
        <Badge
          className={`shrink-0 border text-[10px] ${priorityColors[task.priority] || priorityColors.Medium}`}
        >
          {task.priority}
        </Badge>
      </div>

      {/* Bottom row: metadata and counts */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {/* Status */}
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">
            {task.status}
          </span>

          {/* Due date */}
          {dueDate && (
            <span
              className={`flex items-center gap-1 ${isOverdue ? "text-red-400" : ""}`}
            >
              <Calendar className="h-3 w-3" />
              {isToday(dueDate)
                ? "Today"
                : format(dueDate, "MMM d")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Counts */}
          {task._count && (
            <>
              {task._count.children > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Layers className="h-3 w-3" />
                  {task._count.children}
                </span>
              )}
              {task._count.comments > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  {task._count.comments}
                </span>
              )}
              {task._count.assets > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Paperclip className="h-3 w-3" />
                  {task._count.assets}
                </span>
              )}
            </>
          )}

          {/* Assignee avatar */}
          {task.assignee && (
            <Avatar className="h-5 w-5">
              <AvatarImage
                src={task.assignee.avatarUrl || undefined}
                alt={task.assignee.name || task.assignee.email}
              />
              <AvatarFallback className="text-[8px]">
                {(task.assignee.name || task.assignee.email).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  );
}
