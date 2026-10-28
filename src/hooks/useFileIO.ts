import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import type { ServerNode } from "../types";
import { parseSettings, serialize } from "../settingsFile";

const FILE_KEY = "current-settings-file";

export interface UseFileIOResult {
  currentFilePath: string | null;
  dirty: boolean;
  saveAs: (servers: ServerNode[]) => Promise<boolean>;
  saveToCurrent: (servers: ServerNode[]) => Promise<boolean>;
  newFile: () => void;
  loadInitial: () => Promise<ServerNode[] | null>;
  openFile: () => Promise<ServerNode[] | null>;
  openRecent: (path: string) => Promise<ServerNode[] | null>;
  markDirty: () => void;
}

export function useFileIO(
  addRecent: (path: string) => void,
  removeRecent: (path: string) => void,
): UseFileIOResult {
  const initialPathRef = useRef<string | null>(
    localStorage.getItem(FILE_KEY),
  );
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(
    initialPathRef.current,
  );
  const [dirty, setDirty] = useState(false);

  const markDirty = useCallback(() => setDirty(true), []);

  const loadFromPath = useCallback(
    async (path: string): Promise<ServerNode[] | null> => {
      try {
        const text = await invoke<string>("read_file", { path });
        const loaded = parseSettings(text);
        setCurrentFilePath(path);
        localStorage.setItem(FILE_KEY, path);
        setDirty(false);
        addRecent(path);
        return loaded;
      } catch (err) {
        console.warn(`Не удалось открыть файл ${path}:`, err);
        return null;
      }
    },
    [addRecent],
  );

  const loadInitial = useCallback(async (): Promise<ServerNode[] | null> => {
    const path = initialPathRef.current;
    if (!path) return null;
    const loaded = await loadFromPath(path);
    if (!loaded) {
      localStorage.removeItem(FILE_KEY);
      setCurrentFilePath(null);
      removeRecent(path);
    }
    return loaded;
  }, [loadFromPath, removeRecent]);

  const saveAs = useCallback(
    async (servers: ServerNode[]): Promise<boolean> => {
      try {
        const path = await saveDialog({
          title: "Сохранить файл настроек",
          defaultPath: currentFilePath ?? "servers.json",
          filters: [{ name: "JSON", extensions: ["json"] }],
        });
        if (!path || typeof path !== "string") return false;
        await invoke("write_file", { path, content: serialize(servers) });
        setCurrentFilePath(path);
        localStorage.setItem(FILE_KEY, path);
        setDirty(false);
        addRecent(path);
        return true;
      } catch (err) {
        alert(`Не удалось сохранить файл: ${err}`);
        return false;
      }
    },
    [currentFilePath, addRecent],
  );

  const saveToCurrent = useCallback(
    async (servers: ServerNode[]): Promise<boolean> => {
      if (!currentFilePath) return saveAs(servers);
      try {
        await invoke("write_file", {
          path: currentFilePath,
          content: serialize(servers),
        });
        setDirty(false);
        return true;
      } catch (err) {
        alert(`Не удалось сохранить файл: ${err}`);
        return false;
      }
    },
    [currentFilePath, saveAs],
  );

  const newFile = useCallback(() => {
    setCurrentFilePath(null);
    localStorage.removeItem(FILE_KEY);
    setDirty(false);
  }, []);

  const openFile = useCallback(async (): Promise<ServerNode[] | null> => {
    try {
      const path = await openDialog({
        title: "Открыть файл настроек",
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path || typeof path !== "string") return null;
      return await loadFromPath(path);
    } catch (err) {
      alert(`Не удалось открыть файл: ${err}`);
      return null;
    }
  }, [loadFromPath]);

  const openRecent = useCallback(
    async (path: string): Promise<ServerNode[] | null> => {
      const loaded = await loadFromPath(path);
      if (!loaded) removeRecent(path);
      return loaded;
    },
    [loadFromPath, removeRecent],
  );

  return {
    currentFilePath,
    dirty,
    saveAs,
    saveToCurrent,
    newFile,
    loadInitial,
    openFile,
    openRecent,
    markDirty,
  };
}