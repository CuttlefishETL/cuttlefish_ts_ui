import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConnectorsApi } from "./api";
import type {
  ConnectorInstance,
  ConnectorStatus,
  ConnectorTemplate,
} from "./types";
import {
  getConnectorFolder,
  isDescendantOrSelf,
  parentPath,
} from "./types";

export function useConnectors(api: ConnectorsApi) {
  const [items, setItems] = useState<ConnectorInstance[]>([]);
  const [templates, setTemplates] = useState<ConnectorTemplate[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [status, setStatus] = useState<ConnectorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, tpl, st, fl] = await Promise.all([
        api.list(),
        api.listTemplates(),
        api.status(),
        api.listFolders(),
      ]);

      const merged = new Set(fl);
      for (const c of list) {
        const f = getConnectorFolder(c);
        if (!f) continue;
        const parts = f.split("/").filter(Boolean);
        for (let i = 1; i <= parts.length; i++) {
          merged.add(parts.slice(0, i).join("/"));
        }
      }

      setItems(list);
      setTemplates(tpl);
      setStatus(st);
      setFolders(Array.from(merged).sort());
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
          metadata: c.metadata,
        });
        return null;
      } catch (e) {
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

  const createFolder = useCallback(
    async (path: string): Promise<string | null> => {
      const trimmed = path.trim().replace(/\/+$/, "");
      if (!trimmed) return "Имя папки не задано";
      if (folders.includes(trimmed)) return "Папка уже существует";
      const next = [...folders, trimmed].sort();
      try {
        await api.saveFolders(next);
        setFolders(next);
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    [api, folders],
  );

  const deleteFolder = useCallback(
    async (path: string): Promise<string | null> => {
      const affected = items.filter((c) =>
        isDescendantOrSelf(getConnectorFolder(c), path),
      );
      if (affected.length > 0) {
        return `Папка не пуста: ${affected.length} коннектор(ов). Переместите или удалите их сначала.`;
      }
      const subfolders = folders.filter(
        (p) => p !== path && isDescendantOrSelf(p, path),
      );
      if (subfolders.length > 0) {
        return `Папка содержит ${subfolders.length} вложенную(ых) папку(и). Удалите их сначала.`;
      }
      const next = folders.filter((p) => p !== path);
      try {
        await api.saveFolders(next);
        setFolders(next);
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    [api, folders, items],
  );

  const renameFolder = useCallback(
    async (oldPath: string, newName: string): Promise<string | null> => {
      const trimmed = newName.trim();
      if (!trimmed) return "Имя не задано";
      if (trimmed.includes("/")) return "Имя не должно содержать /";

      const newPath = parentPath(oldPath)
        ? `${parentPath(oldPath)}/${trimmed}`
        : trimmed;

      if (newPath === oldPath) return null;
      if (folders.includes(newPath)) return "Папка с таким именем уже существует";

      const nextFolders = folders.map((p) => {
        if (p === oldPath) return newPath;
        if (p.startsWith(oldPath + "/")) {
          return newPath + p.slice(oldPath.length);
        }
        return p;
      });
      if (!nextFolders.includes(newPath)) nextFolders.push(newPath);

      const affected = items.filter((c) => {
        const f = getConnectorFolder(c);
        return isDescendantOrSelf(f, oldPath);
      });

      try {
        await api.saveFolders(nextFolders.sort());
        setFolders(nextFolders.sort());

        for (const c of affected) {
          const oldFolder = getConnectorFolder(c);
          const newFolder = oldFolder.startsWith(oldPath + "/")
            ? newPath + oldFolder.slice(oldPath.length)
            : newPath;
          await api.update(c.name, {
            name: c.name,
            type: c.type,
            enabled: c.enabled,
            description: c.description,
            direction: c.direction,
            tags: c.tags,
            params: c.params,
            metadata: { ...(c.metadata ?? {}), folder: newFolder },
          });
        }
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    [api, folders, items],
  );

  const moveConnector = useCallback(
    async (name: string, targetFolder: string): Promise<string | null> => {
      const c = items.find((x) => x.name === name);
      if (!c) return "Коннектор не найден";
      const currentFolder = getConnectorFolder(c);
      if (currentFolder === targetFolder) return null;

      try {
        await api.update(name, {
          name: c.name,
          type: c.type,
          enabled: c.enabled,
          description: c.description,
          direction: c.direction,
          tags: c.tags,
          params: c.params,
          metadata: { ...(c.metadata ?? {}), folder: targetFolder },
        });
        if (targetFolder && !folders.includes(targetFolder)) {
          const next = [...folders, targetFolder].sort();
          await api.saveFolders(next);
          setFolders(next);
        }
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    [api, folders, items],
  );

  const moveFolder = useCallback(
    async (
      sourcePath: string,
      targetParent: string,
    ): Promise<string | null> => {
      if (sourcePath === targetParent) return null;
      if (
        targetParent === sourcePath ||
        targetParent.startsWith(sourcePath + "/")
      ) {
        return "Нельзя переместить папку внутрь себя";
      }

      const lastSegment = sourcePath.split("/").pop() ?? sourcePath;
      const newPath = targetParent
        ? `${targetParent}/${lastSegment}`
        : lastSegment;

      if (newPath === sourcePath) return null;
      if (folders.includes(newPath)) {
        return "Папка с таким именем уже существует в целевой папке";
      }

      const nextFolders = folders.map((p) => {
        if (p === sourcePath) return newPath;
        if (p.startsWith(sourcePath + "/")) {
          return newPath + p.slice(sourcePath.length);
        }
        return p;
      });

      const affected = items.filter((c) => {
        const f = getConnectorFolder(c);
        return isDescendantOrSelf(f, sourcePath);
      });

      try {
        await api.saveFolders(nextFolders.sort());
        setFolders(nextFolders.sort());

        for (const c of affected) {
          const oldFolder = getConnectorFolder(c);
          const newFolder = oldFolder.startsWith(sourcePath + "/")
            ? newPath + oldFolder.slice(sourcePath.length)
            : newPath;
          await api.update(c.name, {
            name: c.name,
            type: c.type,
            enabled: c.enabled,
            description: c.description,
            direction: c.direction,
            tags: c.tags,
            params: c.params,
            metadata: { ...(c.metadata ?? {}), folder: newFolder },
          });
        }
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    [api, folders, items],
  );

  return {
    items,
    templates,
    templatesByType,
    folders,
    status,
    loading,
    error,
    reload,
    toggleEnabled,
    createFolder,
    deleteFolder,
    renameFolder,
    moveConnector,
    moveFolder,
  };
}