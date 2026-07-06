import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { format } from "date-fns";
import api from "@/lib/axios";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { InviteUserDialog } from "@/components/admin/InviteUserDialog";
import { Button } from "@/components/ui/button";
import { Navigate } from "react-router-dom";
import { Check, X, Shield, UserPlus, Trash2 } from "lucide-react";

/** User shape returned by the admin API */
interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "Admin" | "Developer" | "Manager";
  status: "Pending" | "Active" | "Rejected";
  domain: string | null;
  createdAt: string;
}

type Section = "members" | "pending";

export function AdminUsers() {
  const { user } = useAuth();
  const [section, setSection] = useState<Section>("members");
  const [inviteOpen, setInviteOpen] = useState(false);
  const queryClient = useQueryClient();

  // If not admin, redirect to home
  if (user && user.role !== "Admin") {
    return <Navigate to="/" replace />;
  }

  // Members tab = Active users, Pending tab = Pending users
  const statusFilter = section === "members" ? "Active" : "Pending";

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", statusFilter],
    queryFn: async () => {
      const res = await api.get<{ users: AdminUser[] }>("/users", {
        params: { status: statusFilter },
      });
      return res.data.users;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.patch(`/users/${userId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User approved");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to approve user");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.patch(`/users/${userId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User rejected");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to reject user");
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await api.patch(`/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Role updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update role");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User access removed");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to remove user");
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              User Management
            </h2>
            <p className="text-muted-foreground">
              Manage members and approve new users.
            </p>
          </div>

          {section === "members" && (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Invite User
            </Button>
          )}
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1 w-fit">
          <button
            onClick={() => setSection("members")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              section === "members"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Members
          </button>
          <button
            onClick={() => setSection("pending")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              section === "pending"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pending
          </button>
        </div>

        {/* Users table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        ) : data && data.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Domain</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((u) => (
                  <tr key={u.id} className="border-b border-border bg-card/50 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                          ) : (
                            (u.name || u.email).charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="font-medium text-foreground">{u.name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.domain || "—"}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) =>
                          roleMutation.mutate({ userId: u.id, role: e.target.value })
                        }
                        className="rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Developer">Developer</option>
                        <option value="Manager">Manager</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.status === "Active"
                            ? "bg-green-500/10 text-green-400"
                            : u.status === "Pending"
                              ? "bg-yellow-500/10 text-yellow-400"
                              : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {format(new Date(u.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.status === "Pending" && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => approveMutation.mutate(u.id)}
                            disabled={approveMutation.isPending}
                            className="rounded-md p-1.5 text-green-400 hover:bg-green-500/10 transition-colors"
                            title="Approve"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => rejectMutation.mutate(u.id)}
                            disabled={rejectMutation.isPending}
                            className="rounded-md p-1.5 text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Reject"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      {u.status === "Active" && u.id !== user?.id && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Remove ${u.email}'s access? This will delete their account.`)) {
                              removeMutation.mutate(u.id);
                            }
                          }}
                          disabled={removeMutation.isPending}
                          className="rounded-md p-1.5 text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Remove access"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border py-12 text-center">
            <Shield className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">
              {section === "members" ? "No members yet" : "No pending users"}
            </p>
          </div>
        )}
      </div>

      {/* Invite dialog */}
      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </DashboardLayout>
  );
}
