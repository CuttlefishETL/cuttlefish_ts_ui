import { useEffect, useState, useCallback } from "react";

const RECENT_KEY = "recent-files";
const MAX_RECENT = 8;

function loadRecentFiles(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return arr
        .filter((x): x is string => typeof x === "string")
        .slice(0, MAX_RECENT);
    }
  } catch {
    // ignore
  }
  return [];
}

export interface UseRecentFilesResult {
  recentFiles: string[];
  addRecent: (path: string) => void;
  removeRecent: (path: string) => void;
}

export function useRecentFiles(): UseRecentFilesResult {
  const [recentFiles, setRecentFiles] = useState<string[]>(loadRecentFiles);

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentFiles));
  }, [recentFiles]);

  const addRecent = useCallback((path: string) => {
    setRecentFiles((prev) =>
      [path, ...prev.filter((p) => p !== path)].slice(0, MAX_RECENT),
    );
  }, []);

  const removeRecent = useCallback((path: string) => {
    setRecentFiles((prev) => prev.filter((p) => p !== path));
  }, []);

  return { recentFiles, addRecent, removeRecent };
}