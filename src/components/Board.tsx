"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  rectIntersection,
  useSensor,
  useSensors,
  type ClientRect,
  type Collision,
  type CollisionDetection,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
  type DroppableContainer,
  type UniqueIdentifier,
} from "@dnd-kit/core";

import {
  getProjects,
  getColumnsForProject,
  getTasksForColumn,
  getSetting,
  setSetting,
  getProject,
  getDoneColumn,
  moveTaskToDeletedColumn,
  emptyDeletedColumn,
  deleteColumn,
  updateTask,
  getTaskTypeNames,
  moveTaskToColumnAtPosition,
  getTaskById,
  exportStoreJson,
  importStoreJson,
} from "@/lib/store";
import type { KanbanColumn, KanbanProject, KanbanTask } from "@/types/KanbanModels";

import { DndColumn } from "./DndColumn";
import ConfirmDialog from "./ConfirmDialog";
import TaskEditorModal from "./TaskEditorModal";
import CategoriesDialog from "./dialogs/CategoriesDialog";
import ColumnsDialog from "./dialogs/ColumnsDialog";
import ProjectsDialog from "./dialogs/ProjectsDialog";
import AppearanceDialog from "./dialogs/AppearanceDialog";
import HelpDialog from "./dialogs/HelpDialog";
import AboutDialog from "./dialogs/AboutDialog";
import { buildProjectCsv, downloadTextFile, canUseSaveDialog } from "@/lib/csv";

// ─── helpers ──────────────────────────────────────────────────────────────

export function contrastText(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#FFFFFF";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 128 ? "#FFFFFF" : "#000000";
}

export const FONT_PRESETS = ["Small", "Medium", "Large"] as const;

/** Apply the persisted theme (System/Light/Dark) to <html>: System follows the
 *  OS live; Light/Dark override it. */
function applyTheme(theme: string) {
  const dark =
    theme === "Dark" ||
    (theme === "System" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Apply font-size preset + theme. Font scaling works by setting a
 *  `data-font-size` attribute that Tailwind's size theme-vars resolve through
 *  (see globals.css), so every font in the app scales at once. */
export function applyAppearance() {
  const font = getSetting("fontPreset", "Medium") ?? "Medium";
  // CSS attribute selectors are case-sensitive, so store the value lowercase
  // to match the :root[data-font-size="small"|"large"] rules in globals.css.
  document.documentElement.dataset.fontSize =
    (FONT_PRESETS.includes(font as (typeof FONT_PRESETS)[number]) ? font : "Medium").toLowerCase();
  applyTheme(getSetting("theme", "System") ?? "System");
}

export type DialogName =
  | "task"
  | "confirm"
  | "filename"
  | "categories"
  | "columns"
  | "projects"
  | "appearance"
  | "help"
  | "about";

interface DialogState {
  name: DialogName;
  task?: KanbanTask;
  columnId?: number;
  confirmMessage?: string;
  onConfirm?: () => void;
  /** Filename dialog: pre-filled name and the handler that receives the name. */
  initialFilename?: string;
  onFilename?: (fileName: string) => void;
}

/** Reads a File (from the file picker) as text. */
function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsText(file);
  });
}

/** Current moment as "yyyymmdd-hhmm", e.g. "20261103-1430". */
function timestampStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/**
 * rectIntersection, plus end of list snapping. When the dragged card sits in a
 * column's empty space below its last card (or above its first card) it overlaps
 * no card — only the column body — so `over` becomes the column. The sortable
 * strategy needs an item id to draw the drop gap, so with `over` = column the
 * ghost jumps back to the card's original slot. Snapping `over` back to the
 * last/first card keeps the gap visible at the end/start of the list; the drop
 * handlers already map "over = last card" to an append, so this only fixes the
 * visuals.
 */
