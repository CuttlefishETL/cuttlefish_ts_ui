import type { ConnectorInstance, ConnectorTreeNode } from "./types";
import { getConnectorFolder } from "./types";

export function buildConnectorTree(
  items: ConnectorInstance[],
  folderPaths: string[],
): ConnectorTreeNode[] {
  const allFolders = new Set<string>();

  for (const raw of folderPaths) {
    const trimmed = raw.trim().replace(/\/+$/, "");
    if (!trimmed) continue;
    const parts = trimmed.split("/").filter(Boolean);
    for (let i = 1; i <= parts.length; i++) {
      allFolders.add(parts.slice(0, i).join("/"));
    }
  }

  for (const c of items) {
    const folder = getConnectorFolder(c);
    if (!folder) continue;
    const parts = folder.split("/").filter(Boolean);
    for (let i = 1; i <= parts.length; i++) {
      allFolders.add(parts.slice(0, i).join("/"));
    }
  }

  const folderNodes = new Map<string, ConnectorTreeNode>();
  for (const path of Array.from(allFolders).sort()) {
    const parts = path.split("/");
    folderNodes.set(path, {
      key: `folder:${path}`,
      label: parts[parts.length - 1],
      type: "folder",
      path,
      children: [],
    });
  }

  const roots: ConnectorTreeNode[] = [];

  for (const [path, node] of folderNodes) {
    const parts = path.split("/");
    if (parts.length === 1) {
      roots.push(node);
    } else {
      const pp = parts.slice(0, -1).join("/");
      const parent = folderNodes.get(pp);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }

  for (const c of items) {
    const folder = getConnectorFolder(c);
    const node: ConnectorTreeNode = {
      key: `conn:${c.name}`,
      label: c.name,
      type: "connector",
      path: c.name,
      children: [],
      connector: c,
    };
    if (folder) {
      const parent = folderNodes.get(folder);
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  }

  const sort = (list: ConnectorTreeNode[]) => {
    list.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

export interface FlatRow {
  node: ConnectorTreeNode;
  depth: number;
}

export function flattenTree(
  nodes: ConnectorTreeNode[],
  expanded: Set<string>,
  depth = 0,
): FlatRow[] {
  const out: FlatRow[] = [];
  for (const n of nodes) {
    out.push({ node: n, depth });
    if (n.type === "folder" && expanded.has(n.key)) {
      out.push(...flattenTree(n.children, expanded, depth + 1));
    }
  }
  return out;
}

export function allFolderKeys(nodes: ConnectorTreeNode[]): Set<string> {
  const set = new Set<string>();
  const walk = (list: ConnectorTreeNode[]) => {
    for (const n of list) {
      if (n.type === "folder") {
        set.add(n.key);
        walk(n.children);
      }
    }
  };
  walk(nodes);
  return set;
}

export function canMoveFolderTo(from: string, to: string): boolean {
  if (from === to) return false;
  if (to === "") return true;
  if (from === "") return false;
  return !(to === from || to.startsWith(from + "/"));
}