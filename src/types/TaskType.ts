// Mirrors KanbanNW/Models/TaskType.cs
export enum TaskType {
  None = "None",
  Red = "Red",
  Orange = "Orange",
  Yellow = "Yellow",
  Green = "Green",
  Blue = "Blue",
  Purple = "Purple",
  Black = "Black",
}

export const ALL_TASK_TYPES: TaskType[] = [
  TaskType.None,
  TaskType.Red,
  TaskType.Orange,
  TaskType.Yellow,
  TaskType.Green,
  TaskType.Blue,
  TaskType.Purple,
  TaskType.Black,
];

// Matches the colour palette in Converters/TypeToColorConverter.cs
export const TASK_TYPE_COLORS: Record<TaskType, string> = {
  [TaskType.None]: "#FFFFFF",
  [TaskType.Red]: "#EF5350",
  [TaskType.Orange]: "#FF7043",
  [TaskType.Yellow]: "#FFCA28",
  [TaskType.Green]: "#66BB6A",
  [TaskType.Blue]: "#42A5F5",
  [TaskType.Purple]: "#AB47BC",
  [TaskType.Black]: "#455A64",
};