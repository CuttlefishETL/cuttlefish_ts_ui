import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MetricsApi } from "./api";
import type { MetricItem } from "./types";

export interface MetricsStats {
  total: number;
  enabled: number;
  disabled: number;
}

export function useMetrics(api: MetricsApi | null) {
  const [sections, setSections] = useState<Record<string, MetricItem[]>>({});
  const [stats, setStats] = useState<MetricsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const [reloading, setReloading] = useState(false);

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
      const [sectionsData, statsData] = await Promise.all([
        api.getSections(ctrl.signal),
        api.getStats(ctrl.signal),
      ]);
      setSections(sectionsData.sections);
      setStats({
        total: statsData.total,
        enabled: statsData.enabled,
        disabled: statsData.disabled,
      });
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

  /** `enabled` — Set<path> тех метрик, что сейчас включены. */
  const enabledPaths = useMemo(() => {
    const s = new Set<string>();
    for (const list of Object.values(sections)) {
      for (const m of list) if (m.enabled) s.add(m.path);
    }
    return s;
  }, [sections]);

  const markBusy = (key: string, on: boolean) => {
    setBusyKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const toggleMetric = useCallback(
    async (path: string, enabled: boolean) => {
      if (!api) return;
      markBusy(path, true);
      setSections((prev) => {
        const next: Record<string, MetricItem[]> = {};
        for (const [sec, list] of Object.entries(prev)) {
          next[sec] = list.map((m) =>
            m.path === path ? { ...m, enabled } : m,
          );
        }
        return next;
      });
      try {
        await api.setMetric(path, enabled);
      } catch (e) {
        setSections((prev) => {
          const next: Record<string, MetricItem[]> = {};
          for (const [sec, list] of Object.entries(prev)) {
            next[sec] = list.map((m) =>
              m.path === path ? { ...m, enabled: !enabled } : m,
            );
          }
          return next;
        });
        setError((e as Error).message);
      } finally {
        markBusy(path, false);
        // подтянуть актуальную статистику
        try {
          const statsData = await api.getStats();
          setStats({
            total: statsData.total,
            enabled: statsData.enabled,
            disabled: statsData.disabled,
          });
        } catch {
          /* ignore */
        }
      }
    },
    [api],
  );

  const toggleSection = useCallback(
    async (section: string, enabled: boolean) => {
      if (!api) return;
      const key = `section:${section}`;
      markBusy(key, true);
      setSections((prev) => {
        const cur = prev[section];
        if (!cur) return prev;
        return {
          ...prev,
          [section]: cur.map((m) => ({ ...m, enabled })),
        };
      });
      try {
        await api.setSection(section, enabled);
      } catch (e) {
        setError((e as Error).message);
        // точное состояние подтянем ниже из stats/sections
      } finally {
        markBusy(key, false);
        try {
          const statsData = await api.getStats();
          setStats({
            total: statsData.total,
            enabled: statsData.enabled,
            disabled: statsData.disabled,
          });
        } catch {
          /* ignore */
        }
      }
    },
    [api],
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
    stats,
    enabledPaths,
    loading,
    error,
    busyKeys,
    reloading,
    reload,
    reloadFromFile,
    toggleMetric,
    toggleSection,
  };
}