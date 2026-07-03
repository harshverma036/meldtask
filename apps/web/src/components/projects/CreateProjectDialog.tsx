import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "@/lib/axios";
import { SortableStatusChips } from "@/components/projects/SortableStatusChips";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Project {
  id: string;
  name: string;
  description: string | null;
  statuses: string[];
  workspaceId: string;
}

interface CreateProjectDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog form for creating a new project inside a workspace.
 * Includes a tag-style input for adding multiple statuses.
 */
export function CreateProjectDialog({
  workspaceId,
  open,
  onOpenChange,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [statusInput, setStatusInput] = useState("");
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      statuses: string[];
    }) => {
      const res = await api.post<{ project: Project }>(
        `/workspaces/${workspaceId}/projects`,
        data
      );
      return res.data.project;
    },
    onSuccess: () => {
      toast.success("Project created successfully!");
      setName("");
      setDescription("");
      setStatuses([]);
      setStatusInput("");
      onOpenChange(false);
      queryClient.invalidateQueries({
        queryKey: ["projects", workspaceId],
      });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to create project";
      toast.error(message);
    },
  });

  /** Add a status tag (Enter key or button click) */
  const addStatus = () => {
    const trimmed = statusInput.trim();
    if (!trimmed) return;
    // Avoid duplicates (case-insensitive)
    if (statuses.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setStatusInput("");
      return;
    }
    setStatuses([...statuses, trimmed]);
    setStatusInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addStatus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      statuses,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
          <DialogDescription>
            Add a new project to this workspace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="project-name"
              className="text-sm font-medium text-foreground"
            >
              Name
            </label>
            <Input
              id="project-name"
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="project-desc"
              className="text-sm font-medium text-foreground"
            >
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="project-desc"
              placeholder="Brief description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Status tags input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Statuses
            </label>
            {/* Sortable status chips */}
            <SortableStatusChips
              statuses={statuses}
              onReorder={setStatuses}
              onRemove={(i) =>
                setStatuses(statuses.filter((_, idx) => idx !== i))
              }
              editable
            />
            {/* Input + Add button */}
            <div className="flex gap-2">
              <Input
                placeholder='e.g. "In Progress"'
                value={statusInput}
                onChange={(e) => setStatusInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addStatus}
                disabled={!statusInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
            >
              {createMutation.isPending ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
