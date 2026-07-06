import { useState } from "react";
import { format, isThisWeek, isThisMonth, isToday, isYesterday } from "date-fns";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Button } from "@/components/ui/button";
import type { Task, TaskGroupBy } from "@/lib/types/task";

interface TaskListViewProps {
  projectId: string;
  groupBy: TaskGroupBy;
  filters: Record<string, string | undefined>;
  onTaskClick: (task: Task) => void;
  onCreateTask: () => void;
  onCreateSubtask: (parentId: string, parentTitle: string) => void;
}

/** Group tasks by the selected field */
function groupTasks(tasks: Task[], groupBy: TaskGroupBy): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();

  for (const task of tasks) {
    let key: string;

    switch (groupBy) {
      case "status":
        key = task.status || "No Status";
        break;
      case "priority":
        key = task.priority || "Medium";
        break;
      case "assignedTo":
        key = task.assignee?.name || task.assignee?.email || "Unassigned";
        break;
      case "createdAt": {
        const date = new Date(task.createdAt);
        if (isToday(date)) key = "Today";
        else if (isYesterday(date)) key = "Yesterday";
        else if (isThisWeek(date)) key = "This Week";
        else if (isThisMonth(date)) key = "This Month";
        else key = format(date, "MMMM yyyy");
        break;
      }
      default:
        key = "All";
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(task);
  }

  return groups;
}

/**
 * List view of tasks grouped by the selected field.
 * Each group is a collapsible section with task cards.
 */
export function TaskListView({
  projectId,
  groupBy,
  filters,
  onTaskClick,
  onCreateTask,
  onCreateSubtask,
}: TaskListViewProps) {
  const { data: tasks = [], isLoading } = useTasks(projectId, filters);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No tasks found. Create your first task to get started.
        </p>
        <Button onClick={onCreateTask} className="mt-3 gap-2">
          <Plus className="h-4 w-4" />
          Create Task
        </Button>
      </div>
    );
  }

  const grouped = groupTasks(tasks, groupBy);

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([key, groupTasks]) => {
        const isCollapsed = collapsedGroups.has(key);
        return (
          <div key={key}>
            {/* Group header */}
            <button
              onClick={() => toggleGroup(key)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-all duration-200 hover:bg-secondary/50"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
              )}
              <span className="text-sm font-semibold text-foreground">
                {key}
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {groupTasks.length}
              </span>
            </button>

            {/* Group tasks */}
            {!isCollapsed && (
              <div className="mt-1 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                {groupTasks.map((task) => (
                  <div key={task.id} className="relative group/task">
                    <TaskCard task={task} onClick={() => onTaskClick(task)} />
                    {/* Add subtask button on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateSubtask(task.id, task.title);
                      }}
                      className="absolute right-2 top-2 hidden rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground group-hover/task:block transition-colors"
                      aria-label="Add subtask"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
