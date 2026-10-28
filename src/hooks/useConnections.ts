import { useCallback, useEffect, useRef, useState } from "react";
import type { Server, ServerNode } from "../types";
import { checkConnection, type CheckStatus } from "../checkConnection";
import { findServerById, flattenServers } from "../treeUtils";
import type { AppSettings } from "../appSettings";

export interface UseConnectionsResult {
  checkStatuses: Record<string, CheckStatus>;
  connectedIds: Set<string>;
  refreshing: boolean;
  authTarget: Server | null;
  runChecks: (list: Server[]) => Promise<void>;
  refresh: (servers: ServerNode[]) => Promise<void>;
  connect: (id: string, servers: ServerNode[]) => void;
  disconnect: (id: string) => void;
  reconnect: (id: string, servers: ServerNode[]) => void;
  serverDoubleClick: (id: string, servers: ServerNode[]) => void;
  submitAuth: () => void;
  cancelAuth: () => void;
  reset: () => void;
  removeIds: (ids: Set<string>) => void;
}

export function useConnections(
  servers: ServerNode[],
  appSettings: AppSettings,
): UseConnectionsResult {
  const [checkStatuses, setCheckStatuses] = useState<
    Record<string, CheckStatus>
  >({});
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [authTarget, setAuthTarget] = useState<Server | null>(null);

  const serversRef = useRef(servers);
  serversRef.current = servers;

  const runChecks = useCallback(async (list: Server[]): Promise<void> => {
    if (list.length === 0) return;
    setCheckStatuses((prev) => {
      const next = { ...prev };
      list.forEach((s) => {
        next[s.id] = "checking";
      });
      return next;
    });
    await Promise.all(
      list.map(async (s) => {
        const res = await checkConnection(s.url, s.port);
        setCheckStatuses((prev) => ({ ...prev, [s.id]: res.status }));
      }),
    );
  }, []);

  const refresh = useCallback(
    async (current: ServerNode[]): Promise<void> => {
      const list = flattenServers(current);
      if (list.length === 0) return;
      setRefreshing(true);
      try {
        await runChecks(list);
      } finally {
        setRefreshing(false);
      }
    },
    [runChecks],
  );

  const connect = useCallback(
    (id: string, current: ServerNode[]): void => {
      if (connectedIds.has(id)) return;
      const server = findServerById(current, id);
      if (server) setAuthTarget(server);
    },
    [connectedIds],
  );

  const disconnect = useCallback((id: string): void => {
    setConnectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const reconnect = useCallback(
    (id: string, current: ServerNode[]): void => {
      setConnectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      const server = findServerById(current, id);
      if (server) setAuthTarget(server);
    },
    [],
  );

  const serverDoubleClick = useCallback(
    (id: string, current: ServerNode[]): void => {
      if (connectedIds.has(id)) return;
      connect(id, current);
    },
    [connectedIds, connect],
  );

  const submitAuth = useCallback((): void => {
    if (!authTarget) return;
    const id = authTarget.id;
    setConnectedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setAuthTarget(null);
  }, [authTarget]);

  const cancelAuth = useCallback((): void => {
    setAuthTarget(null);
  }, []);

  const reset = useCallback((): void => {
    setCheckStatuses({});
    setConnectedIds(new Set());
    setAuthTarget(null);
  }, []);

  const removeIds = useCallback((ids: Set<string>): void => {
    setCheckStatuses((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      return next;
    });
    setConnectedIds((prev) => {
      if (![...ids].some((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setAuthTarget((cur) => (cur && ids.has(cur.id) ? null : cur));
  }, []);

  // Периодический health-poll
  const runChecksRef = useRef(runChecks);
  runChecksRef.current = runChecks;

  useEffect(() => {
    const interval = appSettings.healthPollIntervalSec * 1000;
    if (interval <= 0) return;
    const id = setInterval(() => {
      const list = flattenServers(serversRef.current);
      void runChecksRef.current(list);
    }, interval);
    return () => clearInterval(id);
  }, [appSettings.healthPollIntervalSec]);

  return {
    checkStatuses,
    connectedIds,
    refreshing,
    authTarget,
    runChecks,
    refresh,
    connect,
    disconnect,
    reconnect,
    serverDoubleClick,
    submitAuth,
    cancelAuth,
    reset,
    removeIds,
  };
}