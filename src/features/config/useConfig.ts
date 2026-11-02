import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConfigApi } from "./api";
import type { ConfigSections } from "./types";

export function useConfig(api: ConfigApi | null) {
  const [sections, setSections] = useState<ConfigSections>({});
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyPaths, setBusyPaths] = useState<Set<string>>(new Set());

  const abortRef = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    if (!api) {
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSections(ctrl.signal);
      setSections(data);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void reload();
    return () => abortRef.current?.abort();
  }, [reload]);

  const sectionNames = useMemo(
    () => Object.keys(sections).sort((a, b) => a.localeCompare(b)),
    [sections],
  );

  const updateParam = useCallback(
    async (
      path: string,
      value: unknown,
    ): Promise<{
      ok: boolean;
      message?: string;
      pendingRestart?: boolean;
    }> => {
      if (!api) return { ok: false, message: "Нет подключения" };
      setBusyPaths((prev) => new Set(prev).add(path));
      try {
        const r = await api.updateParam(path, value);
        await reload();
        return {
          ok: true,
          message: r.message,
          pendingRestart: !!(r.pending_restart || r.restart_required),
        };
      } catch (e) {
        return { ok: false, message: (e as Error).message };
      } finally {
        setBusyPaths((prev) => {
          const n = new Set(prev);
          n.delete(path);
          return n;
        });
      }
    },
    [api, reload],
  );

  const reloadFromFile = useCallback(async () => {
    if (!api) return;
    setReloading(true);
    try {
      await api.reload();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReloading(false);
    }
  }, [api, reload]);

  return {
    sections,
    sectionNames,
    loading,
    reloading,
    error,
    busyPaths,
    reload,
    reloadFromFile,
    updateParam,
  };
}