function columnSnapIntersection(
  args: Parameters<CollisionDetection>[0],
): Collision[] {
  const base = rectIntersection(args);
  const top = base[0];
  if (!top) return base;

  // Cards carry sortable context data; column droppables carry none. A top
  // collision on a card is already the correct target.
  const container = (top.data as Collision["data"] & {
    droppableContainer?: DroppableContainer;
  })?.droppableContainer;
  if (container?.data?.current?.sortable) return base;

  const columnRect = args.droppableRects.get(top.id);
  if (!columnRect || !args.collisionRect) return base;

  // Cards physically inside this column's x-range, ordered top → bottom.
  const cards: { id: UniqueIdentifier; rect: ClientRect }[] = [];
  for (const c of args.droppableContainers) {
    const r = args.droppableRects.get(c.id);
    if (r && r.left >= columnRect.left && r.right <= columnRect.right) {
      cards.push({ id: c.id, rect: r });
    }
  }
  if (cards.length === 0) return base;

  cards.sort((a, b) => a.rect.top - b.rect.top);
  const first = cards[0];
  const last = cards[cards.length - 1];

  if (args.collisionRect.top >= last.rect.bottom - 1) {
    return [{ id: last.id, data: { value: 1 } }];
  }
  if (args.collisionRect.bottom <= first.rect.top + 1) {
    return [{ id: first.id, data: { value: 1 } }];
  }
  return base;
}

