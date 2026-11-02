export interface CodeTreeNode {
  name: string;
  path: string;
  type: "folder" | "file";
  children?: CodeTreeNode[];
}

export function findByPath(
  nodes: CodeTreeNode[],
  path: string,
): CodeTreeNode | null {
  for (const n of nodes) {
    if (n.path === path) return n;
    if (n.children) {
      const found = findByPath(n.children, path);
      if (found) return found;
    }
  }
  return null;
}

export function collectFolderPaths(nodes: CodeTreeNode[]): string[] {
  const out: string[] = [];
  const walk = (list: CodeTreeNode[]) => {
    for (const n of list) {
      if (n.type === "folder") {
        out.push(n.path);
        if (n.children) walk(n.children);
      }
    }
  };
  walk(nodes);
  return out;
}
