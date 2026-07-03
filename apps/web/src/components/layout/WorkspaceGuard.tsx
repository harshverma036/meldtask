import { useWorkspace } from "@/hooks/useWorkspace";
import { WorkspaceSelection } from "@/pages/WorkspaceSelection";
import type { ReactNode } from "react";

/**
 * Guard component that ensures the user has selected a workspace
 * before rendering the main app content.
 *
 * - Shows a loading spinner while workspaces are being fetched.
 * - Renders the WorkspaceSelection page if no workspace is active.
 * - Otherwise renders children (the actual page).
 */
export function WorkspaceGuard({ children }: { children: ReactNode }) {
  const { activeWorkspace, isLoading } = useWorkspace();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return <WorkspaceSelection />;
  }

  return <>{children}</>;
}
