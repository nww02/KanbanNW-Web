"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { KanbanTask } from "@/types/KanbanModels";
import { TASK_TYPE_COLORS, TaskType } from "@/types/TaskType";

/**
 * Due-date urgency as a background colour + whether to show the chip:
 *  - past due  → red (#EF5350)
 *  - due within `estimatedDays` of today → orange (#FFA726)
 *  - otherwise → green (#66BB6A)
 * No dueDate means no chip at all.
 */
function dueDateStyle(task: KanbanTask): { bg: string; show: boolean } {
  if (!task.dueDate) return { bg: "transparent", show: false };
  const now = Date.now();
  const due = new Date(task.dueDate).getTime();
  const estimatedEnd = now + task.estimatedDays * 24 * 60 * 60 * 1000;
  if (due < now) return { bg: "#EF5350", show: true }; // overdue red
  if (due <= estimatedEnd) return { bg: "#FFA726", show: true }; // orange
  return { bg: "#66BB6A", show: true }; // green
}

/** Human-readable due-date label for the chip, e.g. "Due: 3 Nov 2026". */
function dueDateText(task: KanbanTask): string {
  if (!task.dueDate) return "";
  const d = new Date(task.dueDate);
  return `Due: ${d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`;
}

export default function TaskCard({
  task,
  typeNames,
  onEdit,
  onDelete,
  onComplete,
}: {
  task: KanbanTask;
  typeNames: Record<string, string>;
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
}) {
  // dnd-kit sortable wiring: the card is both a drag source (listeners) and a
// droppable slot (setNodeRef). While the drag overlay handles the floating
// copy, the card itself is dimmed to signal it has been picked up.
const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const typeColor = TASK_TYPE_COLORS[task.type as TaskType] ?? TASK_TYPE_COLORS.None;
  const dueStyle = dueDateStyle(task);

  return (
    <div
      ref={setNodeRef}
      data-task-card="true"
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-md border border-neutral-300 bg-white shadow-sm active:cursor-grabbing dark:border-neutral-600 dark:bg-neutral-700"
    >
      <div className="flex gap-1">
        {/* type strip */}
        <div className="w-1.5 rounded-l-md" style={{ backgroundColor: typeColor }} />
        <div className="flex-1 p-2">
          <div
            className="text-sm font-bold"
            style={{
              textDecoration: task.isComplete ? "line-through" : "none",
              color: task.isComplete ? "#999" : undefined,
            }}
          >
            {task.title}
          </div>
          {task.description && (
            <div className="mt-0.5 line-clamp-2 text-xs text-neutral-600 dark:text-neutral-300">
              {task.description.length > 80
                ? `${task.description.slice(0, 80)}…`
                : task.description}
            </div>
          )}
          {dueStyle.show && (
            <span
              className="mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: dueStyle.bg }}
            >
              {dueDateText(task)}
            </span>
          )}
          <div className="mt-1.5 flex items-center justify-between">
            <span
              className="rounded px-1.5 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: typeColor }}
            >
              {typeNames[task.type] ?? task.type}
            </span>
            <div className="flex gap-0.5 text-xs">
              {!task.isComplete && (
                <button
                  title="Mark as complete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onComplete();
                  }}
                  className="rounded bg-green-100 px-1.5 py-0.5 hover:bg-green-200 dark:bg-green-900/50 dark:hover:bg-green-800"
                >
                  ✓
                </button>
              )}
              <button
                title="Edit"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="rounded px-1.5 py-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-600"
              >
                ✎
              </button>
              <button
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="rounded px-1.5 py-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}