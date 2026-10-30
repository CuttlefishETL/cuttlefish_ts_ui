export interface CronEntry {
  name: string;
  schedule: string;
  script: string;
  uid: string;
  section: string;
  enabled: boolean;
  description?: string;
}

export interface CodeTreeNode {
  name: string;
  path: string;
  type: "folder" | "file";
  children?: CodeTreeNode[];
}

export interface CronTreeNode {
  key: string;
  label: string;
  type: "section" | "task";
  children: CronTreeNode[];
  path: string;
  task?: CronEntry;
}

export function isValidSchedule(schedule: string): boolean {
  const parts = schedule.trim().split(/\s+/);
  return parts.length === 6 && parts.every((p) => p.length > 0);
}

export function getTaskSection(t: CronEntry): string {
  return t.section ?? "";
}

export function isDescendantOrSelf(path: string, ancestor: string): boolean {
  if (ancestor === "") return true;
  return path === ancestor || path.startsWith(ancestor + "/");
}

export function parentPath(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx < 0 ? "" : path.slice(0, idx);
}

export function sectionName(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx < 0 ? path : path.slice(idx + 1);
}

export function validateSectionName(name: string): string | null {
  if (!name) return "Имя обязательно";
  if (name.includes("/")) return "Имя не должно содержать /";
  if (name === "." || name === "..") return "Недопустимое имя";
  if (name.length > 64) return "Не более 64 символов";
  return null;
}