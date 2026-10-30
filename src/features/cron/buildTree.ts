import type { CronEntry, CronTreeNode } from "./types";
import { getTaskSection } from "./types";

export function buildCronTree(
  items: CronEntry[],
  sectionPaths: string[],
): CronTreeNode[] {
  const allSections = new Set<string>();

  for (const raw of sectionPaths) {
    const trimmed = raw.trim().replace(/\/+$/, "");
    if (!trimmed) continue;
    const parts = trimmed.split("/").filter(Boolean);
    for (let i = 1; i <= parts.length; i++) {
      allSections.add(parts.slice(0, i).join("/"));
    }
  }

  for (const t of items) {
    const section = getTaskSection(t);
    if (!section) continue;
    const parts = section.split("/").filter(Boolean);
    for (let i = 1; i <= parts.length; i++) {
      allSections.add(parts.slice(0, i).join("/"));
    }
  }

  const sectionNodes = new Map<string, CronTreeNode>();
  for (const path of Array.from(allSections).sort()) {
    const parts = path.split("/");
    sectionNodes.set(path, {
      key: `sec:${path}`,
      label: parts[parts.length - 1],
      type: "section",
      path,
      children: [],
    });
  }

  const roots: CronTreeNode[] = [];

  for (const [path, node] of sectionNodes) {
    const parts = path.split("/");
    if (parts.length === 1) {
      roots.push(node);
    } else {
      const pp = parts.slice(0, -1).join("/");
      const parent = sectionNodes.get(pp);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }

  for (const t of items) {
    const section = getTaskSection(t);
    const node: CronTreeNode = {
      key: `task:${t.name}`,
      label: t.name,
      type: "task",
      path: t.name,
      children: [],
      task: t,
    };
    if (section) {
      const parent = sectionNodes.get(section);
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  }

  const sort = (list: CronTreeNode[]) => {
    list.sort((a, b) => {
      if (a.type !== b.type) return a.type === "section" ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
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
  const walk = (list: CronTreeNode[]) => {
    for (const n of list) {
      if (n.type === "section") {
        set.add(n.key);
        walk(n.children);
      }
    }
  };
  walk(nodes);
  return set;
}

export function canMoveSectionTo(from: string, to: string): boolean {
  if (from === to) return false;
  if (to === "") return true;
  if (from === "") return false;
  return !(to === from || to.startsWith(from + "/"));
}