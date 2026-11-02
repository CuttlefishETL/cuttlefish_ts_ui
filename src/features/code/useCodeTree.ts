import { useCallback, useEffect, useState } from "react";
import type { CodeTreeNode } from "./types";
import {
  getCachedCodeTree,
  hasCachedCodeTree,
  loadCodeTree,
} from "./api";

export interface UseCodeTreeOptions {
  /**
   * Автоматически загружать дерево при монтировании хука.
   * По умолчанию `true` (нужно для code-editor'а).
   * Cron передаёт `false` — грузим только при открытии picker'а.
   */
  autoLoad?: boolean;
}

export interface UseCodeTreeResult {
  tree: CodeTreeNode[];
  loading: boolean;
  error: string | null;
  /** Перезапросить. По умолчанию `force = true`. */
  reload: (force?: boolean) => Promise<void>;
}

export function useCodeTree(
  baseUrl: string,
  opts: UseCodeTreeOptions = {},
): UseCodeTreeResult {
  const autoLoad = opts.autoLoad ?? true;

  const [tree, setTree] = useState<CodeTreeNode[]>(
    () => getCachedCodeTree(baseUrl) ?? [],
  );
  const [loading, setLoading] = useState(
    autoLoad && !hasCachedCodeTree(baseUrl),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoLoad) return;

    const cached = getCachedCodeTree(baseUrl);
    if (cached) {
      setTree(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    loadCodeTree(baseUrl, { force: false })
      .then((data) => {
        if (alive) setTree(data);
      })
      .catch((e) => {
        if (alive) setError((e as Error).message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [baseUrl, autoLoad]);

  const reload = useCallback(
    async (force = true) => {
      setLoading(true);
      setError(null);
      try {
        const data = await loadCodeTree(baseUrl, { force });
        setTree(data);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [baseUrl],
  );

  return { tree, loading, error, reload };
}