import { useAuth } from "@/hooks/useAuth";
import { getStatusColor } from "@/lib/projectStatus";
import { Users, Trash2 } from "lucide-react";

interface ProjectMember {
  id: string;
  role: string;
  user: { id: string; email: string; name: string | null; avatarUrl: string | null };
}

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  statuses?: string[];
  members?: ProjectMember[];
}

interface ProjectCardProps {
  project: ProjectData;
  onClick: () => void;
  onDelete?: () => void;
}

/**
 * Card component displaying a project summary.
 * Shows name, description, status chips, member count with avatars, and delete button.
 */
export function ProjectCard({
  project,
  onClick,
  onDelete,
}: ProjectCardProps) {
  const { user } = useAuth();
  const members = project.members ?? [];
  const statuses = project.statuses ?? [];
  const isOwner = members.some(
    (m) => m.user.id === user?.id && m.role === "Owner"
  );
  const isAdmin = user?.role === "Admin";

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer rounded-lg border bg-card p-5 transition-colors hover:border-primary/50"
    >
      {/* Delete button — visible to Owner or Admin on hover */}
      {(isOwner || isAdmin) && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          aria-label="Delete project"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      <h3 className="font-semibold text-card-foreground">{project.name}</h3>
      {project.description && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {project.description}
        </p>
      )}

      {/* Status chips */}
      {statuses.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {statuses.map((s, i) => (
            <span
              key={i}
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(s)}`}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Member count + avatar stack */}
      {members.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
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
