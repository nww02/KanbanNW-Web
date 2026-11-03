"use client";

import { useEffect, useState } from "react";
import type { KanbanTask, Comment } from "@/types/KanbanModels";
import { TASK_TYPE_COLORS, TaskType, ALL_TASK_TYPES } from "@/types/TaskType";
import { createTask, updateTask, addComment, getComments, getTaskTypeNames } from "@/lib/store";

interface TaskEditorModalProps {
  task?: KanbanTask; // undefined = creating new
  defaultColumnId: number;
  projectId: number;
  onSave: (task: KanbanTask) => void;
  onClose: () => void;
}

export default function TaskEditorModal({ task, defaultColumnId, onSave, onClose }: TaskEditorModalProps) {
  const editing = Boolean(task);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [type, setType] = useState<TaskType>(task?.type as TaskType ?? TaskType.None);
  const [dueDate, setDueDate] = useState<string>(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  const [estimatedDays, setEstimatedDays] = useState(task?.estimatedDays ?? 1);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [typeNames, setTypeNames] = useState<Record<string, string>>({});

  useEffect(() => {
    setTypeNames(getTaskTypeNames());
    if (task) setComments(getComments(task.id));
  }, [task]);

  const save = () => {
    if (!title.trim()) return;
    const now = new Date().toISOString();
    const base = {
      title: title.trim(),
      description: description.trim(),
      type,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      estimatedDays: Math.max(1, estimatedDays || 1),
    };

    if (task) {
      const updated: KanbanTask = { ...task, ...base };
      updateTask(updated);
      onSave(updated);
    } else {
      const created = createTask({
        ...base,
        createdAt: now,
        columnId: defaultColumnId,
        isComplete: false,
      });
      // "Task created" comment, matching desktop behaviour
      addComment("Task created", created.id);
      // Any comments typed before first save attach to the new task
      for (const c of comments) {
        if (c.id < 0) addComment(c.text, created.id);
      }
      onSave(created);
    }
    onClose();
  };

  const addCommentNow = () => {
    if (!newComment.trim()) return;
    if (task) {
      addComment(newComment.trim(), task.id);
      setComments(getComments(task.id));
    } else {
      // hold in local state (negative id) until save
      setComments((prev) => [
        ...prev,
        { id: -Date.now(), text: newComment.trim(), createdAt: new Date().toISOString(), taskId: 0 },
      ]);
    }
    setNewComment("");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* body */}
        <div className="grid flex-1 gap-6 overflow-auto p-6 md:grid-cols-[1fr_260px]">
          {/* left: main form */}
          <div className="space-y-4">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base font-semibold outline-none focus:border-blue-500 dark:border-neutral-600"
            />

            {/* type */}
            <div className="flex items-center gap-2 text-sm">
              <span className="shrink-0">Type:</span>
              <div className="flex flex-wrap gap-1.5">
                {ALL_TASK_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium ${
                      type === t ? "ring-2 ring-blue-500" : ""
                    }`}
                    style={{ backgroundColor: TASK_TYPE_COLORS[t] }}
                    title={typeNames[t]}
                  >
                    <span
                      className="rounded px-1"
                      style={{
                        color:
                          TASK_TYPE_COLORS[t] === "#FFFFFF" ? "#000" : "#fff",
                      }}
                    >
                      {typeNames[t] ?? t}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* due date */}
            <div className="flex items-center gap-2 text-sm">
              <span>Due date:</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-600"
              />
              {dueDate && (
                <button
                  onClick={() => setDueDate("")}
                  className="rounded px-1 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  title="Clear due date"
                >
                  🗑
                </button>
              )}
            </div>

            {/* estimated days */}
            <div className="flex items-center gap-2 text-sm">
              <span>Estimated days:</span>
              <input
                type="number"
                min={1}
                value={estimatedDays}
                onChange={(e) => setEstimatedDays(Number(e.target.value))}
                className="w-20 rounded-md border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-600"
              />
            </div>

            {/* description */}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={5}
              className="w-full resize-y rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-neutral-600"
            />
          </div>

          {/* right: comments */}
          <div className="flex flex-col border-t border-neutral-200 pt-4 dark:border-neutral-700 md:border-l md:border-t-0 md:pl-4 md:pt-0">
            <div className="mb-2 text-sm font-bold">Comments</div>
            <div className="board-scroll flex-1 space-y-2 overflow-y-auto">
              {comments.length === 0 && (
                <div className="text-xs text-neutral-400">No comments</div>
              )}
              {comments.map((c) => (
                <div key={c.id} className="text-xs">
                  <div className="text-neutral-800 dark:text-neutral-200">{c.text}</div>
                  <div className="text-neutral-400">
                    {new Date(c.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCommentNow()}
                placeholder="Add a comment…"
                className="flex-1 rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-neutral-600"
              />
              <button
                onClick={addCommentNow}
                className="rounded-md bg-neutral-200 px-2 py-1 text-xs hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="flex justify-end gap-2 border-t border-neutral-200 p-4 dark:border-neutral-700">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-1.5 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            {editing ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}