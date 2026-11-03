// Mirrors KanbanNW/Models/KanbanProject.cs
export interface KanbanProject {
  id: number;
  name: string;
  color: string; // hex e.g. "#2C3E50"
}

// Mirrors KanbanNW/Models/KanbanColumn.cs
export interface KanbanColumn {
  id: number;
  name: string;
  order: number;
  isSystem: boolean;
  projectId: number;
}

// Mirrors KanbanNW/Models/KanbanTask.cs
export interface KanbanTask {
  id: number;
  title: string;
  createdAt: string; // ISO
  dueDate: string | null; // ISO
  description: string;
  type: string; // TaskType serialized
  columnId: number;
  isComplete: boolean;
  order: number;
  estimatedDays: number;
}

// Mirrors KanbanNW/Models/Comment.cs
export interface Comment {
  id: number;
  text: string;
  createdAt: string; // ISO
  taskId: number;
}