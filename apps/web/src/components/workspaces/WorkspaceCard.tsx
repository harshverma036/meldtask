import { type Workspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { Users, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceCardProps {
  workspace: Workspace & {
    members?: Array<{
      id: string;
      role: string;
      user: { id: string; email: string; name: string | null; avatarUrl: string | null };
    }>;
  };
  onClick: () => void;
  onDelete?: () => void;
  isActive?: boolean;
}

/**
 * Card component displaying a workspace summary.
 * Shows name, description, member count with avatars, and optional delete button.
 */
export function WorkspaceCard({
  workspace,
  onClick,
  onDelete,
  isActive,
}: WorkspaceCardProps) {
  const { user } = useAuth();
  const members = workspace.members ?? [];
  const isOwner = members.some(
    (m) => m.user.id === user?.id && m.role === "Owner"
  );
  const isAdmin = user?.role === "Admin";

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative cursor-pointer rounded-lg border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md active:scale-[0.98]",
        isActive && "border-primary"
      )}
    >
      {/* Delete button — visible to Owner or Admin on hover */}
      {(isOwner || isAdmin) && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          aria-label="Delete workspace"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      <h3 className="font-semibold text-card-foreground">{workspace.name}</h3>
      {workspace.description && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {workspace.description}
        </p>
      )}

      {/* Member count + avatar stack */}
      {members.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <div className="flex -space-x-2">
            {members.slice(0, 4).map((m) => (
              <div
                key={m.id}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-secondary text-[10px] font-medium text-secondary-foreground"
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
            {members.length > 4 && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium text-muted-foreground">
                +{members.length - 4}
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            <Users className="mr-0.5 inline h-3 w-3" />
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
        </div>
      )}
    </div>
  );
}
