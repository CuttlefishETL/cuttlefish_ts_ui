import { useCallback, useMemo, useRef, useState } from "react";
import type { Server, ServerLeaf, ServerNode } from "../types";
import { INITIAL_SERVERS, createFolder, createServer } from "../data";
import {
  collectIds,
  countServersIn,
  findNodeById,
  flattenServers,
  insertNode,
  moveNode,
  removeNode,
  updateNodeName,
  updateServer,
} from "../treeUtils";

export interface UseServersResult {
  servers: ServerNode[];
  setServers: React.Dispatch<React.SetStateAction<ServerNode[]>>;
  flatServers: ServerLeaf[];
  savedServers: Set<string>;
  pendingDelete: ServerNode | null;
  pendingDeleteIsFolder: boolean;
  pendingDeleteCount: number;
  addServer: (parentId: string | null) => ServerLeaf;
  addFolder: (parentId: string | null) => ServerNode;
  rename: (id: string, name: string) => void;
  move: (id: string, newParentId: string | null) => boolean;
  update: (id: string, patch: Partial<Server>) => void;
  askDelete: (id: string) => void;
  confirmDelete: () => Set<string> | null;
  cancelDelete: () => void;
  markUnsaved: (id: string) => void;
  markAllSaved: () => void;
  applyLoaded: (loaded: ServerNode[]) => void;
  reset: () => void;
}

export function useServers(): UseServersResult {
  const [servers, setServers] = useState<ServerNode[]>(INITIAL_SERVERS);
  const [savedServers, setSavedServers] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<ServerNode | null>(null);

  const serversRef = useRef(servers);
  serversRef.current = servers;

  const flatServers = useMemo(() => flattenServers(servers), [servers]);

  const addServer = useCallback((parentId: string | null): ServerLeaf => {
    const server = createServer();
    setServers((prev) => insertNode(prev, parentId, server));
    return server;
  }, []);

  const addFolder = useCallback((parentId: string | null): ServerNode => {
    const folder = createFolder();
    setServers((prev) => insertNode(prev, parentId, folder));
    return folder;
  }, []);

  const rename = useCallback((id: string, name: string) => {
    setServers((prev) => updateNodeName(prev, id, name));
  }, []);

  const move = useCallback(
    (id: string, newParentId: string | null): boolean => {
      const prev = serversRef.current;
      const next = moveNode(prev, id, newParentId);
      if (next === prev) return false;
      setServers(next);
      return true;
    },
    [],
  );

  const update = useCallback((id: string, patch: Partial<Server>) => {
    setServers((prev) => updateServer(prev, id, patch));
  }, []);

  const askDelete = useCallback((id: string) => {
    const node = findNodeById(serversRef.current, id);
    if (node) setPendingDelete(node);
  }, []);

  const confirmDelete = useCallback((): Set<string> | null => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return null;
    const ids = new Set(collectIds([target]));
    setServers((prev) => removeNode(prev, target.id));
    setSavedServers((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    return ids;
  }, [pendingDelete]);

  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  const markUnsaved = useCallback((id: string) => {
    setSavedServers((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const markAllSaved = useCallback(() => {
    setSavedServers(new Set(flattenServers(serversRef.current).map((s) => s.id)));
  }, []);

  const applyLoaded = useCallback((loaded: ServerNode[]) => {
    setServers(loaded);
    const flat = flattenServers(loaded);
    setSavedServers(new Set(flat.map((s) => s.id)));
    setPendingDelete(null);
  }, []);

  const reset = useCallback(() => {
    setServers([]);
    setSavedServers(new Set());
    setPendingDelete(null);
  }, []);

  const pendingDeleteIsFolder = pendingDelete?.kind === "folder";
  const pendingDeleteCount =
    pendingDelete && pendingDelete.kind === "folder"
      ? countServersIn(pendingDelete)
      : 0;

  return {
    servers,
    setServers,
    flatServers,
    savedServers,
    pendingDelete,
    pendingDeleteIsFolder,
    pendingDeleteCount,
    addServer,
    addFolder,
    rename,
    move,
    update,
    askDelete,
    confirmDelete,
    cancelDelete,
    markUnsaved,
    markAllSaved,
    applyLoaded,
    reset,
  };
}