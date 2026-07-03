import { useRef, useCallback } from "react";
import { getStatusColor } from "@/lib/projectStatus";
import { X, GripVertical } from "lucide-react";

interface SortableStatusChipsProps {
  /** The ordered list of status strings (unique) */
  statuses: string[];
  /** Called when the order changes (after drop) with the reordered array */
  onReorder: (statuses: string[]) => void;
  /** Called when a chip's X button is clicked */
  onRemove: (index: number) => void;
  /** Whether the user can edit (drag + remove). When false, chips are read-only. */
  editable?: boolean;
}

/**
 * Renders a list of status chips as full-width rows that can be reordered via drag-and-drop.
 * Uses HTML5 Drag and Drop API with refs (not state) during drag to avoid re-renders
 * that would break the drag operation inside Sheets/Dialogs.
 */
export function SortableStatusChips({
  statuses,
  onReorder,
  onRemove,
  editable = false,
}: SortableStatusChipsProps) {
  const dragIndexRef = useRef<number | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      if (!editable) {
        e.preventDefault();
        return;
      }
      dragIndexRef.current = index;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
      const el = e.currentTarget as HTMLElement;
      el.style.opacity = "0.4";
      // Defer adding the class so the browser snapshot doesn't include it
      requestAnimationFrame(() => {
        el.classList.add("dragging");
      });
    },
    [editable]
  );

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = "1";
    el.classList.remove("dragging");
    dragIndexRef.current = null;
    dragOverIndexRef.current = null;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const dragIdx = dragIndexRef.current;
      if (dragIdx === null || dragIdx === index) return;

      // Prevent jitter — only reorder when crossing into a new slot
      if (dragOverIndexRef.current === index) return;
      dragOverIndexRef.current = index;

      const reordered = [...statuses];
      const [moved] = reordered.splice(dragIdx, 1);
      if (moved) {
        reordered.splice(index, 0, moved);
      }
      dragIndexRef.current = index;
      onReorder(reordered);
    },
    [statuses, onReorder]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  if (statuses.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {statuses.map((status, i) => (
        <div
          key={status}
          draggable={editable}
          onDragStart={(e) => handleDragStart(e, i)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, i)}
          onDragEnter={handleDragEnter}
          className={`flex w-full select-none items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${getStatusColor(status)} ${
            editable ? "cursor-grab active:cursor-grabbing" : ""
          }`}
        >
          {editable && (
            <GripVertical className="h-4 w-4 flex-shrink-0 cursor-grab text-current opacity-50" />
          )}
          <span className="flex-1 font-medium">{status}</span>
          {editable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(i);
              }}
              className="flex-shrink-0 rounded p-0.5 hover:bg-black/20 transition-colors"
              aria-label={`Remove ${status}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
