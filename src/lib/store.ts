"use client";

import type { KanbanProject, KanbanColumn, KanbanTask, Comment } from "@/types/KanbanModels";
import { ALL_TASK_TYPES, TaskType } from "@/types/TaskType";

/**
 * Client-side data store backed by localStorage.
 * Replaces the SQLite KanbanDbContext entirely — no server, no network.
 *
 * All mutations persist immediately to localStorage (the whole store is
 * serialized as one JSON blob, which is fine for a personal kanban board).
 */

const STORAGE_KEY = "kanbanweb_store_v1";

interface StoreData {
  projects: KanbanProject[];
  columns: KanbanColumn[];
  tasks: KanbanTask[];
  comments: Comment[];
  settings: Record<string, string>;
  nextId: number; // single sequence for all entity ids
}

const SYSTEM_COLUMN_ORDER = {
  InTray: 0,
  Done: 999,
  Deleted: 1000,
} as const;

function emptyStore(): StoreData {
  return {
    projects: [],
    columns: [],
    tasks: [],
    comments: [],
    settings: {},
    nextId: 1,
  };
}

function loadStore(): StoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoreData;
      if (parsed && Array.isArray(parsed.projects)) return parsed;
    }
  } catch {
    // corrupt storage — start fresh
  }
  return emptyStore();
}

// ─── Singleton store ──────────────────────────────────────────────────────

let _store: StoreData | null = null;

function getStore(): StoreData {
  if (_store === null) {
    _store = loadStore();
    if (_store.projects.length === 0) {
      seed(_store);
      persist();
    }
  }
  return _store;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_store));
  } catch {
    // storage full or unavailable — log and continue (in-memory still works)
    console.warn("KanbanWeb: failed to persist to localStorage");
  }
}

function nextId(): number {
  return getStore().nextId++;
}

// ─── Seeding ──────────────────────────────────────────────────────────────

function seed(s: StoreData) {
  const pid = s.nextId++;
  s.projects.push({ id: pid, name: "Default", color: "#2C3E50" });
  seedProjectColumns(s, pid);
  for (const t of ALL_TASK_TYPES) {
    s.settings[`TaskTypeName_${t}`] = t;
  }
}

function seedProjectColumns(s: StoreData, projectId: number) {
  const mk = (name: string, order: number): KanbanColumn => ({
    id: s.nextId++,
    name,
    order,
    isSystem: true,
    projectId,
  });
  s.columns.push(mk("In Tray", SYSTEM_COLUMN_ORDER.InTray));
  s.columns.push(mk("Done", SYSTEM_COLUMN_ORDER.Done));
  s.columns.push(mk("Deleted Tasks", SYSTEM_COLUMN_ORDER.Deleted));
}

// ─── Projects ─────────────────────────────────────────────────────────────

export function getProjects(): KanbanProject[] {
  return [...getStore().projects].sort((a, b) => a.id - b.id);
}

export function getProject(id: number): KanbanProject | null {
  return getStore().projects.find((p) => p.id === id) ?? null;
}

export function createProject(name: string): number {
  const s = getStore();
  const pid = s.nextId++;
  s.projects.push({ id: pid, name, color: "#2C3E50" });
  seedProjectColumns(s, pid);
  persist();
  return pid;
}

export function updateProject(id: number, name: string, color: string) {
  const s = getStore();
  const p = s.projects.find((x) => x.id === id);
  if (!p) return;
  p.name = name;
  p.color = color;
  persist();
}

export function deleteProject(id: number) {
  const s = getStore();
  if (s.projects.length <= 1) return; // never delete the last project
  s.projects = s.projects.filter((p) => p.id !== id);
  const deletedColumnIds = new Set(
    s.columns.filter((c) => c.projectId === id).map((c) => c.id),
  );
  s.columns = s.columns.filter((c) => c.projectId !== id);
  s.tasks = s.tasks.filter((t) => !deletedColumnIds.has(t.columnId));
  s.comments = s.comments.filter((c) => !deletedColumnIds.has(c.taskId));
  persist();
}

// ─── Columns ──────────────────────────────────────────────────────────────

export function getColumnsForProject(projectId: number): KanbanColumn[] {
  return getStore()
    .columns.filter((c) => c.projectId === projectId)
    .sort((a, b) => a.order - b.order);
}

