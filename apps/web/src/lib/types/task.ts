/**
 * Shared TypeScript interfaces for Task Management.
 * Mirrors the API response shapes from the backend.
 */

/** Minimal user info returned in task relations */
export interface TaskUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

/** File or link attachment on a task */
export interface TaskAsset {
  id: string;
  type: "file" | "link";
  url: string;
  name: string;
  size?: number | null;
  mimeType?: string | null;
  createdAt: string;
}

/** Comment on a task */
export interface TaskComment {
  id: string;
  content: string;
  author: TaskUser;
  createdAt: string;
  updatedAt: string;
}

/** A task (main or subtask) */
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: TaskPriority;
  dueDate: string | null;
  projectId: string;
  parentId: string | null;
  assignedTo: string | null;
  assignedBy: string | null;
  createdBy: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  // Relations (populated on detail fetch)
  assignee?: TaskUser | null;
  assigner?: TaskUser | null;
  creator?: TaskUser;
  children?: Task[];
  comments?: TaskComment[];
  assets?: TaskAsset[];
  _count?: {
    children: number;
    comments: number;
    assets: number;
  };
}

/** Task priority levels */
export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";

/** View mode for the tasks page */
export type TaskViewMode = "list" | "board";

/** Group-by options for list view */
export type TaskGroupBy = "status" | "priority" | "assignedTo" | "createdAt";

/** Filters for task queries */
export interface TaskFilters {
  status?: string;
  priority?: TaskPriority;
  assignedTo?: string;
  search?: string;
  parentId?: string | null;
}

/** Payload for creating a task */
export interface CreateTaskPayload {
  title: string;
  description?: string;
  status?: string;
  priority?: TaskPriority;
  dueDate?: string | null;
  assignedTo?: string | null;
  parentId?: string | null;
}

/** Payload for updating a task */
export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: TaskPriority;
  dueDate?: string | null;
  assignedTo?: string | null;
  parentId?: string | null;
}

/** Payload for reordering a task (drag-and-drop) */
export interface ReorderTaskPayload {
  position: number;
  status?: string;
}
