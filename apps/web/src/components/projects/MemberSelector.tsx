import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { Search, Check, ChevronDown } from "lucide-react";

interface WorkspaceMember {
  id: string;
  role: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

interface MemberSelectorProps {
  workspaceId: string;
  /** IDs of users already in the project (to exclude from the list) */
  excludeUserIds: string[];
  onSelect: (member: WorkspaceMember) => void;
  disabled?: boolean;
}

/**
 * Searchable dropdown to select a user from workspace members.
 * Only shows users who are NOT already in the project.
 */
export function MemberSelector({
  workspaceId,
  excludeUserIds,
  onSelect,
  disabled,
}: MemberSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: async () => {
      const res = await api.get<{ members: WorkspaceMember[] }>(
        `/workspaces/${workspaceId}/members`
      );
      return res.data.members;
    },
    enabled: !!workspaceId,
    staleTime: 30000,
  });

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Filter: only workspace members NOT already in the project
  const available = members.filter(
    (m) => !excludeUserIds.includes(m.user.id)
  );

  // Search filter
  const filtered = search.trim()
    ? available.filter(
        (m) =>
          (m.user.name || "")
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          m.user.email.toLowerCase().includes(search.toLowerCase())
      )
    : available;

  const handleSelect = (member: WorkspaceMember) => {
    onSelect(member);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled || available.length === 0}
        className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="text-muted-foreground">
          {available.length === 0
            ? "No users available"
            : `${available.length} user${available.length !== 1 ? "s" : ""} available`}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-card shadow-lg">
          {/* Search input */}
          <div className="flex items-center border-b border-border px-3 py-2">
            <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ml-2 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
          </div>

          {/* Member list */}
          <div className="max-h-48 overflow-y-auto p-1">
            {isLoading ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                Loading...
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                {search.trim()
                  ? "No matching users"
                  : "No available users"}
              </p>
            ) : (
              filtered.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleSelect(member)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                    {member.user.avatarUrl ? (
                      <img
                        src={member.user.avatarUrl}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      (member.user.name || member.user.email)
                        .charAt(0)
                        .toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {member.user.name || member.user.email}
                    </p>
                    {member.user.name && (
                      <p className="truncate text-xs text-muted-foreground">
                        {member.user.email}
                      </p>
                    )}
                  </div>
                  {excludeUserIds.includes(member.user.id) && (
                    <Check className="h-4 w-4 text-green-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
