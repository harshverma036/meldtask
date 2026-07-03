import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import api from "@/lib/axios";

/**
 * Workspace shape returned by the API.
 * Mirrors the Prisma Workspace model with the user's membership role.
 */
export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // The requesting user's role in this workspace (from membership)
  role?: "Owner" | "Admin" | "Member";
  // Member count for display
  _count?: {
    members: number;
    projects: number;
  };
}

export interface WorkspaceContextValue {
  /** The currently active workspace, or null if none selected */
  activeWorkspace: Workspace | null;
  /** All workspaces the user belongs to */
  workspaces: Workspace[];
  /** Whether the initial workspace fetch is in progress */
  isLoading: boolean;
  /** Switch to a different workspace */
  switchWorkspace: (workspaceId: string) => void;
  /** Re-fetch workspace list from API */
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const ACTIVE_WORKSPACE_KEY = "active_workspace_id";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Fetch all workspaces the current user belongs to.
   */
  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await api.get<{ workspaces: Workspace[] }>("/workspaces");
      const list = res.data.workspaces;
      setWorkspaces(list);

      // Resolve active workspace from localStorage
      const storedId = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
      if (storedId) {
        const found = list.find((w) => w.id === storedId);
        if (found) {
          setActiveWorkspace(found);
          return;
        }
        // Stored workspace no longer accessible — clear it
        localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
      }

      // Auto-select first workspace if available
      if (list.length > 0 && !storedId) {
        const first = list[0]!;
        setActiveWorkspace(first);
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, first.id);
      }
    } catch {
      // User might not be authenticated — handled by ProtectedRoute
      setWorkspaces([]);
      setActiveWorkspace(null);
    }
  }, []);

  // Fetch workspaces on mount (when user is authenticated)
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      fetchWorkspaces().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [fetchWorkspaces]);

  /**
   * Switch to a different workspace, persisting the choice.
   */
  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      const found = workspaces.find((w) => w.id === workspaceId);
      if (found) {
        setActiveWorkspace(found);
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
      }
    },
    [workspaces]
  );

  /**
   * Re-fetch workspaces from the API (e.g. after creating a new one).
   */
  const refreshWorkspaces = useCallback(async () => {
    await fetchWorkspaces();
  }, [fetchWorkspaces]);

  return (
    <WorkspaceContext
      value={{
        activeWorkspace,
        workspaces,
        isLoading,
        switchWorkspace,
        refreshWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx)
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
