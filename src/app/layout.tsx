import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KanbanNW-Web",
  description:
    "A lightweight kanban board that runs entirely in your browser — no server, no sign-in.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}