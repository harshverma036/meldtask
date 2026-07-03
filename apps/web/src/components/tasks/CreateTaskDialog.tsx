import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useCreateTask } from "@/hooks/useTasks";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Validation schema using yup */
const schema = yup.object({
  title: yup
    .string()
    .required("Title is required")
    .max(200, "Title must be at most 200 characters"),
  description: yup
    .string()
    .max(2000, "Description must be at most 2000 characters")
    .optional()
    .default(""),
  priority: yup
    .string()
    .oneOf(["Low", "Medium", "High", "Urgent"])
    .default("Medium"),
  status: yup.string().optional().default(""),
  dueDate: yup.string().nullable().optional().default(null),
  assignedTo: yup.string().nullable().optional().default(null),
});

interface CreateTaskDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentTaskId?: string;
  parentTaskTitle?: string;
  projectStatuses: string[];
  memberOptions: { id: string; label: string }[];
}

/**
 * Sheet form for creating a new task (or subtask).
 * Opens from the right side. Uses react-hook-form + yup for form state and validation.
 */
export function CreateTaskDialog({
  projectId,
  open,
  onOpenChange,
  parentTaskId,
  parentTaskTitle,
  projectStatuses,
  memberOptions,
}: CreateTaskDialogProps) {
  const createTask = useCreateTask(projectId);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      priority: "Medium" as const,
      status: projectStatuses[0] || "Backlog",
      dueDate: null as string | null,
      assignedTo: null as string | null,
    },
  });

  const onSubmit = (data: {
    title: string;
    description?: string;
    priority: string;
    status?: string;
    dueDate?: string | null;
    assignedTo?: string | null;
  }) => {
    createTask.mutate(
      {
        title: data.title,
        description: data.description || undefined,
        priority: data.priority as "Low" | "Medium" | "High" | "Urgent",
        status: data.status || undefined,
        dueDate: data.dueDate || null,
        assignedTo: data.assignedTo || null,
        parentId: parentTaskId || null,
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      }
    );
  };

  const isSubtask = !!parentTaskId;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {isSubtask ? "Create Subtask" : "Create Task"}
          </SheetTitle>
          <SheetDescription>
            {isSubtask
              ? `Add a subtask under "${parentTaskTitle || "parent task"}".`
              : "Add a new task to this project."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 space-y-4 mt-4">
          {/* Title */}
          <div className="space-y-2">
            <label htmlFor="task-title" className="text-sm font-medium text-foreground">
              Title
            </label>
            <Input
              id="task-title"
              placeholder="Task title"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-red-400">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="task-desc" className="text-sm font-medium text-foreground">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="task-desc"
              placeholder="Brief description..."
              rows={3}
              {...register("description")}
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Priority
            </label>
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Status
            </label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || ""}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Due date */}
          <div className="space-y-2">
            <label htmlFor="task-due" className="text-sm font-medium text-foreground">
              Due Date{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input id="task-due" type="date" {...register("dueDate")} />
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Assignee{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Controller
              name="assignedTo"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || "none"}
                  onValueChange={(value) =>
                    field.onChange(value === "none" ? null : value)
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {memberOptions.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createTask.isPending}
            >
              {createTask.isPending
                ? "Creating..."
                : isSubtask
                  ? "Create Subtask"
                  : "Create Task"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
