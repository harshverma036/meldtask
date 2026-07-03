import { Users, Trash2 } from "lucide-react";
import type { Team } from "@/pages/Teams";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  team: Team;
  onDelete: () => void;
  onClick: () => void;
}

export function TeamCard({ team, onDelete, onClick }: Props) {
  const { user } = useAuth();

  const currentMember = team.members.find((m) => m.user.id === user?.id);
  const canDelete = user?.role === "Admin" || currentMember?.role === "Lead";
  const memberCount = team.members.length;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-lg border border-border bg-card p-5 transition-colors hover:border-ring/50"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-card-foreground">
            {team.name}
          </h3>
          {team.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {team.description}
            </p>
          )}
        </div>

        {canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="ml-2 flex-shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            title="Delete team"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </span>

        <div className="ml-auto flex -space-x-2">
          {team.members.slice(0, 4).map((m) => (
            <div
              key={m.id}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary text-[10px] font-medium text-primary-foreground"
              title={m.user.name || m.user.email}
            >
              {m.user.avatarUrl ? (
                <img
                  src={m.user.avatarUrl}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                (m.user.name || m.user.email).charAt(0).toUpperCase()
              )}
            </div>
          ))}
          {memberCount > 4 && (
            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-secondary text-[10px] font-medium text-secondary-foreground">
              +{memberCount - 4}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
