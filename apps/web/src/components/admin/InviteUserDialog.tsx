import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLES = ["Developer", "Manager", "Admin"] as const;

export function InviteUserDialog({ open, onOpenChange }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("Developer");
  const [teamId, setTeamId] = useState("");
  const queryClient = useQueryClient();

  // Fetch teams for the dropdown
  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await api.get<{ teams: { id: string; name: string }[] }>("/teams");
      return res.data.teams;
    },
    enabled: open,
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: string; teamId?: string }) => {
      const res = await api.post("/users/invite", data);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      if (variables.teamId) {
        queryClient.invalidateQueries({ queryKey: ["teams"] });
      }
      toast.success(`Invited ${email} as ${role}`);
      setEmail("");
      setRole("Developer");
      setTeamId("");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to invite user");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    inviteMutation.mutate({
      email: email.trim(),
      role,
      teamId: teamId || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Invite a user by email. They will be pre-approved and can log in immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="invite-email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@youngun.in"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="invite-role" className="text-sm font-medium text-foreground">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
              className="flex h-9 w-full rounded-md border border-border bg-secondary px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="invite-team" className="text-sm font-medium text-foreground">
              Add to Team <span className="text-muted-foreground">(optional)</span>
            </label>
            <select
              id="invite-team"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border bg-secondary px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">No team</option>
              {teams?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!email.trim() || inviteMutation.isPending}>
              {inviteMutation.isPending ? "Inviting..." : "Invite User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
