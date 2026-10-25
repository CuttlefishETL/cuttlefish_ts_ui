import { useCallback, useRef, useState } from "react";
import { DebugToolbar } from "../script/DebugToolbar";
import { ScriptFileTree } from "../script/ScriptFileTree";
import { ScriptEditorTabs } from "../script/ScriptEditorTabs";
import { DebugPanels } from "../script/DebugPanels";
import { Splitter } from "../script/Splitter";
import type { BreakpointMap } from "../script/breakpointField";
import {
  STUB_FILES,
  getFileContent,
  type ScriptFileNode,
} from "../../scriptStub";

interface OpenFile {
  path: string;
  name: string;
  content: string;
}

function findFile(
  nodes: ScriptFileNode[],
  path: string
): ScriptFileNode | null {
  for (const n of nodes) {
    if (n.path === path) return n;
    if (n.children) {
      const found = findFile(n.children, path);
      if (found) return found;
    }
  }
  return null;
}

export function ScriptsTab() {
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

  const openFile = useCallback((path: string) => {
    setOpenFiles((prev) => {
      if (prev.some((f) => f.path === path)) return prev;
      const node = findFile(STUB_FILES, path);
      const name = node?.name ?? path.split("/").pop() ?? path;
      return [...prev, { path, name, content: getFileContent(path) }];
    });
    setActivePath(path);
  }, []);

  const closeFile = useCallback(
    (path: string) => {
      setOpenFiles((prev) => {
        const next = prev.filter((f) => f.path !== path);
        if (activePath === path) {
          setActivePath(next.length > 0 ? next[next.length - 1].path : null);
        }
        return next;
      });
    },
    [activePath]
  );

  const changeFileContent = useCallback(
    (path: string, content: string) => {
      setOpenFiles((prev) =>
        prev.map((f) => (f.path === path ? { ...f, content } : f))
      );
    },
    []
  );

  const changeBreakpoints = useCallback(
    (path: string, bps: BreakpointMap) => {
      setBreakpointsByFile((prev) => ({ ...prev, [path]: bps }));
    },
    []
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
      line?: number
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
    []
  );

  const navigateToBreakpoint = useCallback(
    (path: string, line: number) => {
      openFile(path);
      setPendingScroll({ path, line });
    },
    [openFile]
  );

  const clearPendingScroll = useCallback(
    () => setPendingScroll(null),
    []
  );

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

  return (
    <div className="scripts-tab">
      <DebugToolbar />
      <div className="scripts-main" ref={containerRef}>
        <div
          className="scripts-top"
          style={{ height: `${topPercent}%` }}
        >
          <div
            className="scripts-tree-wrap"
            style={{ width: treeWidth }}
          >
            <ScriptFileTree
              nodes={STUB_FILES}
              activePath={activePath}
              breakpointsByFile={breakpointsByFile}
              onOpen={openFile}
            />
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
              onBreakpointsChange={changeBreakpoints}
              onScrollHandled={clearPendingScroll}
            />
          </div>
        </div>

        <Splitter
          direction="horizontal"
          onDelta={onVerticalSplitDelta}
        />

        <div className="scripts-bottom">
          <DebugPanels
            breakpointsByFile={breakpointsByFile}
            onNavigateBreakpoint={navigateToBreakpoint}
            onRemoveBreakpoint={removeBreakpoint}
            onDeleteAll={deleteAllBreakpoints}
            onSetAllEnabled={setAllEnabled}
            onSetNodeEnabled={setNodeEnabled}
          />
        </div>
      </div>
    </div>
  );
}