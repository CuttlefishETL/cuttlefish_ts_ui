import { useCallback, useEffect, useRef, useState } from "react";
import type { Server } from "../../types";
import { buildBaseUrl } from "../../checkConnection";
import { useCodeTree } from "../../features/code/useCodeTree";
import {
  deleteCodeFile,
  getCodeFile,
  saveCodeFile,
} from "../../features/code/api";
import { DebugToolbar } from "../script/DebugToolbar";
import { ScriptFileTree } from "../script/ScriptFileTree";
import { ScriptEditorTabs } from "../script/ScriptEditorTabs";
import { DebugPanels } from "../script/DebugPanels";
import { Splitter } from "../script/Splitter";
import { PromptDialog } from "../PromptDialog";
import type { BreakpointMap } from "../script/breakpointField";
import "../script/scripts.css";

interface OpenFile {
  path: string;
  name: string;
  content: string;
  dirty: boolean;
}

interface ScriptsTabProps {
  server: Server;
}

function validateNewPath(value: string): string | null {
  const v = value.trim();
  if (!v) return "Путь не задан";
  if (v.startsWith("/")) return "Путь не должен начинаться с /";
  if (v.endsWith("/")) return "Путь не должен заканчиваться на /";
  if (v.includes("//")) return "Путь не должен содержать //";
  if (v.split("/").some((seg) => seg === ".." || seg === ".")) {
    return "Недопустимые сегменты «..» или «.»";
  }
  const name = v.split("/").pop() ?? v;
  if (!name) return "Некорректное имя файла";
  return null;
}

