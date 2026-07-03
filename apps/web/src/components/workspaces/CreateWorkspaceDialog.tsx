import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "@/lib/axios";
import { useWorkspace, type Workspace } from "@/hooks/useWorkspace";
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

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (workspace: Workspace) => void;
}

/**
 * Dialog form for creating a new workspace.
 * Only visible to Admin users.
 */
export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateWorkspaceDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { refreshWorkspaces, switchWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await api.post<{ workspace: Workspace }>("/workspaces", data);
      return res.data.workspace;
    },
    onSuccess: (workspace) => {
      toast.success("Workspace created successfully!");
      setName("");
      setDescription("");
      onOpenChange(false);
      // Invalidate both the query cache (for pages) and context state
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      refreshWorkspaces().then(() => {
        // Auto-switch to the newly created workspace
        switchWorkspace(workspace.id);
      });
      onCreated?.(workspace);
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to create workspace";
      toast.error(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
          <DialogDescription>
            Create a new workspace to organize your projects.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="workspace-name"
              className="text-sm font-medium text-foreground"
            >
              Name
            </label>
            <Input
              id="workspace-name"
              placeholder="Workspace name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="workspace-desc"
              className="text-sm font-medium text-foreground"
            >
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="workspace-desc"
              placeholder="Brief description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
              {createMutation.isPending ? "Creating..." : "Create Workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