export default function Board() {
  const [projects, setProjects] = useState<KanbanProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<number>(-1);
  const [showDeleted, setShowDeleted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [typeNames, setTypeNames] = useState<Record<string, string>>({});

  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [tasksByColumn, setTasksByColumn] = useState<Record<number, KanbanTask[]>>({});

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [activeDragTask, setActiveDragTask] = useState<KanbanTask | null>(null);

  // ── load / refresh ────────────────────────────────────────────────────────

  // Apply appearance (theme + font size) as early as possible, then once loaded.
  useEffect(() => {
    applyAppearance();
  }, []);

  // In System mode, follow the OS theme live.
  useEffect(() => {
    if ((getSetting("theme", "System") ?? "System") !== "System") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const loaded = getProjects();
    setProjects(loaded);
    if (loaded.length > 0 && currentProjectId < 0) setCurrentProjectId(loaded[0].id);
    setTypeNames(getTaskTypeNames());
  }, [currentProjectId]);

  /** Loads the projects list and the given project's columns/tasks into state. */
  const loadBoard = useCallback(
    (pid: number) => {
      setProjects(getProjects());
      setTypeNames(getTaskTypeNames());

      if (pid <= 0) {
        setColumns([]);
        setTasksByColumn({});
        return;
      }
      const cols = getColumnsForProject(pid);
      const visible = showDeleted ? cols : cols.filter((c) => c.order !== 1000);
      setColumns(visible);

      const map: Record<number, KanbanTask[]> = {};
      for (const c of visible) map[c.id] = getTasksForColumn(c.id);
      setTasksByColumn(map);
    },
    [showDeleted],
  );

  const refreshBoard = useCallback(() => {
    loadBoard(currentProjectId);
  }, [loadBoard, currentProjectId]);

  useEffect(() => {
    refreshBoard();
  }, [refreshBoard]);

  // ── drag & drop ──────────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [ghost, setGhost] = useState<{ columnId: number; index: number } | null>(null);

  const onDragStart = (e: DragStartEvent) => {
    const task = getTaskById(Number(e.active.id));
    if (task) setActiveDragTask(task);
  };

  /**
   * Where would the dragged task land?
   *
   * The index is keyed off the pointer's Y position against the target column's
   * card midpoints — deliberately NOT dnd-kit's `over`, which snaps to the
   * column (or nearest card) too readily and made the old ghost marker stick to
   * the bottom of the list. Returns { columnId, index } where `index` is the
   * insert position into that column's task list, or null when the pointer isn't
   * over a valid target column.
   *
   * This single function drives BOTH the in-flow ghost position (rendered live
   * during onDragMove) and the actual drop (in onDragEnd), so the ghost and the
   * final position always agree.
   */
  const taskListEls = useRef<Record<number, HTMLElement | null>>({});

  /** Registers a column's task-list element so computeGhost can measure its cards. */
  const setTaskListEl = (columnId: number) => (el: HTMLElement | null) => {
    taskListEls.current[columnId] = el;
  };

  const computeGhost = (activeId: number, overId: number, pointerY: number) => {
    // If `over` is a column itself (header/body), target it directly.
    const colId = columns.some((c) => c.id === overId)
      ? (overId as number)
      : getTaskById(overId)?.columnId;
    if (colId == null) return null;

    const colTasks = getTasksForColumn(colId);
    const listEl = taskListEls.current[colId];
    if (!listEl) {
      // No measured list (e.g. empty column): the marker goes at the top.
      return { columnId: colId, index: 0 };
    }
    // Where is the pointer relative to the top of the list? If the list has
    // `space-y-2`, we need the midpoints of the cards. Find the card whose
    // vertical midpoint the pointer is above (first such card = insert before it).
    const cards = Array.from(listEl.querySelectorAll<HTMLElement>(
      "[data-task-card]",
    ));
    const listRect = listEl.getBoundingClientRect();
    const relY = pointerY - listRect.top;
    let index = colTasks.length; // default: append at end
    // Walk the cards; when the pointer is above a card's midpoint, insert before it.
    for (let i = 0; i < cards.length; i++) {
      const cardRect = cards[i].getBoundingClientRect();
      const midY = cardRect.top - listRect.top + cardRect.height / 2;
      if (relY < midY) {
        index = i;
        break;
      }
    }
    return { columnId: colId, index };
  };

  const onDragMove = (e: DragMoveEvent) => {
    // Pointer not over any droppable (menubar, gap between columns, …): clear
    // the ghost so it visually returns to its original slot in its source column.
    if (!e.over) {
      setGhost(null);
      return;
    }
    const activeId = Number(e.active.id);
    const overId = Number(e.over.id);
    // Live pointer Y = the Y where the drag started (activatorEvent) plus the
    // cumulative drag delta. dnd-kit exposes the delta, not the live cursor, so
    // this is the only reliable way to get the current pointer position.
    const startY =
      (e.activatorEvent as PointerEvent).clientY ??
      (e.activatorEvent as MouseEvent).clientY;
    const pointerY = startY + e.delta.y;
    setGhost(computeGhost(activeId, overId, pointerY));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveDragTask(null);
    setGhost(null);
    if (!over) return;

    const activeId = Number(active.id);
    const overId = Number(over.id);
    const task = getTaskById(activeId);
    if (!task) return;

    // Use the same pointer-based insert index as the ghost marker, so the drop
    // lands exactly where the marker is shown.
    const startY =
      (e.activatorEvent as PointerEvent).clientY ??
      (e.activatorEvent as MouseEvent).clientY;
    const pointerY = startY + e.delta.y;
    const target = computeGhost(activeId, overId, pointerY);
    if (!target) return;
    // NOTE: moveTaskToColumnAtPosition itself adjusts for same-column downward
    // moves (it splices the task out first, then decrements the index), so the
    // raw pointer-based index is exactly right to pass through.
    moveTaskToColumnAtPosition(task.id, target.columnId, target.index);
    refreshBoard();
  };

  const onDragCancel = () => {
    setActiveDragTask(null);
    setGhost(null);
  };

  // ── task actions ─────────────────────────────────────────────────────────

  const openTaskEditor = (task?: KanbanTask, columnId?: number) => {
    setDialog({ name: "task", task, columnId });
  };

  const saveTaskFromEditor = (task: KanbanTask) => {
    updateTask(task);
    refreshBoard();
  };

  /**
 * Mark a task done: move it into the (system) "Done" column and append it to
 * the end of that column's list.
 */
const markComplete = (task: KanbanTask) => {
    const doneCol = getDoneColumn(currentProjectId);
    if (!doneCol) return;
    const updated: KanbanTask = {
      ...task,
      isComplete: true,
      columnId: doneCol.id,
      // Append at the end — order is the max existing order (store renumbers).
      order: getTasksForColumn(doneCol.id).length,
    };
    updateTask(updated);
    refreshBoard();
  };

  /** Ask for confirmation, then soft-delete a task (moves it to the Deleted Tasks queue). */
const requestDeleteTask = (task: KanbanTask) => {
    setDialog({
      name: "confirm",
      confirmMessage: `Are you sure you want to delete task "${task.title}"? It will be moved to the Deleted Tasks queue.`,
      onConfirm: () => {
        moveTaskToDeletedColumn(task.id, currentProjectId);
        refreshBoard();
      },
    });
  };

  /** Ask for confirmation, then delete a user column (its tasks move to In Tray). */
  const requestDeleteColumn = (col: KanbanColumn) => {
    if (col.isSystem) return; // system columns (In Tray/Done/Deleted) can't be removed
    setDialog({
      name: "confirm",
      confirmMessage: `Are you sure you want to delete the column "${col.name}"? All tasks will be moved to In Tray.`,
      onConfirm: () => {
        deleteColumn(col.id);
        refreshBoard();
      },
    });
  };

  /** Ask for confirmation, then permanently empty the Deleted Tasks queue. */
  const requestEmptyQueue = () => {
    setDialog({
      name: "confirm",
      confirmMessage: "Permanently delete all tasks in the Deleted Tasks queue?",
      onConfirm: () => {
        emptyDeletedColumn(currentProjectId);
        refreshBoard();
      },
    });
  };

  // ── config actions ───────────────────────────────────────────────────────

  /** Export the current project's tasks (with comments) as a CSV, named after the project. */
const exportCsv = () => {
    const cols = getColumnsForProject(currentProjectId);
    const allTasks = cols.flatMap((c) => getTasksForColumn(c.id));
    const nameOf = (cid: number) => cols.find((c) => c.id === cid)?.name ?? `Column ${cid}`;
    const csv = buildProjectCsv(allTasks, nameOf);
    const project = getProject(currentProjectId);
    const slug = (project?.name ?? "Project").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
    exportFileWithNameDialog(`${slug || "project"}-tasks.csv`, csv);
  };

  /** Export the whole workspace (all projects/columns/tasks/comments/settings) as a .kan backup. */
  const exportAllProjects = () => {
    exportFileWithNameDialog(`Kanban-Workspace-${timestampStamp()}.kan`, exportStoreJson(), "application/json");
  };

  /**
   * Saves `content` under `defaultName`: a real native Save dialog when the
   * browser supports one (pre-filled with the name), otherwise a small in-app
   * filename dialog so the user can still rename the file before it downloads.
   */
  const exportFileWithNameDialog = (defaultName: string, content: string, mimeType = "text/csv") => {
    if (canUseSaveDialog()) {
      downloadTextFile(defaultName, content, mimeType);
      return;
    }
    setDialog({
      name: "filename",
      initialFilename: defaultName,
      onFilename: (name) => {
        downloadTextFile(name || defaultName, content, mimeType);
      },
    });
  };

  const requestImportExportedProjects = () => {
    setDialog({
      name: "confirm",
      confirmMessage:
        "Importing will clear all current projects and data in this browser, then rebuild the workspace from the selected .kan file. Continue?",
      onConfirm: () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".kan,application/json,.json";
        input.style.display = "none";
        document.body.appendChild(input);
        input.onchange = async () => {
          const file = input.files?.[0];
          input.remove();
          if (!file) return;
          try {
            const text = await readTextFile(file);
            if (!importStoreJson(text)) {
              alert(`"${file.name}" does not look like a Kanban export. Nothing was changed.`);
              return;
            }
            // Rebuild the whole view from the imported store.
            const pid = getProjects()[0]?.id ?? -1;
            applyAppearance();
            setCurrentProjectId(pid);
            loadBoard(pid);
          } catch {
            alert(`Could not read "${file.name}". Nothing was changed.`);
          }
        };
        input.click();
      },
    });
  };

  /** Wipe every key in localStorage and reload — the "Reset All Data" action. */
const restartApp = () => {
    localStorage.clear();
    location.reload();
  };

  /**
   * Quick Light/Dark toggle in the app (separate from the Appearance dialog's
   * System option). Turns the persisted theme into an explicit Light/Dark choice,
   * which disables OS live-following until the user picks "System" again.
   */
  const toggleTheme = () => {
    const next = isDark ? "Light" : "Dark";
    setSetting("theme", next);
    applyTheme(next);
    setIsDark(!isDark);
  };

  return (
    <div>
      <div className="flex h-screen flex-col bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
        {/* ── Menubar ── */}
        <div className="flex items-center border-b border-neutral-300 bg-neutral-200 px-1 text-sm dark:border-neutral-800 dark:bg-neutral-800">
          <Menu label="Kanban">
            <SubMenu label="Export">
              <MenuItem onClick={exportCsv}>Project to CSV</MenuItem>
              <MenuItem onClick={exportAllProjects}>All Projects</MenuItem>
            </SubMenu>
            <SubMenu label="Import">
              <MenuItem onClick={requestImportExportedProjects}>Exported Projects</MenuItem>
            </SubMenu>
            <Divider />
            <MenuItem
              onClick={() =>
                setDialog({
                  name: "confirm",
                  confirmMessage:
                    "Reset all data? This will wipe everything stored in this browser.",
                  onConfirm: restartApp,
                })
              }
            >
              Reset All Data…
            </MenuItem>
          </Menu>
          <Menu label="Config">
            <MenuItem onClick={() => setDialog({ name: "categories" })}>Categories…</MenuItem>
            <MenuItem onClick={() => setDialog({ name: "columns" })}>Columns…</MenuItem>
            <MenuItem onClick={() => setDialog({ name: "projects" })}>Projects…</MenuItem>
            <MenuItem checkable checked={showDeleted} onToggle={() => setShowDeleted((v) => !v)}>
              Show Deleted
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => setDialog({ name: "appearance" })}>Appearance…</MenuItem>
          </Menu>
          <div className="ml-auto" />
          <Menu label="Help">
            <MenuItem onClick={() => setDialog({ name: "help" })}>Help</MenuItem>
            <Divider />
            <MenuItem onClick={() => setDialog({ name: "about" })}>About</MenuItem>
          </Menu>
        </div>

        {/* ── Project tabs ── */}
        <div className="flex items-end border-b border-neutral-300 bg-neutral-200 px-2 pt-1 dark:border-neutral-800 dark:bg-neutral-800">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setCurrentProjectId(p.id)}
              className="rounded-t-md px-4 py-1.5 text-sm font-semibold"
              style={{
                backgroundColor: p.color,
                color: contrastText(p.color),
                outline: p.id === currentProjectId ? "2px solid currentColor" : "none",
                outlineOffset: "-2px",
              }}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* ── Board ── */}
        <div className="flex-1 overflow-auto p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={columnSnapIntersection}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          >
            <div className="flex h-full items-start gap-4">
              {columns.map((col) => (
                <DndColumn
                  key={col.id}
                  col={col}
                  tasks={tasksByColumn[col.id] ?? []}
                  typeNames={typeNames}
                  draggedTask={activeDragTask}
                  ghostColumnId={ghost?.columnId ?? null}
                  ghostIndex={ghost?.index ?? null}
                  setTaskListEl={setTaskListEl(col.id)}
                  onAddTask={() => openTaskEditor(undefined, col.id)}
                  onEditTask={(t) => openTaskEditor(t)}
                  onDeleteTask={requestDeleteTask}
                  onMarkComplete={markComplete}
                  onDeleteColumn={() => requestDeleteColumn(col)}
                  onEmptyQueue={requestEmptyQueue}
                />
              ))}
            </div>
          </DndContext>
        </div>
      </div>

      {/* ── Dialogs ── */}
      {dialog?.name === "task" && (
        <TaskEditorModal
          task={dialog.task}
          defaultColumnId={dialog.columnId ?? 0}
          projectId={currentProjectId}
          onSave={saveTaskFromEditor}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.name === "confirm" && (
        <ConfirmDialog
          message={dialog.confirmMessage ?? "Are you sure?"}
          onConfirm={() => {
            dialog.onConfirm?.();
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.name === "filename" && (
        <FilenameDialog
          initialFilename={dialog.initialFilename ?? "export.kan"}
          onExport={(fileName) => {
            dialog.onFilename?.(fileName);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.name === "categories" && (
        <CategoriesDialog
          initial={typeNames}
          onSave={() => {
            setTypeNames(getTaskTypeNames());
            refreshBoard();
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.name === "columns" && (
        <ColumnsDialog
          projectId={currentProjectId}
          onClose={() => {
            refreshBoard();
            setDialog(null);
          }}
        />
      )}
      {dialog?.name === "projects" && (
        <ProjectsDialog
          onClose={() => {
            setProjects(getProjects());
            refreshBoard();
            setDialog(null);
          }}
        />
      )}
      {dialog?.name === "appearance" && (
        <AppearanceDialog
          onClose={() => {
            applyAppearance();
            setIsDark(document.documentElement.classList.contains("dark"));
            refreshBoard();
            setDialog(null);
          }}
        />
      )}
      {dialog?.name === "help" && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog?.name === "about" && <AboutDialog onClose={() => setDialog(null)} />}
    </div>
  );
}

// ─── filename dialog (Save dialog fallback for browsers without showSaveFilePicker) ───

function FilenameDialog({
  initialFilename,
  onExport,
  onClose,
}: {
  initialFilename: string;
  onExport: (fileName: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialFilename);

  const submit = () => {
    const clean = name.trim().replace(/[/\\]/g, "");
    onExport(clean || initialFilename);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg bg-white p-4 shadow-2xl dark:bg-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-sm">File Name</div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
          className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 focus:border-blue-500 focus:outline-none dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-1.5 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── menu primitives ──────────────────────────────────────────────────────

/**
 * Top-level menu bar item. The dropdown is shown on hover via Tailwind's
 * `group`/`group-hover` classes (no JS click handling needed).
 */
function Menu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="group relative">
      <button className="rounded px-3 py-1.5 font-medium hover:bg-neutral-300 dark:hover:bg-neutral-700">
        {label}
      </button>
      <div className="invisible absolute left-0 top-full z-50 min-w-52 rounded-md border border-neutral-300 bg-white p-1 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 dark:border-neutral-700 dark:bg-neutral-800">
        {children}
      </div>
    </div>
  );
}

/**
 * A nested hover dropdown inside a Menu — opens to the right (`left-full`)
 * when its parent Menu row is hovered, via `group/sub` + `group-hover/sub`.
 */
function SubMenu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="group/sub relative">
      <div className="flex w-full cursor-default items-center justify-between gap-6 rounded px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700">
        <span>{label}</span>
        <span className="text-xs opacity-60">▶</span>
      </div>
      <div className="invisible absolute left-full top-0 z-50 min-w-52 rounded-md border border-neutral-300 bg-white p-1 opacity-0 shadow-lg transition-opacity group-hover/sub:visible group-hover/sub:opacity-100 dark:border-neutral-700 dark:bg-neutral-800">
        {children}
      </div>
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  checkable,
  checked,
  onToggle,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  checkable?: boolean;
  checked?: boolean;
  onToggle?: () => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
      onClick={() => (checkable ? onToggle?.() : onClick?.())}
    >
      <span className="inline-block w-4 text-center">{checkable ? (checked ? "✓" : "") : null}</span>
      <span>{children}</span>
    </button>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-neutral-300 dark:bg-neutral-700" />;
}