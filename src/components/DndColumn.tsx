"use client";

import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import type { SortingStrategy } from "@dnd-kit/sortable";
import type { KanbanColumn, KanbanTask } from "@/types/KanbanModels";
import { TASK_TYPE_COLORS, TaskType } from "@/types/TaskType";
import TaskCard from "./TaskCard";

/**
 * The "gap" during a drag is drawn by the ghost card rendered inline in the
 * target column, so dnd-kit's transform-based gaps must be disabled — otherwise
 * the strategy would also shift cards and duplicate the visual.
 */
const noTransformStrategy: SortingStrategy = () => ({ x: 0, y: 0, scaleX: 1, scaleY: 1 });

/**
 * The dragged task rendered in place, dimmed and dashed, marking the drop slot.
 * This is the single "ghost" — it lives in whichever column the cursor is over
 * (or back in the original list when the cursor leaves every column).
 */
function GhostCard({
  task,
  typeNames,
}: {
  task: KanbanTask;
  typeNames: Record<string, string>;
}) {
  const typeColor = TASK_TYPE_COLORS[task.type as TaskType] ?? TASK_TYPE_COLORS.None;
  return (
    <div className="pointer-events-none rounded-md border-2 border-dashed border-neutral-400 bg-white/80 p-2 opacity-80 dark:border-neutral-500 dark:bg-neutral-700/80">
      <div className="flex gap-1">
        <div className="w-1.5 shrink-0 rounded-l-md" style={{ backgroundColor: typeColor }} />
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-sm font-bold"
            style={{ textDecoration: task.isComplete ? "line-through" : "none" }}
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
          <span
            className="mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-semibold text-white"
            style={{ backgroundColor: typeColor }}
          >
            {typeNames[task.type] ?? task.type}
          </span>
        </div>
      </div>
    </div>
  );
}

interface DndColumnProps {
  col: KanbanColumn;
  tasks: KanbanTask[];
  typeNames: Record<string, string>;
  onAddTask: () => void;
  onEditTask: (task: KanbanTask) => void;
  onDeleteTask: (task: KanbanTask) => void;
  onMarkComplete: (task: KanbanTask) => void;
  onDeleteColumn: () => void;
  onEmptyQueue: () => void;
  /** The task being dragged, if any. */
  draggedTask?: KanbanTask | null;
  /** The column the dragged task is currently hovering over as a drop target. */
  ghostColumnId?: number | null;
  /** Insert index (into the column's task list) where the dragged task would land. */
  ghostIndex?: number | null;
  /** Registers this column's task-list element so the board can measure card rects. */
  setTaskListEl?: (el: HTMLElement | null) => void;
}

export function DndColumn({
  col,
  tasks,
  typeNames,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onMarkComplete,
  onDeleteColumn,
  onEmptyQueue,
  draggedTask = null,
  ghostColumnId = null,
  ghostIndex = null,
  setTaskListEl,
}: DndColumnProps) {
  const { setNodeRef } = useDroppable({ id: col.id });

  const isDeleted = col.name === "Deleted Tasks";
  const canAdd = col.name !== "Done" && !isDeleted;

  /**
   * The list of card ids this column renders, in order.
   *
   * While a drag is in progress the dragged card is the *single* in-flow ghost,
   * so it must appear in exactly one place:
   *  - target column (ghostColumnId === this column): the card is removed from
   *    wherever it was (possibly this same column) and inserted at the hovered
   *    index, so the ghost sits exactly where it will drop;
   *  - any other column that previously held it: it is removed (the card has
   *    visibly left);
   *  - when the cursor is not over any column (ghostColumnId == null): the card
   *    stays in its original list, rendering back at its original slot.
   *
   * The removal-then-insert dance mirrors the drop semantics in
   * moveTaskToColumnAtPosition (the source slot is vacated before the target
   * index is applied), so same-column downward moves "just work" — inserting at
   * the pointer index into the shortened list lands the card after the card it
   * used to precede. No extra off-by-one compensation is needed here.
   */
  const ids = useMemo(() => {
    const list = tasks.map((t) => t.id);
    if (draggedTask == null) return list;
    if (ghostColumnId === col.id) {
      // Drop target: remove the card from its old spot (if this is its column)
      // and insert it at the hovered index.
      const without = list.filter((id) => id !== draggedTask.id);
      const idx = ghostIndex == null
        ? without.length
        : Math.max(0, Math.min(ghostIndex, without.length));
      without.splice(idx, 0, draggedTask.id);
      return without;
    }
    if (list.includes(draggedTask.id) && ghostColumnId != null) {
      // Source column, and the ghost is docked in another column: card has left.
      return list.filter((id) => id !== draggedTask.id);
    }
    return list;
  }, [tasks, draggedTask, ghostColumnId, ghostIndex, col.id]);

  return (
    <div
      ref={setNodeRef}
      className="flex h-full w-72 shrink-0 flex-col rounded-lg bg-neutral-200/70 dark:bg-neutral-800/70"
    >
      {/* Column header */}
      <div className="flex items-center justify-between gap-2 rounded-t-lg bg-neutral-200 px-3 py-2 dark:bg-neutral-800">
        <span className="text-base font-bold">{col.name}</span>
        <div className="flex items-center gap-1">
          {canAdd && (
            <button
              onClick={onAddTask}
              className="rounded bg-transparent px-2 py-0.5 text-xs font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-700"
            >
              + Add Task
            </button>
          )}
          {isDeleted && (
            <button
              onClick={onEmptyQueue}
              className="rounded bg-red-500 px-2 py-0.5 text-xs font-semibold text-white hover:bg-red-600"
            >
              Empty Queue
            </button>
          )}
        </div>
      </div>

      {/* Task list */}
      <div
        ref={setTaskListEl}
        className="board-scroll flex-1 space-y-2 overflow-y-auto p-2"
      >
        {ids.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 p-4 text-center text-xs text-neutral-400 dark:border-neutral-700">
            No tasks
          </div>
        ) : (
          <SortableContext items={ids} strategy={noTransformStrategy}>
            {ids.map((id) => {
              if (id === draggedTask?.id) {
                return <GhostCard key={id} task={draggedTask} typeNames={typeNames} />;
              }
              const task = tasks.find((t) => t.id === id);
              if (!task) return null;
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  typeNames={typeNames}
                  onEdit={() => onEditTask(task)}
                  onDelete={() => onDeleteTask(task)}
                  onComplete={() => onMarkComplete(task)}
                />
              );
            })}
          </SortableContext>
        )}
      </div>
    </div>
  );
}