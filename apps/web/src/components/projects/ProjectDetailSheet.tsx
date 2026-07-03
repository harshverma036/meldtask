import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "@/lib/axios";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { format } from "date-fns";
import {
  Crown,
  Trash2,
  Pencil,
  Check,
  Calendar,
  Building,
  Plus,
} from "lucide-react";
import { SortableStatusChips } from "@/components/projects/SortableStatusChips";
import { MemberSelector } from "@/components/projects/MemberSelector";
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

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  statuses: string[];
  workspaceId: string;
  createdBy: string;
  createdAt: string;
  members: Member[];
}

interface ProjectDetailSheetProps {
  project: ProjectData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after any mutation to sync updated project data to the parent */
  onUpdate?: (updated: ProjectData) => void;
}

/**
 * Slide-over sheet that acts as the central hub for a project.
 * Shows all project info, inline-editable name/description,
 * sortable statuses with sequence numbers, and member management.
 */
export function ProjectDetailSheet({
  project,
  open,
  onOpenChange,
  onUpdate,
}: ProjectDetailSheetProps) {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  // Inline editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState(project.description || "");
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Member add state
  const [memberRole, setMemberRole] = useState<"Owner" | "Member">("Member");
  const [newStatus, setNewStatus] = useState("");

  // Reset editing state when project changes
  useEffect(() => {
    setEditName(project.name);
    setEditDesc(project.description || "");
    setIsEditingName(false);
    setIsEditingDesc(false);
  }, [project.id, project.name, project.description]);

  // Focus name input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const currentMember = project.members.find((m) => m.user.id === user?.id);
  const isProjectOwner = currentMember?.role === "Owner";
  const isSystemAdmin = user?.role === "Admin";
  const canManage = isProjectOwner || isSystemAdmin;

  const statuses: string[] = project.statuses ?? [];

  /** Helper to invalidate cache and sync parent state */
  const afterMutation = (updated?: ProjectData) => {
    queryClient.invalidateQueries({
      queryKey: ["projects", project.workspaceId],
    });
    if (updated && onUpdate) {
      onUpdate(updated);
    }
  };

  /** Update project fields (name, description, statuses) */
  const updateProjectMutation = useMutation({
    mutationFn: async (data: {
      name?: string;
      description?: string;
      statuses?: string[];
    }) => {
      const res = await api.patch<{ project: ProjectData }>(
        `/workspaces/${project.workspaceId}/projects/${project.id}`,
        data
      );
      return res.data.project;
    },
    onSuccess: (updated) => {
      afterMutation(updated);
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to update project";
      toast.error(message);
    },
  });

  /** Save name inline */
  const saveName = () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditName(project.name);
      setIsEditingName(false);
      return;
    }
    if (trimmed === project.name) {
      setIsEditingName(false);
      return;
    }
    updateProjectMutation.mutate({ name: trimmed });
    setIsEditingName(false);
  };

  /** Save description inline */
  const saveDesc = () => {
    const trimmed = editDesc.trim();
    if (trimmed === (project.description || "")) {
      setIsEditingDesc(false);
      return;
    }
    updateProjectMutation.mutate({ description: trimmed });
    setIsEditingDesc(false);
  };

  /** Update statuses (add/remove/reorder) */
  const updateStatuses = (updated: string[]) => {
    updateProjectMutation.mutate({ statuses: updated });
  };

  /** Add a new status tag */
  const addStatus = () => {
    const trimmed = newStatus.trim();
    if (!trimmed) return;
    if (statuses.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setNewStatus("");
      return;
    }
    updateStatuses([...statuses, trimmed]);
    setNewStatus("");
  };

  const handleStatusKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addStatus();
    }
  };

  /** Add a member by email */
  const addMemberMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const res = await api.post<{ member: Member }>(
        `/workspaces/${project.workspaceId}/projects/${project.id}/members`,
        data
      );
      return res.data.member;
    },
    onSuccess: () => {
      toast.success("Member added successfully!");
      afterMutation();
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
      await api.delete(
        `/workspaces/${project.workspaceId}/projects/${project.id}/members/${userId}`
      );
    },
    onSuccess: () => {
      toast.success("Member removed successfully!");
      afterMutation();
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to remove member";
      toast.error(message);
    },
  });

  const owner = project.members.find((m) => m.role === "Owner");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
        {/* ── Header: Name + Description (inline editable) ── */}
        <SheetHeader className="text-left">
          {/* Editable Name */}
          {isEditingName && canManage ? (
            <div className="flex items-center gap-2">
              <Input
                ref={nameInputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") {
                    setEditName(project.name);
                    setIsEditingName(false);
                  }
                }}
                onBlur={saveName}
                className="text-lg font-semibold"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={saveName}
              >
                <Check className="h-4 w-4 text-green-400" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <SheetTitle className="flex-1">{project.name}</SheetTitle>
              {canManage && (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  aria-label="Edit name"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Editable Description */}
          {isEditingDesc && canManage ? (
            <div className="mt-1">
              <Input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveDesc();
                  if (e.key === "Escape") {
                    setEditDesc(project.description || "");
                    setIsEditingDesc(false);
                  }
                }}
                onBlur={saveDesc}
                placeholder="Add a description..."
                className="text-sm"
              />
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <SheetDescription className="flex-1">
                {project.description || "No description"}
              </SheetDescription>
              {canManage && (
                <button
                  onClick={() => setIsEditingDesc(true)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  aria-label="Edit description"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </SheetHeader>

        <div className="mt-6 flex-1 space-y-6">
          {/* ── Project Info ── */}
          <div className="space-y-2 rounded-md border border-border bg-card/50 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building className="h-3.5 w-3.5" />
              <span>{activeWorkspace?.name || "Workspace"}</span>
            </div>
            {owner && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Crown className="h-3.5 w-3.5 text-yellow-400" />
                <span>
                  Owned by {owner.user.name || owner.user.email}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                Created {format(new Date(project.createdAt), "MMM d, yyyy")}
              </span>
            </div>
          </div>

          {/* ── Statuses with Sequence ── */}
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">
                Status Pipeline
              </h4>
              {statuses.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {statuses.length} stage{statuses.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="mt-2">
              <SortableStatusChips
                statuses={statuses}
                onReorder={updateStatuses}
                onRemove={(i) =>
                  updateStatuses(statuses.filter((_, idx) => idx !== i))
                }
                editable={canManage}
              />
            </div>

            {statuses.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                No status stages defined yet. Add some below.
              </p>
            )}

            {/* Add status input */}
            {canManage && (
              <div className="mt-3 flex gap-2">
                <Input
                  placeholder='Add stage, e.g. "In Progress"'
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  onKeyDown={handleStatusKeyDown}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addStatus}
                  disabled={
                    updateProjectMutation.isPending || !newStatus.trim()
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* ── Members ── */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">
                Members ({project.members.length})
              </h4>
            </div>
            <div className="mt-3 space-y-2">
              {project.members.map((member) => (
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
                        {member.user.id === user?.id && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
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

            {/* Add member — searchable selector from workspace members */}
            {canManage && (
              <div className="space-y-3">
                <MemberSelector
                  workspaceId={project.workspaceId}
                  excludeUserIds={project.members.map((m) => m.user.id)}
                  onSelect={(member) => {
                    addMemberMutation.mutate({
                      email: member.user.email,
                      role: memberRole,
                    });
                  }}
                  disabled={addMemberMutation.isPending}
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Role:</span>
                  <select
                    value={memberRole}
                    onChange={(e) =>
                      setMemberRole(e.target.value as "Owner" | "Member")
                    }
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                  >
                    <option value="Member">Member</option>
                    <option value="Owner">Owner</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
