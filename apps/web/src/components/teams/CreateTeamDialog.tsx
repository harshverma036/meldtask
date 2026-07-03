import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "@/lib/axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTeamDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; memberEmails?: string[] }) => {
      const res = await api.post("/teams", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Team created successfully");
      setName("");
      setDescription("");
      setEmails([]);
      setEmailInput("");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create team");
    },
  });

  const addEmail = () => {
    const trimmed = emailInput.trim();
    if (!trimmed) return;
    if (!trimmed.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (emails.includes(trimmed)) {
      toast.error("This email is already added");
      return;
    }
    setEmails([...emails, trimmed]);
    setEmailInput("");
  };

  const removeEmail = (email: string) => {
    setEmails(emails.filter((e) => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addEmail();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      memberEmails: emails.length > 0 ? emails : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Team</DialogTitle>
          <DialogDescription>
            Create a new team and add members by email.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="team-name" className="text-sm font-medium text-foreground">
              Team Name
            </label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering"
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="team-desc" className="text-sm font-medium text-foreground">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="team-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this team about?"
              rows={3}
              maxLength={500}
              className="flex w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Add Members <span className="text-muted-foreground">(optional)</span>
            </label>
            <div className="flex gap-2">
              <Input
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="colleague@youngun.in"
                type="email"
              />
              <Button type="button" variant="outline" onClick={addEmail}>
                Add
              </Button>
            </div>

            {/* Email chips */}
            {emails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {emails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs text-foreground"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
