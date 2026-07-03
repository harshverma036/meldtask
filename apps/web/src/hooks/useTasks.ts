import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "@/lib/axios";
import type {
  Task,
  TaskComment,
  TaskAsset,
  CreateTaskPayload,
  UpdateTaskPayload,
  ReorderTaskPayload,
} from "@/lib/types/task";

/**
 * Custom hook that wraps TanStack Query for all task-related API operations.
 * Provides queries for fetching tasks and mutations for CRUD + comments + assets.
 */

/** Fetch tasks for a project, optionally filtered */
export function useTasks(
  projectId: string | undefined,
  filters?: Record<string, string | undefined>
) {
  return useQuery({
    queryKey: ["tasks", projectId, filters],
    queryFn: async () => {
      if (!projectId) return [];
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== "") {
            params.set(key, value);
          }
        });
      }
      const queryStr = params.toString();
      const res = await api.get<{ tasks: Task[] }>(
        `/projects/${projectId}/tasks${queryStr ? `?${queryStr}` : ""}`
      );
      return res.data.tasks;
    },
    enabled: !!projectId,
  });
}

/** Fetch a single task with full details (children, comments, assets) */
export function useTask(projectId: string | undefined, taskId: string | undefined) {
  return useQuery({
    queryKey: ["task", projectId, taskId],
    queryFn: async () => {
      const res = await api.get<{ task: Task }>(
        `/projects/${projectId}/tasks/${taskId}`
      );
      return res.data.task;
    },
    enabled: !!projectId && !!taskId,
  });
}

/** Create a new task */
export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTaskPayload) => {
      const res = await api.post<{ task: Task }>(
        `/projects/${projectId}/tasks`,
        payload
      );
      return res.data.task;
    },
    onSuccess: () => {
      toast.success("Task created successfully!");
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to create task";
      toast.error(message);
    },
  });
}

/** Update an existing task */
export function useUpdateTask(projectId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateTaskPayload) => {
      const res = await api.patch<{ task: Task }>(
        `/projects/${projectId}/tasks/${taskId}`,
        payload
      );
      return res.data.task;
    },
    onSuccess: () => {
      toast.success("Task updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["task", projectId, taskId] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to update task";
      toast.error(message);
    },
  });
}

/** Delete a task */
export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      await api.delete(`/projects/${projectId}/tasks/${taskId}`);
    },
    onSuccess: () => {
      toast.success("Task deleted successfully!");
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to delete task";
      toast.error(message);
    },
  });
}

/** Reorder a task (drag-and-drop position / status change) */
export function useReorderTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      payload,
    }: {
      taskId: string;
      payload: ReorderTaskPayload;
    }) => {
      const res = await api.patch<{ task: Task }>(
        `/projects/${projectId}/tasks/${taskId}/reorder`,
        payload
      );
      return res.data.task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to reorder task";
      toast.error(message);
    },
  });
}

// ── Comments ──────────────────────────────────────────────────────────────────

/** Fetch comments for a task */
export function useTaskComments(
  projectId: string | undefined,
  taskId: string | undefined
) {
  return useQuery({
    queryKey: ["task-comments", projectId, taskId],
    queryFn: async () => {
      const res = await api.get<{ comments: TaskComment[] }>(
        `/projects/${projectId}/tasks/${taskId}/comments`
      );
      return res.data.comments;
    },
    enabled: !!projectId && !!taskId,
  });
}

/** Add a comment to a task */
export function useCreateComment(projectId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post<{ comment: TaskComment }>(
        `/projects/${projectId}/tasks/${taskId}/comments`,
        { content }
      );
      return res.data.comment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["task-comments", projectId, taskId],
      });
      queryClient.invalidateQueries({ queryKey: ["task", projectId, taskId] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to add comment";
      toast.error(message);
    },
  });
}

/** Delete a comment */
export function useDeleteComment(projectId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      await api.delete(
        `/projects/${projectId}/tasks/${taskId}/comments/${commentId}`
      );
    },
    onSuccess: () => {
      toast.success("Comment deleted!");
      queryClient.invalidateQueries({
        queryKey: ["task-comments", projectId, taskId],
      });
      queryClient.invalidateQueries({ queryKey: ["task", projectId, taskId] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to delete comment";
      toast.error(message);
    },
  });
}

// ── Assets ────────────────────────────────────────────────────────────────────

/** Fetch assets for a task */
export function useTaskAssets(
  projectId: string | undefined,
  taskId: string | undefined
) {
  return useQuery({
    queryKey: ["task-assets", projectId, taskId],
    queryFn: async () => {
      const res = await api.get<{ assets: TaskAsset[] }>(
        `/projects/${projectId}/tasks/${taskId}/assets`
      );
      return res.data.assets;
    },
    enabled: !!projectId && !!taskId,
  });
}

/** Upload a file to a task */
export function useUploadAsset(projectId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post<{ asset: TaskAsset }>(
        `/projects/${projectId}/tasks/${taskId}/assets/upload`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return res.data.asset;
    },
    onSuccess: () => {
      toast.success("File uploaded successfully!");
      queryClient.invalidateQueries({
        queryKey: ["task-assets", projectId, taskId],
      });
      queryClient.invalidateQueries({ queryKey: ["task", projectId, taskId] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to upload file";
      toast.error(message);
    },
  });
}

/** Attach a link to a task */
export function useCreateAssetLink(projectId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { url: string; name: string }) => {
      const res = await api.post<{ asset: TaskAsset }>(
        `/projects/${projectId}/tasks/${taskId}/assets/link`,
        data
      );
      return res.data.asset;
    },
    onSuccess: () => {
      toast.success("Link added successfully!");
      queryClient.invalidateQueries({
        queryKey: ["task-assets", projectId, taskId],
      });
      queryClient.invalidateQueries({ queryKey: ["task", projectId, taskId] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to add link";
      toast.error(message);
    },
  });
}

/** Delete an asset */
export function useDeleteAsset(projectId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assetId: string) => {
      await api.delete(
        `/projects/${projectId}/tasks/${taskId}/assets/${assetId}`
      );
    },
    onSuccess: () => {
      toast.success("Asset removed!");
      queryClient.invalidateQueries({
        queryKey: ["task-assets", projectId, taskId],
      });
      queryClient.invalidateQueries({ queryKey: ["task", projectId, taskId] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Failed to remove asset";
      toast.error(message);
    },
  });
}
