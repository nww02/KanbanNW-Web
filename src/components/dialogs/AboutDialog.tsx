"use client";

export default function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-2xl dark:bg-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-2xl font-bold">KanbanWeb</div>
        <div className="mt-1 text-xs text-neutral-500">Version 1.0.3</div>
        <p className="mt-3 text-sm">
          A lightweight kanban board for organising tasks into columns and
          tracking progress — running entirely in your browser.
        </p>
        <div className="my-4 h-px bg-neutral-200 dark:bg-neutral-700" />
        <p className="text-xs leading-relaxed text-neutral-500">
          This software is provided "as is" without warranty of any kind, either
          express or implied, including but not limited to the implied warranties
          of merchantability and fitness for a particular purpose. Use at your own
          risk.
        </p>
        <button
          onClick={onClose}
          className="mt-4 rounded-md bg-blue-600 px-6 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}