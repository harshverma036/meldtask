import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "@/lib/axios";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Crown, Trash2, Plus, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Member {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

interface WorkspaceData {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  members: Member[];
}

interface WorkspaceDetailSheetProps {
  workspace: WorkspaceData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Slide-over sheet showing workspace details and member management.
 * Uses shadcn Sheet component.
 */
export function WorkspaceDetailSheet({
  workspace,
  open,
  onOpenChange,
}: WorkspaceDetailSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"Admin" | "Member">("Member");

  const currentMember = workspace.members.find((m) => m.user.id === user?.id);
  const isOwner = currentMember?.role === "Owner";
  const isWorkspaceAdmin =
    isOwner || currentMember?.role === "Admin";
  const isSystemAdmin = user?.role === "Admin";
  const canManage = isWorkspaceAdmin || isSystemAdmin;

  /** Add a member by email */
  const addMemberMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const res = await api.post<{ member: Member }>(
        `/workspaces/${workspace.id}/members`,
        data
      );
      return res.data.member;
    },
    onSuccess: () => {
      toast.success("Member added successfully!");
      setMemberEmail("");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to add member";
      toast.error(message);
    },
  });

  /** Remove a member */
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/workspaces/${workspace.id}/members/${userId}`);
    },
    onSuccess: () => {
      toast.success("Member removed successfully!");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to remove member";
      toast.error(message);
    },
  });

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    addMemberMutation.mutate({
      email: memberEmail.trim(),
      role: memberRole,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{workspace.name}</SheetTitle>
          <SheetDescription>
            {workspace.description || "No description"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex-1 space-y-6">
          {/* Members section */}
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Members ({workspace.members.length})
            </h4>
            <div className="mt-3 space-y-2">
              {workspace.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-md border border-border p-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                      {member.user.avatarUrl ? (
                        <img
                          src={member.user.avatarUrl}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        (member.user.name || member.user.email)
                          .charAt(0)
                          .toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {member.user.name || member.user.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.user.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                      {member.role === "Owner" && (
                        <Crown className="h-3 w-3 text-yellow-400" />
                      )}
                      {member.role}
                    </span>
                    {canManage && member.role !== "Owner" && (
                      <button
                        onClick={() =>
                          removeMemberMutation.mutate(member.user.id)
                        }
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${member.user.name || member.user.email}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add member form (only for managers) */}
          {canManage && (
            <form onSubmit={handleAddMember} className="space-y-3 border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-foreground">
                Add Member
              </h4>
              <div className="flex gap-2">
                <Input
                  placeholder="Email address"
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="flex-1"
                />
                <select
                  value={memberRole}
                  onChange={(e) =>
                    setMemberRole(e.target.value as "Admin" | "Member")
                  }
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                >
                  <option value="Member">Member</option>
                  <option value="Admin">Admin</option>
                </select>
                <Button
                  type="submit"
                  size="icon"
                  disabled={addMemberMutation.isPending || !memberEmail.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Footer with creation info */}
        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Created {format(new Date(workspace.createdAt), "MMM d, yyyy")}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
