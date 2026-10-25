import { useCallback, useState } from "react";
import { DebugToolbar } from "../script/DebugToolbar";
import { ScriptFileTree } from "../script/ScriptFileTree";
import { ScriptEditorTabs } from "../script/ScriptEditorTabs";
import { STUB_FILES, getFileContent, type ScriptFileNode } from "../../scriptStub";

interface OpenFile {
  path: string;
  name: string;
  content: string;
}

function findFile(nodes: ScriptFileNode[], path: string): ScriptFileNode | null {
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
    Record<string, Set<number>>
  >({});

  const openFile = useCallback(
    (path: string) => {
      setOpenFiles((prev) => {
        if (prev.some((f) => f.path === path)) return prev;
        const node = findFile(STUB_FILES, path);
        const name = node?.name ?? path.split("/").pop() ?? path;
        return [...prev, { path, name, content: getFileContent(path) }];
      });
      setActivePath(path);
    },
    []
  );

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

  const toggleBreakpoint = useCallback((path: string, line: number) => {
    setBreakpointsByFile((prev) => {
      const cur = prev[path] ?? new Set<number>();
      const next = new Set(cur);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return { ...prev, [path]: next };
    });
  }, []);

  return (
    <div className="scripts-tab">
      <DebugToolbar />
      <div className="scripts-body">
        <ScriptFileTree
          nodes={STUB_FILES}
          activePath={activePath}
          onOpen={openFile}
        />
        <ScriptEditorTabs
          openFiles={openFiles}
          activePath={activePath}
          breakpointsByFile={breakpointsByFile}
          onActivate={setActivePath}
          onClose={closeFile}
          onChange={changeFileContent}
          onToggleBreakpoint={toggleBreakpoint}
        />
      </div>
    </div>
  );
}