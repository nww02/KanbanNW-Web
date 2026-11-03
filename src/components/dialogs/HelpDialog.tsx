"use client";

import { useState } from "react";

const TOPICS: { title: string; content: string }[] = [
  {
    title: "Welcome",
    content:
      "KanbanWeb is a lightweight kanban board that runs entirely in your browser — no server, no sign-in. All data is stored in your browser's localStorage.\n\nUse the menu at the top to configure projects, columns, categories, and appearance. Drag cards between columns to move tasks.",
  },
  {
    title: "Getting Started",
    content:
      "A default project is created with In Tray and Done columns.\n\n  1. Click '+ Add Task' in a column to create a task.\n  2. Click a task to edit its details — title, type, due date, comments.\n  3. Drag tasks between columns to move them.",
  },
  {
    title: "Managing Tasks",
    content:
      "Create: click '+ Add Task' in any column except Done/Deleted.\nEdit: click a card to open the editor.\nMove: drag-and-drop between columns.\nComplete: click ✓ to send to Done.\nDelete: click ✕ to move to the Deleted Tasks queue (viewable via Config → Show Deleted).",
  },
  {
    title: "Managing Columns",
    content:
      "Use Config → Columns. Add columns, rename them, or delete user columns (tasks move to In Tray). System columns (In Tray, Done, Deleted Tasks) cannot be deleted.",
  },
  {
    title: "Managing Projects",
    content:
      "Use Config → Projects to add, rename, delete, and re-colour projects. Click a project tab at the top to switch. The last project cannot be deleted.",
  },
  {
    title: "Appearance",
    content:
      "Use Config → Appearance to switch Light/Dark/System theme and choose small, medium, or large font presets (or fine-tune individual sizes).",
  },
  {
    title: "Export & Import",
    content:
      "Kanban → Export → Project to CSV: downloads all tasks in the current project as a CSV file, including comments.\n\nKanban → Export → All Projects: saves every project (plus columns, tasks, comments and settings) as a .kan backup file.\n\nKanban → Import → Exported Projects: asks for a .kan file, clears the current workspace and rebuilds it from that file.",
  },
];

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState(0);
  const topic = TOPICS[selected];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-52 shrink-0 overflow-y-auto border-r border-neutral-200 py-2 dark:border-neutral-700">
          {TOPICS.map((t, i) => (
            <button
              key={t.title}
              onClick={() => setSelected(i)}
              className={`block w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 ${
                i === selected ? "bg-neutral-100 font-semibold dark:bg-neutral-700" : ""
              }`}
            >
              {t.title}
            </button>
          ))}
        </div>
        <div className="board-scroll flex-1 overflow-y-auto p-6 text-sm">
          <div className="mb-2 text-lg font-bold">{topic.title}</div>
          <div className="whitespace-pre-wrap">{topic.content}</div>
          <button
            onClick={onClose}
            className="mt-4 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}