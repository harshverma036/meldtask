import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "@/lib/axios";
import { useAuth } from "@/hooks/useAuth";
import type { Team, TeamMember } from "@/pages/Teams";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Crown, Trash2, User } from "lucide-react";
import { format } from "date-fns";

interface Props {
  team: Team | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TeamDetailSheet({ team, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const currentMember = team?.members.find((m) => m.user.id === user?.id);
  const canManage = user?.role === "Admin" || currentMember?.role === "Lead";

  const removeMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      await api.delete(`/teams/${teamId}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Member removed from team");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to remove member");
    },
  });

  if (!team) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{team.name}</SheetTitle>
          {team.description && (
            <SheetDescription>{team.description}</SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">
              Members ({team.members.length})
            </h4>
          </div>

          {/* Member list */}
          <div className="space-y-1">
            {team.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {member.user.avatarUrl ? (
                      <img
                        src={member.user.avatarUrl}
                        alt=""
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      (member.user.name || member.user.email).charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {member.user.name || member.user.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.user.email}
                      {member.role === "Lead" && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-yellow-400">
                          <Crown className="h-3 w-3" />
                          Lead
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {canManage && member.user.id !== user?.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      removeMemberMutation.mutate({
                        teamId: team.id,
                        userId: member.user.id,
                      })
                    }
                    disabled={removeMemberMutation.isPending}
                    className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                    title="Remove member"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Created {format(new Date(team.createdAt), "MMM d, yyyy")}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
