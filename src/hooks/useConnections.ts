import { useCallback, useEffect, useRef, useState } from "react";
import type { Server, ServerNode } from "../types";
import {
  checkConnection,
  buildBaseUrl,
  type CheckStatus,
} from "../checkConnection";
import { findServerById, flattenServers } from "../treeUtils";
import type { AppSettings } from "../appSettings";
import { getToken, logout } from "../api/auth";

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

  // Восстанавливаем connectedIds из сохранённых токенов при каждом изменении
  // списка серверов (открыли файл, добавили/удалили сервер, поменяли URL).
  useEffect(() => {
    const flat = flattenServers(servers);
    const byId = new Map(flat.map((s) => [s.id, s] as const));

    setConnectedIds((prev) => {
      let changed = false;
      const next = new Set(prev);

      for (const s of flat) {
        if (next.has(s.id)) continue;
        try {
          if (getToken(buildBaseUrl(s.url, s.port))) {
            next.add(s.id);
            changed = true;
          }
        } catch {
          // некорректный URL — пропускаем
        }
      }

      // Убираем id, которых больше нет в списке, либо чей токен был стёрт извне.
      for (const id of [...next]) {
        const s = byId.get(id);
        if (!s) {
          next.delete(id);
          changed = true;
          continue;
        }
        try {
          if (!getToken(buildBaseUrl(s.url, s.port))) {
            next.delete(id);
            changed = true;
          }
        } catch {
          next.delete(id);
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [servers]);

  const connect = useCallback(
    (id: string, current: ServerNode[]): void => {
      if (connectedIds.has(id)) return;
      const server = findServerById(current, id);
      if (!server) return;

      // Если токен уже сохранён — считаем подключённым без диалога.
      try {
        if (getToken(buildBaseUrl(server.url, server.port))) {
          setConnectedIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
          });
          return;
        }
      } catch {
        // упадём в открытие диалога
      }

      setAuthTarget(server);
    },
    [connectedIds],
  );

  const disconnect = useCallback((id: string): void => {
    const server = findServerById(serversRef.current, id);
    if (server) {
      try {
        logout(buildBaseUrl(server.url, server.port));
      } catch {
        // некорректный URL — нечего чистить
      }
    }
    setConnectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const reconnect = useCallback(
    (id: string, current: ServerNode[]): void => {
      const server = findServerById(current, id);
      if (server) {
        try {
          logout(buildBaseUrl(server.url, server.port));
        } catch {
          // некорректный URL
        }
      }
      setConnectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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
    setAuthTarget(null);
    // connectedIds намеренно не трогаем: их согласует effect выше, когда
    // изменится `servers` (например, при загрузке нового файла).
    // Токены в localStorage тоже сохраняются — они привязаны к URL, а не к файлу.
  }, []);

  const removeIds = useCallback((ids: Set<string>): void => {
    // Чистим токены удаляемых серверов, пока их дескрипторы ещё доступны.
    for (const s of flattenServers(serversRef.current)) {
      if (!ids.has(s.id)) continue;
      try {
        logout(buildBaseUrl(s.url, s.port));
      } catch {
        // некорректный URL
      }
    }
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

  // Реакция на 401 из интерсептора: сервер снимается с «подключён».
  useEffect(() => {
    const onExpired = (e: Event) => {
      const baseUrl = (e as CustomEvent<{ baseUrl: string }>).detail?.baseUrl;
      if (!baseUrl) return;
      const match = flattenServers(serversRef.current).find((s) => {
        try {
          return buildBaseUrl(s.url, s.port) === baseUrl;
        } catch {
          return false;
        }
      });
      if (!match) return;
      setConnectedIds((prev) => {
        if (!prev.has(match.id)) return prev;
        const next = new Set(prev);
        next.delete(match.id);
        return next;
      });
    };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  // Периодический health-poll (без изменений)
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