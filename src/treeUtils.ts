import { NodeId, ServerFolder, ServerLeaf, ServerNode } from "./types";

export const isFolder = (n: ServerNode): n is ServerFolder => n.kind === "folder";
export const isServer = (n: ServerNode): n is ServerLeaf => n.kind === "server";

export function findNode(nodes: ServerNode[], id: NodeId): ServerNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (isFolder(n)) {
      const hit = findNode(n.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

export function findPath(nodes: ServerNode[], id: NodeId): ServerNode[] {
  for (const n of nodes) {
    if (n.id === id) return [n];
    if (isFolder(n)) {
      const sub = findPath(n.children, id);
      if (sub.length) return [n, ...sub];
    }
  }
  return [];
}

export function removeNode(nodes: ServerNode[], id: NodeId): ServerNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => (isFolder(n) ? { ...n, children: removeNode(n.children, id) } : n));
}

export function updateNode(
  nodes: ServerNode[],
  id: NodeId,
  patch: Partial<ServerNode>,
): ServerNode[] {
  return nodes.map((n) => {
    if (n.id === id) {
      if (isFolder(n)) {
        const p = patch as Partial<ServerFolder>;
        return {
          ...n,
          name: p.name ?? n.name,
          children: p.children ?? n.children,
        };
      }
      const p = patch as Partial<ServerLeaf>;
      return {
        ...n,
        name: p.name ?? n.name,
        url: p.url ?? n.url,
        port: p.port ?? n.port,
      };
    }
    return isFolder(n) ? { ...n, children: updateNode(n.children, id, patch) } : n;
  });
}

export function insertChild(
  nodes: ServerNode[],
  parentId: NodeId | null,
  child: ServerNode,
): ServerNode[] {
  if (parentId === null) return [...nodes, child];
  return nodes.map((n) => {
    if (n.id === parentId && isFolder(n)) {
      return { ...n, children: [...n.children, child] };
    }
    return isFolder(n) ? { ...n, children: insertChild(n.children, parentId, child) } : n;
  });
}

export function isDescendant(nodes: ServerNode[], ancestorId: NodeId, id: NodeId): boolean {
  const anc = findNode(nodes, ancestorId);
  return !!anc && isFolder(anc) && findNode(anc.children, id) !== null;
}

export function moveNode(
  nodes: ServerNode[],
  id: NodeId,
  newParentId: NodeId | null,
): ServerNode[] {
  if (id === newParentId) return nodes;
  if (newParentId && isDescendant(nodes, id, newParentId)) return nodes;

  const node = findNode(nodes, id);
  if (!node) return nodes;
  const without = removeNode(nodes, id);
  return insertChild(without, newParentId, node);
}

export function walkLeaves(nodes: ServerNode[]): ServerLeaf[] {
  const out: ServerLeaf[] = [];
  for (const n of nodes) {
    if (isServer(n)) out.push(n);
    else out.push(...walkLeaves(n.children));
  }
  return out;
}

export function collectIds(nodes: ServerNode[]): NodeId[] {
  return nodes.flatMap((n) => [n.id, ...(isFolder(n) ? collectIds(n.children) : [])]);
}

export function listFolders(
  nodes: ServerNode[],
  depth = 0,
): Array<{ id: NodeId; name: string; depth: number }> {
  const out: Array<{ id: NodeId; name: string; depth: number }> = [];
  for (const n of nodes) {
    if (isFolder(n)) {
      out.push({ id: n.id, name: n.name, depth });
      out.push(...listFolders(n.children, depth + 1));
    }
  }
  return out;
}

export const makeId = () =>
  crypto.randomUUID?.() ??
  `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;