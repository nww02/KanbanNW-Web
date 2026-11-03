"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { SortingStrategy } from "@dnd-kit/sortable";
import type { KanbanColumn, KanbanTask } from "@/types/KanbanModels";
import TaskCard from "./TaskCard";

type StrategyArgs = Parameters<SortingStrategy>[0];

/**
 * Sorting strategy that also opens a drop gap when the dragged card comes from
 * ANOTHER column (cross-column). dnd-kit's built-in verticalListSortingStrategy
 * only opens a gap while `over` is within the active card's own column: its
 * `overIndex` is `items.indexOf(over.id)`, which is -1 for cards in other
 * columns, so no card there ever shifts and no gap appears.
 *
 * This strategy augments that: for any column whose items do NOT contain the
 * dragged card (i.e. it's arriving from another column), when a card in this
 * column is hovered (`overIndex` valid), every card from that index down is
 * pushed down by the dragged card's height, opening the drop gap.
 */
export function containerAwareStrategy(
  draggedId: number | null,
  ownTaskIds: number[],
): SortingStrategy {
  return (args: StrategyArgs) => {
    if (draggedId == null || ownTaskIds.includes(draggedId)) {
      // Active card lives in this column (or nothing is being dragged):
      // keep the default same-column behavior exactly.
      return verticalListSortingStrategy(args);
    }

    const { activeNodeRect, index, overIndex } = args;
    if (overIndex === -1) return { x: 0, y: 0, scaleX: 1, scaleY: 1 };

    // The dragged card is incoming from another column: its own rect is not in
    // this column's `rects` (which only contains this column's cards), so use
    // the measured active rect for the gap size.
    const gapHeight = activeNodeRect?.height ?? 0;
    if (!gapHeight) return { x: 0, y: 0, scaleX: 1, scaleY: 1 };

    // Push every card from the insert index down to make room for the incoming
    // card, matching how verticalListSortingStrategy opens a gap within a column.
    return {
      x: 0,
      y: index >= overIndex ? gapHeight : 0,
      scaleX: 1,
      scaleY: 1,
    };
  };
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
  /** Ids of the currently dragged task, or null when idle. */
  draggedTaskId?: number | null;
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
  draggedTaskId = null,
}: DndColumnProps) {
  const { setNodeRef } = useDroppable({ id: col.id });

  const isDeleted = col.name === "Deleted Tasks";
  const canAdd = col.name !== "Done" && !isDeleted;

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
      <div className="board-scroll flex-1 space-y-2 overflow-y-auto p-2">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={containerAwareStrategy(draggedTaskId, tasks.map((t) => t.id))}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              typeNames={typeNames}
              onEdit={() => onEditTask(task)}
              onDelete={() => onDeleteTask(task)}
              onComplete={() => onMarkComplete(task)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="rounded-md border border-dashed border-neutral-300 p-4 text-center text-xs text-neutral-400 dark:border-neutral-700">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}