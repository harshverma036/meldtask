import { GoogleOAuthProvider } from "@react-oauth/google";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { toast } from "react-toastify";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export function Login() {
  const { user, isLoading } = useAuth();

  // If already authenticated, redirect to dashboard
  if (!isLoading && user) {
    // Pending users can't access dashboard — they stay on login
    if (user.status === "Pending") {
      toast.warn("Your account is pending admin approval. You'll be notified when approved.");
      return <LoginContent />;
    }
    if (user.status === "Rejected") {
      toast.error("Your account has been rejected. Contact an administrator.");
      return <LoginContent />;
    }
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  return <LoginContent />;
}

/** Stateless login UI — shown to unauthenticated users and pending/rejected users */
function LoginContent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            meldtask
          </h1>
          <p className="mt-3 text-muted-foreground">
            Task, team, and goal management
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex justify-center">
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
              <GoogleSignInButton />
            </GoogleOAuthProvider>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Sign in to access your workspace
          </p>
        </div>
      </div>
    </div>
  );
}
