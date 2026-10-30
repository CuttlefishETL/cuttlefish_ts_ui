import { useCallback, useEffect, useRef, useState } from "react";
import type { PluginsApi } from "./api";
import type { PluginListItem, PluginStatus } from "./types";

export function usePlugins(api: PluginsApi) {
  const [plugins, setPlugins] = useState<PluginListItem[]>([]);
  const [status, setStatus] = useState<PluginStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const abortRef = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const [list, st] = await Promise.all([
        api.list(ctrl.signal),
        api.status(ctrl.signal),
      ]);
      setPlugins(list);
      setStatus(st);
      setStale(false);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
      setStale(plugins.length > 0);
    } finally {
      setLoading(false);
    }
  }, [api, plugins.length]);

  useEffect(() => {
    void reload();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const runOp = useCallback(
    async (id: string, fn: () => Promise<void>): Promise<string | null> => {
      setBusyIds((s) => new Set(s).add(id));
      try {
        await fn();
        return null;
      } catch (e) {
        return (e as Error).message;
      } finally {
        setBusyIds((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        try {
          const [list, st] = await Promise.all([api.list(), api.status()]);
          setPlugins(list);
          setStatus(st);
        } catch {
          /* ignore */
        }
      }
    },
    [api],
  );

  const toggle = useCallback(
    async (p: PluginListItem): Promise<string | null> => {
      setPlugins((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, enabled: !x.enabled } : x)),
      );
      return runOp(p.id, () => api.toggle(p.id));
    },
    [api, runOp],
  );

  const load = useCallback(
    (id: string) => runOp(id, () => api.load(id)),
    [api, runOp],
  );

  const unload = useCallback(
    (id: string) => runOp(id, () => api.unload(id)),
    [api, runOp],
  );

  const remove = useCallback(
    (id: string) => runOp(id, () => api.remove(id)),
    [api, runOp],
  );

  return {
    plugins,
    status,
    loading,
    error,
    stale,
    busyIds,
    reload,
    toggle,
    load,
    unload,
    remove,
  };
}