This is just a little standalone Kanban board.

It supports multiple projects, dynamically addable and removable columns (or
statuses or whatever your kanban flavour calls them).

It has limited support for tagging with colours to flag important tasks, estimated
times, highlighting when tasks are becoming overdue, and quick drag/drop of tasks
between the columns. There's even light/dark mode.

It runs entirely in your browser — no server, no sign-in, no runtime to install.
All data is stored in the browser's `localStorage`, and you can back it up: each
project exports to CSV, and the whole workspace exports to (and restores from) a
`.kan` backup file via the Export / Import menus.

I wrote it for myself because my employer locks down our machines and forces us to
use Teams. I'd rather not use Teams if I can help it.

Chunks of this were written by Claude because who has time to write all that
godforsaken code. :)

This is made public with no apologies, and no guarantees. If you like it, enjoy it.
:)

---

# KanbanNW-Web

A static Next.js/React app that persists to the browser's `localStorage`.

## Run it

```bash
./web-serve.sh
```

That builds the static export and serves it at http://localhost:8080.

Or manually:

```bash
npm install
npm run build       # produces out/ (pure static HTML/JS/CSS)
npm run preview     # serves out/ at http://localhost:8080
```

The `out/` folder is a fully static site — you can host it on GitHub Pages,
any static host, or a USB stick. Everything (projects, columns, tasks, comments,
settings) lives in the browser's `localStorage`, so there's no backend at all.

## Features

- Multi-project tabs, columns, tasks, comments, categories, due dates,
  dark/light theme.
- Drag-and-drop between and within columns via `@dnd-kit`.
- Export → Project to CSV: the current project's tasks (with comments) as CSV.
- Export → All Projects: the whole workspace snapshot as a dated `.kan` file.
- Import → Exported Projects: clears the workspace and restores it from a `.kan`
  file.
- Exports use the browser's native Save dialog where supported (Chromium),
  otherwise an in-app "File Name" dialog (e.g. Firefox).

---
