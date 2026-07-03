import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router-dom";

interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
}

/**
 * Breadcrumb navigation showing the task hierarchy.
 * Used in task detail sheet and full page view.
 */
export function Breadcrumb({ segments }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link
        to="/tasks"
        className="flex items-center gap-1 rounded p-0.5 transition-colors hover:text-foreground"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {segments.map((segment, index) => (
        <span key={index} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5" />
          {segment.href ? (
            <Link
              to={segment.href}
              className="rounded p-0.5 transition-colors hover:text-foreground"
            >
              {segment.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{segment.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
