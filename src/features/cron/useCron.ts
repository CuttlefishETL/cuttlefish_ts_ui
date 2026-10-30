import { useCallback, useEffect, useState } from "react";
import type { CronApi } from "./api";
import type { CodeTreeNode, CronEntry } from "./types";

export function useCron(api: CronApi) {
  const [items, setItems] = useState<CronEntry[]>([]);
  const [scripts, setScripts] = useState<CodeTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, tree] = await Promise.all([api.list(), api.listScripts()]);
      setItems(list);
      setScripts(tree);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const toggleEnabled = useCallback(
    async (task: CronEntry): Promise<string | null> => {
      const next = { ...task, enabled: !task.enabled };
      setItems((prev) =>
        prev.map((x) => (x.name === task.name ? next : x)),
      );
      try {
        await api.update(task.name, next);
        return null;
      } catch (e) {
        setItems((prev) =>
          prev.map((x) => (x.name === task.name ? task : x)),
        );
        return (e as Error).message;
      }
    },
    [api],
  );

  return { items, scripts, loading, error, reload, toggleEnabled };
}