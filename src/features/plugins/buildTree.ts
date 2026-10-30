import type { PluginListItem, PluginTreeNode } from "./types";

export function buildPluginTree(plugins: PluginListItem[]): PluginTreeNode[] {
  const root: PluginTreeNode = {
    key: "__root__",
    label: "",
    type: "folder",
    children: [],
    path: "",
  };

  for (const plugin of plugins) {
    const segments = plugin.filename.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const isLast = i === segments.length - 1;
      const key = `${current.key}/${seg}`;

      let node = current.children.find((c) => c.key === key);
      if (!node) {
        node = {
          key,
          label: seg,
          type: isLast ? "plugin" : "folder",
          children: [],
          plugin: isLast ? plugin : undefined,
          path: segments.slice(0, i + 1).join("/"),
        };
        current.children.push(node);
      } else if (isLast) {
        node.type = "plugin";
        node.plugin = plugin;
      }
      current = node;
    }
  }

  const sort = (list: PluginTreeNode[]) => {
    list.sort((a, b) =>
      a.type !== b.type
        ? a.type === "folder" ? -1 : 1
        : a.label.localeCompare(b.label),
    );
    list.forEach((n) => sort(n.children));
  };
  sort(root.children);
  return root.children;
}

export function filterTree(
  nodes: PluginTreeNode[],
  query: string,
): PluginTreeNode[] {
  if (!query.trim()) return nodes;
  const needle = query.toLowerCase();

  const walk = (list: PluginTreeNode[]): PluginTreeNode[] => {
    const out: PluginTreeNode[] = [];
    for (const node of list) {
      if (node.type === "folder") {
        out.push({ ...node, children: walk(node.children) });
      } else if (node.plugin) {
        const p = node.plugin;
        if (
          p.name.toLowerCase().includes(needle) ||
          p.filename.toLowerCase().includes(needle)
        ) {
          out.push(node);
        }
      }
    }
    return out;
  };

  return walk(nodes);
}

export interface FlatRow {
  node: PluginTreeNode;
  depth: number;
}

export function flatten(
  nodes: PluginTreeNode[],
  expanded: Set<string>,
  depth = 0,
): FlatRow[] {
  const out: FlatRow[] = [];
  for (const n of nodes) {
    out.push({ node: n, depth });
    if (n.type === "folder" && expanded.has(n.key)) {
      out.push(...flatten(n.children, expanded, depth + 1));
    }
  }
  return out;
}

export function allFolderKeys(nodes: PluginTreeNode[]): Set<string> {
  const set = new Set<string>();
  const walk = (list: PluginTreeNode[]) => {
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