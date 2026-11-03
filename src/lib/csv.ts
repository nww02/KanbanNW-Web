import type { KanbanTask } from "@/types/KanbanModels";
import { getComments, getTaskTypeDisplayName } from "./store";
import { TaskType } from "@/types/TaskType";

function csvEscape(field: string): string {
  if (!field) return "";
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Builds the CSV for a project (mirrors MainViewModel.OnExportProject).
 * `columnNameOf` maps task columnId -> column display name.
 */
export function buildProjectCsv(
  tasks: KanbanTask[],
  columnNameOf: (columnId: number) => string,
): string {
  const header =
    "Id,Title,CreatedAt,DueDate,Description,Type,Column,IsComplete,Order,EstimatedDays,Comments";
  const rows = tasks.map((task) => {
    const comments = getComments(task.id)
      .map((c) => c.text)
      .join(" | ");
    const typeDisplayName = getTaskTypeDisplayName(task.type as TaskType);
    const due = task.dueDate ? task.dueDate.slice(0, 10) : "";
    return [
      task.id,
      csvEscape(task.title),
      task.createdAt.slice(0, 10),
      due,
      csvEscape(task.description),
      typeDisplayName,
      csvEscape(columnNameOf(task.columnId)),
      task.isComplete ? 1 : 0,
      task.order,
      task.estimatedDays,
      csvEscape(comments),
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

/** The optional File System Access API surface, typed since the DOM lib lacks it. */
type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

/** True when the browser can show a real native "Save As" dialog. */
export function canUseSaveDialog(): boolean {
  return typeof (window as SaveFilePickerWindow).showSaveFilePicker === "function";
}

/**
 * Saves `content` as `fileName`. Tries the File System Access API
 * (`showSaveFilePicker`) first so the user gets a real native "Save As" dialog
 * with the right file filter (Chromium in a secure context); falls back to a
 * programmatic download elsewhere. Returning early on a cancelled dialog keeps
 * the fallback from firing. `fileName` must end in the desired suffix
 * (.csv / .kan).
 */
export async function downloadTextFile(
  fileName: string,
  content: string,
  mimeType = "text/csv",
): Promise<void> {
  const ext = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
  const w = window as SaveFilePickerWindow;

  if (typeof w.showSaveFilePicker === "function") {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: ext === "csv" ? "CSV file" : "Kanban file",
            accept: { [mimeType]: [`.${ext || "txt"}`] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return; // saved via native dialog
    } catch (err) {
      // User cancelled the dialog — don't fall back to a silent download.
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Any other failure → classic download below.
      console.warn("KanbanWeb: Save dialog failed, falling back to a direct download.", err);
    }
  } else {
    // No Save dialog in this browser/context. Surface why so it isn't a mystery.
    console.warn(
      "KanbanWeb: this browser can't show a Save dialog (no showSaveFilePicker). Downloading directly.",
      { isSecureContext: window.isSecureContext, userAgent: navigator.userAgent },
    );
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}