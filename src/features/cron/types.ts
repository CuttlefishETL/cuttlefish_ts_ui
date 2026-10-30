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
  task?: CronEntry;
}

export function isValidSchedule(schedule: string): boolean {
  const parts = schedule.trim().split(/\s+/);
  return parts.length === 6 && parts.every((p) => p.length > 0);
}
