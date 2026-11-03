"use client";

import { useState } from "react";
import type { KanbanColumn } from "@/types/KanbanModels";
import {
  getColumnsForProject,
  createColumn,
  renameColumn,
  deleteColumn,
  getInTrayColumn,
  getTasksForColumn,
  moveTaskToColumn,
} from "@/lib/store";
import { Modal } from "./CategoriesDialog";

interface Item {
  id: number;
  name: string;
  isSystem: boolean;
}

export default function ColumnsDialog({
  projectId,
  onClose,
}: {
  projectId: number;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Item[]>(() =>
    getColumnsForProject(projectId).map((c) => ({
      id: c.id,
      name: c.name,
      isSystem: c.isSystem,
    })),
  );
  const [nextTempId, setNextTempId] = useState(-1);

  const addColumn = () => {
    let count = 1;
    const existing = new Set(items.map((i) => i.name));
    while (existing.has(`New Column ${count}`)) count++;
    setItems((prev) => [
      ...prev,
      { id: nextTempId, name: `New Column ${count}`, isSystem: false },
    ]);
    setNextTempId((t) => t - 1);
  };

  const removeItem = (item: Item) => {
    if (item.isSystem) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const save = () => {
    const savedIds = new Set(items.filter((i) => i.id > 0).map((i) => i.id));
    const original = getColumnsForProject(projectId);

    // delete removed columns, moving tasks to In Tray first
    for (const c of original) {
      if (savedIds.has(c.id)) continue;
      const inTray = getInTrayColumn(projectId);
      if (inTray) {
        let nextOrder =
          Math.max(0, ...getTasksForColumn(inTray.id).map((t) => t.order)) + 1;
        for (const t of getTasksForColumn(c.id)) {
          moveTaskToColumn(t.id, inTray.id, nextOrder++);
        }
      }
      deleteColumn(c.id);
    }

    // create new (negative id)
    for (const item of items) {
      if (item.id >= 0) continue;
      const name = item.name.trim() || "Untitled";
      createColumn(name, projectId);
    }

    // rename changed
    for (const item of items) {
      if (item.id <= 0) continue;
      const orig = original.find((c) => c.id === item.id);
      if (!orig) continue;
      const trimmed = item.name.trim();
      if (trimmed === orig.name) continue;
      renameColumn(item.id, trimmed);
    }

    onClose();
  };

  return (
    <Modal title="Manage Columns" onClose={onClose} onSave={save} footerLeft={
      <button
        onClick={addColumn}
        className="rounded-md bg-transparent px-3 py-1.5 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700"
      >
        + Add Column
      </button>
    }>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 rounded-md border border-neutral-200 p-2 dark:border-neutral-700"
          >
            <input
              value={item.name}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((i) => (i.id === item.id ? { ...i, name: e.target.value } : i)),
                )
              }
              readOnly={item.isSystem}
              className={`flex-1 rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-500 dark:border-neutral-600 ${
                item.isSystem ? "cursor-not-allowed opacity-60" : ""
              }`}
            />
            {!item.isSystem && (
              <button
                onClick={() => removeItem(item)}
                className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40"
                title="Delete column"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}