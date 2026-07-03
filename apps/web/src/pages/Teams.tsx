import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "@/lib/axios";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CreateTeamDialog } from "@/components/teams/CreateTeamDialog";
import { TeamDetailSheet } from "@/components/teams/TeamDetailSheet";
import { TeamCard } from "@/components/teams/TeamCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

/** A team as returned by the API */
export interface Team {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  members: TeamMember[];
}

export interface TeamMember {
  id: string;
  role: "Lead" | "Member";
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

export function Teams() {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await api.get<{ teams: Team[] }>("/teams");
      return res.data.teams;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (teamId: string) => {
      await api.delete(`/teams/${teamId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Team deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete team");
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Teams
            </h2>
            <p className="text-muted-foreground">
              Manage your teams and members.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Team
          </Button>
        </div>

        {/* Teams grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        ) : data && data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                onClick={() => setSelectedTeam(team)}
                onDelete={() => deleteMutation.mutate(team.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border py-12 text-center">
            <p className="text-muted-foreground">No teams yet</p>
            <button
              onClick={() => setCreateOpen(true)}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Create your first team
            </button>
          </div>
        )}
      </div>

      <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} />
      <TeamDetailSheet
        team={selectedTeam}
        open={!!selectedTeam}
        onOpenChange={(open) => {
          if (!open) setSelectedTeam(null);
        }}
      />
    </DashboardLayout>
  );
}