export function ScriptsTab({ server }: ScriptsTabProps) {
  const baseUrl = (() => {
    try {
      return buildBaseUrl(server.url, server.port);
    } catch {
      return "";
    }
  })();

  const { tree, loading, error, reload } = useCodeTree(baseUrl);

  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [breakpointsByFile, setBreakpointsByFile] = useState<
    Record<string, BreakpointMap>
  >({});
  const [pendingScroll, setPendingScroll] = useState<{
    path: string;
    line: number;
  } | null>(null);

  const [treeWidth, setTreeWidth] = useState(220);
  const [topPercent, setTopPercent] = useState(55);
  const containerRef = useRef<HTMLDivElement>(null);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const inflightRef = useRef<Map<string, Promise<string>>>(new Map());

  // -------------------------------------------------------------------
  // Открыть файл
  // -------------------------------------------------------------------
  const openFile = useCallback(
    async (path: string): Promise<boolean> => {
      if (openFiles.some((f) => f.path === path)) {
        setActivePath(path);
        return true;
      }
      if (!baseUrl) {
        setToast("Не задан URL сервера");
        return false;
      }
      try {
        let req = inflightRef.current.get(path);
        if (!req) {
          req = getCodeFile(baseUrl, path);
          inflightRef.current.set(path, req);
          req.finally(() => inflightRef.current.delete(path));
        }
        const content = await req;
        const name = path.split("/").pop() ?? path;
        setOpenFiles((prev) => {
          if (prev.some((f) => f.path === path)) return prev;
          return [...prev, { path, name, content, dirty: false }];
        });
        setActivePath(path);
        return true;
      } catch (e) {
        setToast(`Не удалось открыть файл: ${(e as Error).message}`);
        return false;
      }
    },
    [baseUrl, openFiles],
  );

  const closeFile = useCallback(
    (path: string) => {
      const file = openFiles.find((f) => f.path === path);
      if (
        file?.dirty &&
        !window.confirm(
          `Файл «${file.name}» не сохранён. Закрыть без сохранения?`,
        )
      ) {
        return;
      }
      setOpenFiles((prev) => {
        const next = prev.filter((f) => f.path !== path);
        if (activePath === path) {
          setActivePath(next.length > 0 ? next[next.length - 1].path : null);
        }
        return next;
      });
    },
    [openFiles, activePath],
  );

  const changeFileContent = useCallback((path: string, content: string) => {
    setOpenFiles((prev) =>
      prev.map((f) =>
        f.path === path
          ? { ...f, content, dirty: f.content !== content || f.dirty }
          : f,
      ),
    );
  }, []);

  const saveFile = useCallback(
    async (path: string): Promise<boolean> => {
      const file = openFiles.find((f) => f.path === path);
      if (!file) return false;
      if (!baseUrl) {
        setToast("Не задан URL сервера");
        return false;
      }
      try {
        await saveCodeFile(baseUrl, path, file.content);
        setOpenFiles((prev) =>
          prev.map((f) => (f.path === path ? { ...f, dirty: false } : f)),
        );
        setToast(`Файл «${file.name}» сохранён`);
        return true;
      } catch (e) {
        setToast(`Ошибка сохранения: ${(e as Error).message}`);
        return false;
      }
    },
    [baseUrl, openFiles],
  );

  // -------------------------------------------------------------------
  // Создать / удалить / обновить
  // -------------------------------------------------------------------
  const handleAdd = useCallback(
    async (rawPath: string) => {
      const path = rawPath.trim();
      if (!baseUrl) {
        setToast("Не задан URL сервера");
        return;
      }
      setBusy(true);
      try {
        await saveCodeFile(baseUrl, path, "");
        setAddOpen(false);
        await reload(true);
        await openFile(path);
        setToast(`Файл «${path}» создан`);
      } catch (e) {
        setToast(`Не удалось создать файл: ${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [baseUrl, reload, openFile],
  );

  const handleDelete = useCallback(async () => {
    if (!activePath) return;
    const file = openFiles.find((f) => f.path === activePath);
    const name = file?.name ?? activePath;
    if (!window.confirm(`Удалить файл «${name}»? Действие необратимо.`)) {
      return;
    }
    if (!baseUrl) {
      setToast("Не задан URL сервера");
      return;
    }
    setBusy(true);
    try {
      await deleteCodeFile(baseUrl, activePath);
      setOpenFiles((prev) => {
        const next = prev.filter((f) => f.path !== activePath);
        setActivePath(next.length > 0 ? next[next.length - 1].path : null);
        return next;
      });
      setBreakpointsByFile((prev) => {
        const { [activePath]: _, ...rest } = prev;
        return rest;
      });
      await reload(true);
      setToast(`Файл «${name}» удалён`);
    } catch (e) {
      setToast(`Не удалось удалить файл: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [activePath, openFiles, baseUrl, reload]);

  const handleRefresh = useCallback(() => {
    void reload(true);
  }, [reload]);

  const handleSaveCurrent = useCallback(() => {
    if (activePath) void saveFile(activePath);
  }, [activePath, saveFile]);

  // -------------------------------------------------------------------
  // Breakpoints
  // -------------------------------------------------------------------
  const changeBreakpoints = useCallback(
    (path: string, bps: BreakpointMap) => {
      setBreakpointsByFile((prev) => ({ ...prev, [path]: bps }));
    },
    [],
  );

  const removeBreakpoint = useCallback((path: string, line: number) => {
    setBreakpointsByFile((prev) => {
      const cur = prev[path];
      if (!cur || !cur.has(line)) return prev;
      const next = new Map(cur);
      next.delete(line);
      return { ...prev, [path]: next };
    });
  }, []);

  const deleteAllBreakpoints = useCallback(() => {
    setBreakpointsByFile({});
  }, []);

  const setAllEnabled = useCallback((enabled: boolean) => {
    setBreakpointsByFile((prev) => {
      const next: Record<string, BreakpointMap> = {};
      for (const [path, map] of Object.entries(prev)) {
        const newMap = new Map<number, boolean>();
        for (const line of map.keys()) newMap.set(line, enabled);
        next[path] = newMap;
      }
      return next;
    });
  }, []);

  const setNodeEnabled = useCallback(
    (
      targetPath: string,
      isFolder: boolean,
      enabled: boolean,
      line?: number,
    ) => {
      setBreakpointsByFile((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [filePath, map] of Object.entries(prev)) {
          const matches = isFolder
            ? filePath.startsWith(targetPath + "/")
            : filePath === targetPath;
          if (!matches) continue;

          const newMap = new Map(map);
          if (line !== undefined) {
            if (newMap.has(line)) {
              newMap.set(line, enabled);
              changed = true;
            }
          } else {
            for (const l of newMap.keys()) {
              if (newMap.get(l) !== enabled) {
                newMap.set(l, enabled);
                changed = true;
              }
            }
          }
          next[filePath] = newMap;
        }
        return changed ? next : prev;
      });
    },
    [],
  );

  const navigateToBreakpoint = useCallback(
    async (path: string, line: number) => {
      const ok = await openFile(path);
      if (ok) setPendingScroll({ path, line });
    },
    [openFile],
  );

  const clearPendingScroll = useCallback(() => setPendingScroll(null), []);

  // -------------------------------------------------------------------
  // Вертикальный split
  // -------------------------------------------------------------------
  const onVerticalSplitDelta = useCallback((delta: number) => {
    if (!containerRef.current) return;
    const total = containerRef.current.clientHeight;
    if (total <= 0) return;
    const dPct = (delta / total) * 100;
    setTopPercent((p) => {
      const MIN_TOP = 120;
      const MIN_BOTTOM = 120;
      const minPct = (MIN_TOP / total) * 100;
      const maxPct = 100 - (MIN_BOTTOM / total) * 100 - (6 / total) * 100;
      return Math.max(minPct, Math.min(maxPct, p + dPct));
    });
  }, []);

  if (!baseUrl) {
    return (
      <div className="scripts-tab">
        <div className="scripts-hint">
          Не удалось определить адрес сервера (проверьте URL и порт).
        </div>
      </div>
    );
  }

  const activeFile = openFiles.find((f) => f.path === activePath);
  const canSave = !!activeFile && activeFile.dirty && !busy;
  const canDelete = !!activeFile && !busy;

  return (
    <div className="scripts-tab">
      <DebugToolbar />

      <div className="scripts-main" ref={containerRef}>
        <div className="scripts-top" style={{ height: `${topPercent}%` }}>
          <div className="scripts-tree-wrap" style={{ width: treeWidth }}>
            <div className="scripts-tree-header">
              <div className="scripts-tree-toolbar-row">
                <button
                  type="button"
                  className="toolbar-btn scripts-tree-btn"
                  onClick={() => setAddOpen(true)}
                  disabled={busy || loading}
                  title="Создать новый файл"
                >
                  Добавить
                </button>
                <button
                  type="button"
                  className="toolbar-btn scripts-tree-btn danger"
                  onClick={() => void handleDelete()}
                  disabled={!canDelete}
                  title="Удалить активный файл"
                >
                  Удалить
                </button>
                <button
                  type="button"
                  className="toolbar-btn scripts-tree-btn primary"
                  onClick={handleSaveCurrent}
                  disabled={!canSave}
                  title="Сохранить активный файл (Ctrl+S)"
                >
                  Сохранить
                </button>
              </div>
              <div className="scripts-tree-toolbar-row">
                <button
                  type="button"
                  className="toolbar-btn scripts-tree-btn"
                  onClick={handleRefresh}
                  disabled={loading || busy}
                  title="Перечитать список файлов с сервера"
                >
                  Обновить
                </button>
              </div>
            </div>
            <div className="scripts-tree-body">
              {loading && tree.length === 0 && (
                <div className="scripts-hint">Загрузка…</div>
              )}
              {!loading && error && tree.length === 0 && (
                <div className="scripts-hint">
                  {error}{" "}
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={handleRefresh}
                  >
                    Повторить
                  </button>
                </div>
              )}
              {!loading && !error && tree.length === 0 && (
                <div className="scripts-hint">Файлы не найдены</div>
              )}
              {tree.length > 0 && (
                <ScriptFileTree
                  nodes={tree}
                  activePath={activePath}
                  breakpointsByFile={breakpointsByFile}
                  onOpen={(p) => void openFile(p)}
                />
              )}
            </div>
          </div>

          <Splitter
            direction="vertical"
            onDelta={(d) =>
              setTreeWidth((w) => Math.max(120, Math.min(500, w + d)))
            }
          />

          <div className="scripts-editors-wrap">
            <ScriptEditorTabs
              openFiles={openFiles}
              activePath={activePath}
              breakpointsByFile={breakpointsByFile}
              pendingScroll={pendingScroll}
              onActivate={setActivePath}
              onClose={closeFile}
              onChange={changeFileContent}
              onSave={(p) => void saveFile(p)}
              onBreakpointsChange={changeBreakpoints}
              onScrollHandled={clearPendingScroll}
            />
          </div>
        </div>

        <Splitter direction="horizontal" onDelta={onVerticalSplitDelta} />

        <div className="scripts-bottom">
          <DebugPanels
            breakpointsByFile={breakpointsByFile}
            onNavigateBreakpoint={(path, line) =>
              void navigateToBreakpoint(path, line)
            }
            onRemoveBreakpoint={removeBreakpoint}
            onDeleteAll={deleteAllBreakpoints}
            onSetAllEnabled={setAllEnabled}
            onSetNodeEnabled={setNodeEnabled}
          />
        </div>
      </div>

      {addOpen && (
        <PromptDialog
          title="Новый файл"
          label="Путь к файлу"
          initialValue={activePath ? activePath.replace(/[^/]+$/, "") : ""}
          placeholder="например, lua/new_script.lua"
          validate={validateNewPath}
          onSubmit={(value) => handleAdd(value)}
          onClose={() => setAddOpen(false)}
        />
      )}

      {toast && <div className="scripts-toast">{toast}</div>}
    </div>
  );
}