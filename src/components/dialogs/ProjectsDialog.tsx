"use client";

import { useState } from "react";
import type { KanbanProject } from "@/types/KanbanModels";
import {
  getProjects,
  createProject,
  deleteProject,
  updateProject,
} from "@/lib/store";
import { Modal } from "./CategoriesDialog";
import { contrastText } from "../Board";

const COLOR_OPTIONS = [
  "#2C3E50", "#34495E", "#1A5276", "#922B21", "#1E8449",
  "#B7950B", "#6C3483", "#2E86C1", "#616A6B", "#D35400", "#27AE60",
];

export default function ProjectsDialog({ onClose }: { onClose: () => void }) {
  const [projects, setProjects] = useState<KanbanProject[]>(getProjects());

  const addProject = () => {
    let count = 1;
    while (projects.some((p) => p.name === `New Project ${count}`)) count++;
    const id = createProject(`New Project ${count}`);
    setProjects((prev) => [...prev, { id, name: `New Project ${count}`, color: "#2C3E50" }]);
  };

  const removeProject = (p: KanbanProject) => {
    if (projects.length <= 1) return; // keep at least one
    deleteProject(p.id);
    setProjects((prev) => prev.filter((x) => x.id !== p.id));
  };

  const setColor = (p: KanbanProject, color: string) => {
    setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, color } : x)));
  };

  const save = () => {
    for (const p of projects) {
      updateProject(p.id, p.name.trim() || "Untitled", p.color);
    }
    setProjects(getProjects());
    onClose();
  };

  return (
    <Modal title="Manage Projects" onClose={onClose} onSave={save} footerLeft={
      <button
        onClick={addProject}
        className="rounded-md bg-transparent px-3 py-1.5 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700"
      >
        + Add Project
      </button>
    }>
      <div className="space-y-2">
        {projects.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-md border border-neutral-200 p-2 dark:border-neutral-700">
            <button
              onClick={() => {
                const next =
                  COLOR_OPTIONS[(COLOR_OPTIONS.indexOf(p.color) + 1) % COLOR_OPTIONS.length];
                setColor(p, next);
              }}
              className="h-5 w-5 shrink-0 rounded-md border border-black/10"
              style={{ backgroundColor: p.color }}
              title="Click to change color"
            />
            <input
              value={p.name}
              onChange={(e) =>
                setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))
              }
              className="flex-1 rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-500 dark:border-neutral-600"
            />
            <button
              onClick={() => removeProject(p)}
              disabled={projects.length <= 1}
              className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-900/40"
              title="Delete project"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}