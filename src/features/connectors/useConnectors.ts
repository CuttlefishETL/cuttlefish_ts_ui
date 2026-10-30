import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConnectorsApi } from "./api";
import type {
  ConnectorInstance,
  ConnectorStatus,
  ConnectorTemplate,
} from "./types";

export function useConnectors(api: ConnectorsApi) {
  const [items, setItems] = useState<ConnectorInstance[]>([]);
  const [templates, setTemplates] = useState<ConnectorTemplate[]>([]);
  const [status, setStatus] = useState<ConnectorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, tpl, st] = await Promise.all([
        api.list(),
        api.listTemplates(),
        api.status(),
      ]);
      setItems(list);
      setTemplates(tpl);
      setStatus(st);
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

  const templatesByType = useMemo(
    () => Object.fromEntries(templates.map((t) => [t.type, t])),
    [templates],
  );

  const toggleEnabled = useCallback(
    async (c: ConnectorInstance): Promise<string | null> => {
      // оптимистичное обновление
      setItems((prev) =>
        prev.map((x) =>
          x.name === c.name ? { ...x, enabled: !x.enabled } : x,
        ),
      );
      try {
        await api.update(c.name, {
          name: c.name,
          type: c.type,
          enabled: !c.enabled,
          description: c.description,
          direction: c.direction,
          tags: c.tags,
          params: c.params,
        });
        return null;
      } catch (e) {
        // откат
        setItems((prev) =>
          prev.map((x) =>
            x.name === c.name ? { ...x, enabled: c.enabled } : x,
          ),
        );
        return (e as Error).message;
      }
    },
    [api],
  );

  return {
    items,
    templates,
    templatesByType,
    status,
    loading,
    error,
    reload,
    toggleEnabled,
  };
}