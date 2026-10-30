import type { CronEntry, CronTreeNode } from "./types";

export function buildCronTree(items: CronEntry[]): CronTreeNode[] {
  const bySection = new Map<string, CronTreeNode>();

  for (const task of items) {
    let group = bySection.get(task.section);
    if (!group) {
      group = {
        key: `sec:${task.section}`,
        label: task.section,
        type: "section",
        children: [],
      };
      bySection.set(task.section, group);
    }
    group.children.push({
      key: `task:${task.name}`,
      label: task.name,
      type: "task",
      children: [],
      task,
    });
  }

  const out = Array.from(bySection.values());
  out.sort((a, b) => a.label.localeCompare(b.label));
  for (const g of out) g.children.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}

export interface FlatRow {
  node: CronTreeNode;
  depth: number;
}

export function flattenTree(
  nodes: CronTreeNode[],
  expanded: Set<string>,
  depth = 0,
): FlatRow[] {
  const out: FlatRow[] = [];
  for (const n of nodes) {
    out.push({ node: n, depth });
    if (n.type === "section" && expanded.has(n.key)) {
      out.push(...flattenTree(n.children, expanded, depth + 1));
    }
  }
  return out;
}

export function allSectionKeys(nodes: CronTreeNode[]): Set<string> {
  const set = new Set<string>();
  for (const n of nodes) if (n.type === "section") set.add(n.key);
  return set;
}