import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaskPriority } from "@/lib/types/task";

interface TaskFiltersState {
  search: string;
  priority?: TaskPriority;
  status?: string;
  assignedTo?: string;
}

interface TaskFiltersProps {
  filters: TaskFiltersState;
  onFiltersChange: (filters: TaskFiltersState) => void;
  statuses: string[];
  memberOptions: { id: string; label: string }[];
}

/**
 * Horizontal filter bar with search, priority, status, and assignee filters.
 */
export function TaskFilters({
  filters,
  onFiltersChange,
  statuses,
  memberOptions,
}: TaskFiltersProps) {
  const hasFilters =
    filters.search || filters.priority || filters.status || filters.assignedTo;

  const clearFilters = () => {
    onFiltersChange({ search: "" });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[160px]">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={filters.search || ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          className="pl-8"
        />
      </div>

      {/* Priority filter */}
      <Select
        value={filters.priority || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            priority: value === "all" ? undefined : (value as TaskPriority),
          })
        }
      >
        <SelectTrigger className="h-9 w-[120px] text-xs">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          <SelectItem value="Urgent">Urgent</SelectItem>
          <SelectItem value="High">High</SelectItem>
          <SelectItem value="Medium">Medium</SelectItem>
          <SelectItem value="Low">Low</SelectItem>
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select
        value={filters.status || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            status: value === "all" ? undefined : value,
          })
        }
      >
        <SelectTrigger className="h-9 w-[130px] text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {statuses.map((status) => (
            <SelectItem key={status} value={status}>
              {status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Assignee filter */}
      <Select
        value={filters.assignedTo || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            assignedTo: value === "all" ? undefined : value,
          })
        }
      >
        <SelectTrigger className="h-9 w-[140px] text-xs">
          <SelectValue placeholder="Assignee" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Assignees</SelectItem>
          {memberOptions.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs animate-in fade-in duration-200"
          onClick={clearFilters}
        >
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  );
}
