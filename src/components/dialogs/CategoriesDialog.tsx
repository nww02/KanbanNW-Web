"use client";

import { useState } from "react";
import { ALL_TASK_TYPES, TASK_TYPE_COLORS } from "@/types/TaskType";
import { saveTaskTypeName } from "@/lib/store";

export default function CategoriesDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: Record<string, string>;
  onSave: (names: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [names, setNames] = useState<Record<string, string>>(initial);

  const save = () => {
    for (const t of ALL_TASK_TYPES) {
      const val = (names[t] ?? "").trim();
      saveTaskTypeName(t, val || t);
    }
    onSave(names);
    onClose();
  };

  return (
    <Modal title="Edit Category Names" onClose={onClose} onSave={save} footerLeft={
      <button
        onClick={() => {
          const reset: Record<string, string> = {};
          for (const t of ALL_TASK_TYPES) reset[t] = t;
          setNames(reset);
        }}
        className="rounded-md px-3 py-1.5 text-xs hover:bg-neutral-200 dark:hover:bg-neutral-700"
      >
        Reset to Defaults
      </button>
    }>
      <div className="space-y-2">
        {ALL_TASK_TYPES.map((t) => (
          <div key={t} className="flex items-center gap-3 rounded-md border border-neutral-200 p-2 dark:border-neutral-700">
            <span
              className="h-5 w-5 shrink-0 rounded"
              style={{ backgroundColor: TASK_TYPE_COLORS[t] }}
            />
            <span className="w-20 shrink-0 text-xs text-neutral-500">{t}</span>
            <input
              value={names[t] ?? t}
              onChange={(e) => setNames((n) => ({ ...n, [t]: e.target.value }))}
              className="flex-1 rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-500 dark:border-neutral-600"
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}

// shared modal shell
export function Modal({
  title,
  children,
  onClose,
  onSave,
  footerLeft,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSave?: () => void;
  footerLeft?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-neutral-200 px-4 py-3 text-base font-bold dark:border-neutral-700">
          {title}
        </div>
        <div className="board-scroll flex-1 overflow-y-auto p-4">{children}</div>
        <div className="flex items-center justify-between gap-2 border-t border-neutral-200 p-4 dark:border-neutral-700">
          <div>{footerLeft}</div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md px-4 py-1.5 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700"
            >
              Cancel
            </button>
            {onSave && (
              <button
                onClick={onSave}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}