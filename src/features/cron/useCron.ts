import { useCallback, useEffect, useState } from "react";
import type { CronApi } from "./api";
import type { CodeTreeNode, CronEntry } from "./types";
import {
  getTaskSection,
  isDescendantOrSelf,
  parentPath,
} from "./types";

export function useCron(api: CronApi) {
  const [items, setItems] = useState<CronEntry[]>([]);
  const [scripts, setScripts] = useState<CodeTreeNode[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, tree, secs] = await Promise.all([
        api.list(),
        api.listScripts(),
        api.listSections(),
      ]);

      // Объединяем секции с теми, что упомянуты в задачах, включая промежуточные
      const merged = new Set(secs);
      for (const t of list) {
        const s = getTaskSection(t);
        if (!s) continue;
        const parts = s.split("/").filter(Boolean);
        for (let i = 1; i <= parts.length; i++) {
          merged.add(parts.slice(0, i).join("/"));
        }
      }

      setItems(list);
      setScripts(tree);
      setSections(Array.from(merged).sort());
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
      setItems((prev) => prev.map((x) => (x.name === task.name ? next : x)));
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

  const createSection = useCallback(
    async (path: string): Promise<string | null> => {
      const trimmed = path.trim().replace(/\/+$/, "");
      if (!trimmed) return "Имя секции не задано";
      if (sections.includes(trimmed)) return "Секция уже существует";
      const next = [...sections, trimmed].sort();
      try {
        await api.saveSections(next);
        setSections(next);
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    [api, sections],
  );

  const deleteSection = useCallback(
    async (path: string): Promise<string | null> => {
      const affected = items.filter((t) =>
        isDescendantOrSelf(getTaskSection(t), path),
      );
      if (affected.length > 0) {
        return `Секция не пуста: ${affected.length} задач(и). Переместите или удалите их сначала.`;
      }
      const subSections = sections.filter(
        (s) => s !== path && isDescendantOrSelf(s, path),
      );
      if (subSections.length > 0) {
        return `Секция содержит ${subSections.length} вложенную(ых) секцию(и). Удалите их сначала.`;
      }
      const next = sections.filter((s) => s !== path);
      try {
        await api.saveSections(next);
        setSections(next);
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    [api, sections, items],
  );

  const renameSection = useCallback(
    async (oldPath: string, newName: string): Promise<string | null> => {
      const trimmed = newName.trim();
      if (!trimmed) return "Имя не задано";
      if (trimmed.includes("/")) return "Имя не должно содержать /";

      const newPath = parentPath(oldPath)
        ? `${parentPath(oldPath)}/${trimmed}`
        : trimmed;

      if (newPath === oldPath) return null;
      if (sections.includes(newPath))
        return "Секция с таким именем уже существует";

      const nextSections = sections.map((s) => {
        if (s === oldPath) return newPath;
        if (s.startsWith(oldPath + "/")) {
          return newPath + s.slice(oldPath.length);
        }
        return s;
      });
      if (!nextSections.includes(newPath)) nextSections.push(newPath);

      const affected = items.filter((t) => {
        const s = getTaskSection(t);
        return isDescendantOrSelf(s, oldPath);
      });

      try {
        await api.saveSections(nextSections.sort());
        setSections(nextSections.sort());

        for (const t of affected) {
          const oldSec = getTaskSection(t);
          const newSec = oldSec.startsWith(oldPath + "/")
            ? newPath + oldSec.slice(oldPath.length)
            : newPath;
          await api.update(t.name, { ...t, section: newSec });
        }
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    [api, sections, items],
  );

  const moveTask = useCallback(
    async (name: string, targetSection: string): Promise<string | null> => {
      const t = items.find((x) => x.name === name);
      if (!t) return "Задача не найдена";
      if (getTaskSection(t) === targetSection) return null;

      try {
        await api.update(name, { ...t, section: targetSection });
        if (targetSection && !sections.includes(targetSection)) {
          const parts = targetSection.split("/").filter(Boolean);
          const toAdd: string[] = [];
          for (let i = 1; i <= parts.length; i++) {
            const p = parts.slice(0, i).join("/");
            if (!sections.includes(p) && !toAdd.includes(p)) toAdd.push(p);
          }
          const next = [...sections, ...toAdd].sort();
          await api.saveSections(next);
          setSections(next);
        }
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    [api, sections, items],
  );

  const moveSection = useCallback(
    async (
      sourcePath: string,
      targetParent: string,
    ): Promise<string | null> => {
      if (sourcePath === targetParent) return null;
      if (
        targetParent === sourcePath ||
        targetParent.startsWith(sourcePath + "/")
      ) {
        return "Нельзя переместить секцию внутрь себя";
      }

      const lastSegment = sourcePath.split("/").pop() ?? sourcePath;
      const newPath = targetParent
        ? `${targetParent}/${lastSegment}`
        : lastSegment;

      if (newPath === sourcePath) return null;
      if (sections.includes(newPath)) {
        return "Секция с таким именем уже существует в целевой секции";
      }

      const nextSections = sections.map((s) => {
        if (s === sourcePath) return newPath;
        if (s.startsWith(sourcePath + "/")) {
          return newPath + s.slice(sourcePath.length);
        }
        return s;
      });

      const affected = items.filter((t) => {
        const s = getTaskSection(t);
        return isDescendantOrSelf(s, sourcePath);
      });

      try {
        await api.saveSections(nextSections.sort());
        setSections(nextSections.sort());

        for (const t of affected) {
          const oldSec = getTaskSection(t);
          const newSec = oldSec.startsWith(sourcePath + "/")
            ? newPath + oldSec.slice(sourcePath.length)
            : newPath;
          await api.update(t.name, { ...t, section: newSec });
        }
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    [api, sections, items],
  );

  return {
    items,
    scripts,
    sections,
    loading,
    error,
    reload,
    toggleEnabled,
    createSection,
    deleteSection,
    renameSection,
    moveTask,
    moveSection,
  };
}