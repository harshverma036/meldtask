import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import api from "@/lib/axios";

/**
 * User shape returned by the API.
 * Mirrors the Prisma User model fields exposed via /api/me.
 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "Admin" | "Developer" | "Manager";
  status: "Pending" | "Active" | "Rejected";
  createdAt: string;
}

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check for existing token and fetch user profile
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      api
        .get<{ user: User }>("/me")
        .then((res) => setUser(res.data.user))
        .catch(() => localStorage.removeItem("auth_token"))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  /**
   * Send Google ID token to backend for verification.
   * Backend returns a JWT + user object.
   * Throws with descriptive message for domain rejection / pending approval.
   */
  const loginWithGoogle = useCallback(async (idToken: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/google", { idToken });
    localStorage.setItem("auth_token", res.data.token);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    setUser(null);
  }, []);

  return (
    <AuthContext value={{ user, isLoading, loginWithGoogle, logout }}>
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