export function createColumn(name: string, projectId: number): number {
  const s = getStore();
  const maxOrder = Math.max(
    0,
    ...s.columns
      .filter((c) => c.projectId === projectId && c.order < SYSTEM_COLUMN_ORDER.Done)
      .map((c) => c.order),
  );
  const col: KanbanColumn = {
    id: s.nextId++,
    name,
    order: maxOrder + 1,
    isSystem: false,
    projectId,
  };
  s.columns.push(col);
  persist();
  return col.id;
}

export function renameColumn(id: number, name: string) {
  const s = getStore();
  const c = s.columns.find((x) => x.id === id && !x.isSystem);
  if (!c) return;
  c.name = name;
  persist();
}

export function deleteColumn(id: number) {
  const s = getStore();
  const c = s.columns.find((x) => x.id === id && !x.isSystem);
  if (!c) return;
  s.columns = s.columns.filter((x) => x.id !== id);
  // move tasks to In Tray
  const inTray = s.columns.find(
    (x) => x.projectId === c.projectId && x.order === SYSTEM_COLUMN_ORDER.InTray,
  );
  if (inTray) {
    const colTasks = s.tasks.filter((t) => t.columnId === id);
    let nextOrder = Math.max(0, ...s.tasks.filter((t) => t.columnId === inTray.id).map((t) => t.order)) + 1;
    for (const t of colTasks) {
      t.columnId = inTray.id;
      t.order = nextOrder++;
    }
  } else {
    s.tasks = s.tasks.filter((t) => t.columnId !== id);
  }
  persist();
}

export function getInTrayColumn(projectId: number): KanbanColumn | null {
  return (
    getStore().columns.find(
      (c) => c.projectId === projectId && c.order === SYSTEM_COLUMN_ORDER.InTray,
    ) ?? null
  );
}

export function getDoneColumn(projectId: number): KanbanColumn | null {
  return (
    getStore().columns.find(
      (c) => c.projectId === projectId && c.order === SYSTEM_COLUMN_ORDER.Done,
    ) ?? null
  );
}

function getOrCreateDeletedColumn(projectId: number): KanbanColumn {
  const s = getStore();
  let col = s.columns.find(
    (c) => c.projectId === projectId && c.order === SYSTEM_COLUMN_ORDER.Deleted,
  );
  if (!col) {
    col = {
      id: s.nextId++,
      name: "Deleted Tasks",
      order: SYSTEM_COLUMN_ORDER.Deleted,
      isSystem: true,
      projectId,
    };
    s.columns.push(col);
    // note: not persisted until the caller performs an actual mutation
  }
  return col;
}

// ─── Tasks ────────────────────────────────────────────────────────────────

export function getTasksForColumn(columnId: number): KanbanTask[] {
  return getStore()
    .tasks.filter((t) => t.columnId === columnId)
    .sort((a, b) => a.order - b.order);
}

export function getTaskById(id: number): KanbanTask | null {
  return getStore().tasks.find((t) => t.id === id) ?? null;
}

export function createTask(task: Omit<KanbanTask, "id" | "order">): KanbanTask {
  const s = getStore();
  const maxOrder = Math.max(
    0,
    ...s.tasks.filter((t) => t.columnId === task.columnId).map((t) => t.order),
  );
  const full: KanbanTask = { ...task, id: s.nextId++, order: maxOrder + 1 };
  s.tasks.push(full);
  persist();
  return full;
}

export function updateTask(task: KanbanTask) {
  const s = getStore();
  const i = s.tasks.findIndex((t) => t.id === task.id);
  if (i === -1) return;
  s.tasks[i] = task;
  persist();
}

export function moveTaskToColumn(taskId: number, columnId: number, order: number) {
  const s = getStore();
  const t = s.tasks.find((x) => x.id === taskId);
  if (!t) return;
  t.columnId = columnId;
  t.order = order;
  persist();
}

export function moveTaskToDeletedColumn(taskId: number, projectId: number) {
  const s = getStore();
  const deleted = getOrCreateDeletedColumn(projectId);
  const maxOrder = Math.max(
    0,
    ...s.tasks.filter((t) => t.columnId === deleted.id).map((t) => t.order),
  );
  const t = s.tasks.find((x) => x.id === taskId);
  if (!t) return;
  t.columnId = deleted.id;
  t.order = maxOrder + 1;
  t.isComplete = false;
  persist();
}

export function emptyDeletedColumn(projectId: number) {
  const s = getStore();
  const deleted = getOrCreateDeletedColumn(projectId);
  s.tasks = s.tasks.filter((t) => t.columnId !== deleted.id);
  s.comments = s.comments.filter((c) => getTaskById(c.taskId) !== null);
  persist();
}

