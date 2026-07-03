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
  /** Switch to a different workspace by ID (must exist in workspaces array) */
  switchWorkspace: (workspaceId: string) => void;
  /** Directly set the active workspace from a Workspace object */
  setActiveWorkspace: (workspace: Workspace) => void;
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
  // Track whether we've already done the initial fetch to avoid redundant calls
  const [hasFetched, setHasFetched] = useState(false);

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

  /**
   * Poll localStorage for an auth token. When the token appears (after login),
   * fetch workspaces. This handles the case where WorkspaceProvider mounts
   * before the user logs in.
   */
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    const checkAndFetch = () => {
      const token = localStorage.getItem("auth_token");
      if (token && !hasFetched) {
        setHasFetched(true);
        fetchWorkspaces().finally(() => setIsLoading(false));
        // Stop polling once we've fetched
        if (interval) clearInterval(interval);
      } else if (!token) {
        setIsLoading(false);
      }
    };

    // Check immediately
    checkAndFetch();

    // Also poll every 500ms for the first 10 seconds to catch the token
    // being set shortly after mount (e.g. during login flow)
    if (!hasFetched) {
      interval = setInterval(checkAndFetch, 500);
      // Stop polling after 20 seconds to avoid infinite loops
      setTimeout(() => {
        if (interval) {
          clearInterval(interval);
          setIsLoading(false);
        }
      }, 20000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchWorkspaces, hasFetched]);

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
   * Directly set the active workspace from a Workspace object.
   * Used by WorkspaceSelection when it has fetched workspaces independently.
   * Also adds the workspace to the internal list if not already present.
   */
  const setActiveWorkspaceDirectly = useCallback(
    (workspace: Workspace) => {
      setActiveWorkspace(workspace);
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspace.id);
      // Also add to the workspaces list if not already there
      setWorkspaces((prev) => {
        if (prev.find((w) => w.id === workspace.id)) return prev;
        return [...prev, workspace];
      });
    },
    []
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
        setActiveWorkspace: setActiveWorkspaceDirectly,
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
