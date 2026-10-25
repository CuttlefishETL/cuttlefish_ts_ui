import type {
  NodeId,
  Server,
  ServerFolder,
  ServerLeaf,
  ServerNode,
} from "./types";

export const isFolder = (n: ServerNode): n is ServerFolder => n.kind === "folder";
export const isServerNode = (n: ServerNode): n is ServerLeaf => n.kind === "server";
export const isServer = isServerNode; // старый алиас
export const findNode = findNodeById; // старый алиас (объявлен ниже)

export function flattenServers(nodes: ServerNode[]): ServerLeaf[] {
  const out: ServerLeaf[] = [];
  for (const n of nodes) {
    if (isFolder(n)) out.push(...flattenServers(n.children));
    else out.push(n);
  }
  return out;
}

export function findNodeById(nodes: ServerNode[], id: NodeId): ServerNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (isFolder(n)) {
      const hit = findNodeById(n.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

export function findServerById(nodes: ServerNode[], id: NodeId): ServerLeaf | null {
  const n = findNodeById(nodes, id);
  return n && isServerNode(n) ? n : null;
}

export function insertNode(
  nodes: ServerNode[],
  parentId: NodeId | null,
  child: ServerNode,
): ServerNode[] {
  if (parentId === null) return [...nodes, child];
  return nodes.map((n) => {
    if (isFolder(n)) {
      if (n.id === parentId) return { ...n, children: [...n.children, child] };
      return { ...n, children: insertNode(n.children, parentId, child) };
    }
    return n;
  });
}

export function removeNode(nodes: ServerNode[], id: NodeId): ServerNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) =>
      isFolder(n) ? { ...n, children: removeNode(n.children, id) } : n,
    );
}

export function updateServer(
  nodes: ServerNode[],
  id: NodeId,
  patch: Partial<Server>,
): ServerNode[] {
  return nodes.map((n) => {
    if (isFolder(n)) {
      return { ...n, children: updateServer(n.children, id, patch) };
    }
    return n.id === id ? { ...n, ...patch } : n;
  });
}

export function updateNodeName(
  nodes: ServerNode[],
  id: NodeId,
  name: string,
): ServerNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, name };
    if (isFolder(n)) {
      return { ...n, children: updateNodeName(n.children, id, name) };
    }
    return n;
  });
}

export function countServersIn(node: ServerNode): number {
  if (isFolder(node)) {
    return node.children.reduce((s, c) => s + countServersIn(c), 0);
  }
  return 1;
}

export function collectIds(nodes: ServerNode[]): NodeId[] {
  const out: NodeId[] = [];
  for (const n of nodes) {
    out.push(n.id);
    if (isFolder(n)) out.push(...collectIds(n.children));
  }
  return out;
}

export function collectFolderIds(nodes: ServerNode[]): NodeId[] {
  const out: NodeId[] = [];
  for (const n of nodes) {
    if (isFolder(n)) {
      out.push(n.id);
      out.push(...collectFolderIds(n.children));
    }
  }
  return out;
}

function findParentId(
  nodes: ServerNode[],
  id: NodeId,
): NodeId | null | undefined {
  for (const n of nodes) {
    if (n.id === id) return null;
    if (isFolder(n)) {
      if (n.children.some((c) => c.id === id)) return n.id;
      const deeper = findParentId(n.children, id);
      if (deeper !== undefined) return deeper;
    }
  }
  return undefined;
}

export function moveNode(
  nodes: ServerNode[],
  nodeId: NodeId,
  newParentId: NodeId | null,
): ServerNode[] {
  if (nodeId === newParentId) return nodes;

  const node = findNodeById(nodes, nodeId);
  if (!node) return nodes;

  if (isFolder(node) && newParentId !== null) {
    if (findNodeById(node.children, newParentId)) return nodes;
  }
  if (newParentId !== null && !findNodeById(nodes, newParentId)) return nodes;

  const currentParent = findParentId(nodes, nodeId);
  if (currentParent === newParentId) return nodes;

  const without = removeNode(nodes, nodeId);
  return insertNode(without, newParentId, node);
}