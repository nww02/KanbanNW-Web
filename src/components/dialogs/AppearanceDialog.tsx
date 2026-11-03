"use client";

import { useState } from "react";
import { getSetting, setSetting } from "@/lib/store";
import { Modal } from "./CategoriesDialog";

const THEMES = ["System", "Light", "Dark"] as const;
const FONT_PRESETS = ["Small", "Medium", "Large"] as const;

/** Apply the theme to <html>: System follows the OS live; Light/Dark override. */
function applyTheme(theme: string) {
  const dark = theme === "Dark" || (theme === "System" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Apply the font-size preset to <html> (Tailwind theme vars scale via CSS). */
function applyFontSize(size: string) {
  // CSS attribute selectors are case-sensitive; store lowercase to match the
  // :root[data-font-size="small"|"large"] rules in globals.css.
  document.documentElement.dataset.fontSize =
    (FONT_PRESETS.includes(size as (typeof FONT_PRESETS)[number]) ? size : "Medium").toLowerCase();
}

export default function AppearanceDialog({ onClose }: { onClose: () => void }) {
  const [theme, setTheme] = useState<string>(getSetting("theme", "System") ?? "System");
  const [fontPreset, setFontPreset] = useState<string>(
    getSetting("fontPreset", "Medium") ?? "Medium",
  );

  const save = () => {
    setSetting("theme", theme);
    setSetting("fontPreset", fontPreset);
    applyTheme(theme);
    applyFontSize(fontPreset);
    onClose();
  };

  return (
    <Modal
      title="Appearance Settings"
      onClose={onClose}
      onSave={save}
      footerLeft={
        <button
          onClick={() => {
            setTheme("System");
            setFontPreset("Medium");
          }}
          className="rounded-md px-3 py-1.5 text-xs hover:bg-neutral-200 dark:hover:bg-neutral-700"
        >
          Reset to Defaults
        </button>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-32 shrink-0">Theme:</span>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-600"
          >
            {THEMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-32 shrink-0">Font Size:</span>
          <select
            value={fontPreset}
            onChange={(e) => setFontPreset(e.target.value)}
            className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-600"
          >
            {FONT_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}