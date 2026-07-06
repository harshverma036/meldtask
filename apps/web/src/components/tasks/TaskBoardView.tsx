import { useState, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
import { useTasks, useReorderTask } from "@/hooks/useTasks";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Button } from "@/components/ui/button";
import type { Task } from "@/lib/types/task";

interface TaskBoardViewProps {
  projectId: string;
  statuses: string[];
  filters: Record<string, string | undefined>;
  onTaskClick: (task: Task) => void;
  onCreateTask: (status?: string) => void;
}

/**
 * Kanban board view with drag-and-drop between status columns.
 * Uses @hello-pangea/dnd for smooth drag-and-drop.
 */
export function TaskBoardView({
  projectId,
  statuses,
  filters,
  onTaskClick,
  onCreateTask,
}: TaskBoardViewProps) {
  const { data: tasks = [], isLoading } = useTasks(projectId, filters);
  const reorderTask = useReorderTask(projectId);

  // Organize tasks by status column
  const columns = statuses.map((status) => ({
    id: status,
    title: status,
    tasks: tasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.position - b.position),
  }));

  /** Handle drag end — update position and possibly status */
  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination, draggableId } = result;

      // Dropped outside a droppable
      if (!destination) return;

      // Dropped in the same position
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      ) {
        return;
      }

      const sourceColumn = columns.find((c) => c.id === source.droppableId);
      const destColumn = columns.find((c) => c.id === destination.droppableId);

      if (!sourceColumn || !destColumn) return;

      // Calculate new position
      const destTasks = destColumn.tasks;
      let newPosition: number;

      if (destTasks.length === 0) {
        newPosition = 1000;
      } else if (destination.index === 0) {
        newPosition = Math.floor(destTasks[0]!.position / 2);
      } else if (destination.index >= destTasks.length) {
        newPosition = destTasks[destTasks.length - 1]!.position + 1000;
      } else {
        const prev = destTasks[destination.index - 1]!.position;
        const next = destTasks[destination.index]!.position;
        newPosition = Math.floor((prev + next) / 2);
      }

      const payload: { taskId: string; payload: { position: number; status?: string } } = {
        taskId: draggableId,
        payload: {
          position: newPosition,
        },
      };

      // If status changed, include the new status
      if (source.droppableId !== destination.droppableId) {
        payload.payload.status = destination.droppableId;
      }

      reorderTask.mutate(payload);
    },
    [columns, reorderTask]
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  if (statuses.length === 0) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No status columns defined. Add statuses in the project settings first.
        </p>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((column) => (
          <div
            key={column.id}
            className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-card/50 transition-all duration-200 hover:border-primary/20"
          >
            {/* Column header */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground">
                  {column.title}
                </h4>
                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {column.tasks.length}
                </span>
              </div>
              <button
                onClick={() => onCreateTask(column.id)}
                className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                aria-label={`Add task to ${column.title}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Column tasks (droppable area) */}
            <Droppable droppableId={column.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`min-h-[120px] flex-1 space-y-1 p-2 transition-colors ${
                    snapshot.isDraggingOver ? "bg-primary/5" : ""
                  }`}
                >
                  {column.tasks.map((task, index) => (
                    <Draggable
                      key={task.id}
                      draggableId={task.id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`${
                            snapshot.isDragging ? "rotate-2 opacity-80" : ""
                          }`}
                        >
                          <TaskCard
                            task={task}
                            onClick={() => onTaskClick(task)}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}

                  {/* Empty state */}
                  {column.tasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-6">
                      <p className="text-xs text-muted-foreground">No tasks</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-7 gap-1 text-xs"
                        onClick={() => onCreateTask(column.id)}
                      >
                        <Plus className="h-3 w-3" />
                        Add task
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