/**
 * Moves a task to a column at a given insert index, renumbering all tasks
 * in the target column sequentially (mirrors MainViewModel.MoveTaskToColumnAtPosition).
 */
export function moveTaskToColumnAtPosition(taskId: number, targetColumnId: number, insertIndex: number) {
  const s = getStore();
  const task = s.tasks.find((t) => t.id === taskId);
  if (!task) return;

  let existing = s.tasks
    .filter((t) => t.columnId === targetColumnId)
    .sort((a, b) => a.order - b.order);
  const sameColumn = task.columnId === targetColumnId;

  if (sameColumn) {
    const oldIndex = existing.findIndex((t) => t.id === taskId);
    if (oldIndex >= 0) {
      existing.splice(oldIndex, 1);
      if (insertIndex > oldIndex) insertIndex--;
    }
  }

  if (insertIndex < 0) insertIndex = 0;
  if (insertIndex > existing.length) insertIndex = existing.length;

  task.columnId = targetColumnId;
  const existingIds = existing.map((t) => t.id);
  existingIds.splice(insertIndex, 0, taskId);

  existingIds.forEach((id, i) => {
    const t = s.tasks.find((x) => x.id === id);
    if (t) {
      t.columnId = targetColumnId;
      t.order = i;
    }
  });
  persist();
}

// ─── Export / Import ──────────────────────────────────────────────────────

/**
 * Serializes the entire store — all projects, columns, tasks, comments and
 * settings — to a pretty-printed JSON string (the ".kan" backup format).
 */
export function exportStoreJson(): string {
  return JSON.stringify(getStore(), null, 2);
}

/**
 * Validates a ".kan" backup and replaces the whole store with its contents
 * (clearing whatever was there before, mirroring a fresh load from the file).
 * Returns false (and leaves the current store untouched) if the JSON is not
 * shaped like a Kanban export.
 */
export function importStoreJson(json: string): boolean {
  let parsed: Partial<StoreData>;
  try {
    parsed = JSON.parse(json) as Partial<StoreData>;
  } catch {
    return false;
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray(parsed.projects) ||
    !Array.isArray(parsed.columns) ||
    !Array.isArray(parsed.tasks)
  ) {
    return false;
  }

  const next: StoreData = {
    projects: parsed.projects,
    columns: parsed.columns,
    tasks: parsed.tasks,
    comments: Array.isArray(parsed.comments) ? parsed.comments : [],
    settings: parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {},
    nextId: typeof parsed.nextId === "number" && parsed.nextId > 0 ? parsed.nextId : 1,
  };
  if (next.nextId <= Math.max(0, ...idsUsed(next))) {
    next.nextId = Math.max(0, ...idsUsed(next)) + 1;
  }

  _store = next;
  persist();
  return true;
}

function idsUsed(s: StoreData): number[] {
  return [
    ...s.projects.map((p) => p.id),
    ...s.columns.map((c) => c.id),
    ...s.tasks.map((t) => t.id),
    ...s.comments.map((c) => c.id),
  ];
}

// ─── Comments ─────────────────────────────────────────────────────────────

export function getComments(taskId: number): Comment[] {
  return getStore()
    .comments.filter((c) => c.taskId === taskId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function addComment(text: string, taskId: number): Comment {
  const s = getStore();
  const c: Comment = {
    id: s.nextId++,
    text,
    createdAt: new Date().toISOString(),
    taskId,
  };
  s.comments.push(c);
  persist();
  return c;
}

// ─── Task type names ──────────────────────────────────────────────────────

export function getTaskTypeNames(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of ALL_TASK_TYPES) {
    out[t] = getStore().settings[`TaskTypeName_${t}`] ?? t;
  }
  return out;
}

export function getTaskTypeDisplayName(type: TaskType): string {
  return getStore().settings[`TaskTypeName_${type}`] ?? type;
}

export function saveTaskTypeName(type: TaskType, name: string) {
  getStore().settings[`TaskTypeName_${type}`] = name;
  persist();
}

// ─── Settings ─────────────────────────────────────────────────────────────

export function getSetting(key: string, fallback?: string): string | undefined {
  return getStore().settings[key] ?? fallback;
}

export function setSetting(key: string, value: string) {
  getStore().settings[key] = value;
  persist();
}

