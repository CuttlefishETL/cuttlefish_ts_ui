import { useCallback, useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { breakpointGutter } from "./breakpointGutter";

interface OpenFile {
  path: string;
  name: string;
  content: string;
}

interface ScriptEditorTabsProps {
  openFiles: OpenFile[];
  activePath: string | null;
  breakpointsByFile: Record<string, Set<number>>;
  onActivate: (path: string) => void;
  onClose: (path: string) => void;
  onChange: (path: string, content: string) => void;
  onToggleBreakpoint: (path: string, line: number) => void;
}

export function ScriptEditorTabs({
  openFiles,
  activePath,
  breakpointsByFile,
  onActivate,
  onClose,
  onChange,
  onToggleBreakpoint,
}: ScriptEditorTabsProps) {
  const activeFile = openFiles.find((f) => f.path === activePath);

  return (
    <div className="scripts-editors">
      <div className="scripts-tabs-bar">
        {openFiles.map((file) => (
          <div
            key={file.path}
            className={`script-tab ${activePath === file.path ? "active" : ""}`}
            onClick={() => onActivate(file.path)}
          >
            <span>{file.name}</span>
            <button
              type="button"
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose(file.path);
              }}
            >
              ×
            </button>
          </div>
        ))}
        {openFiles.length === 0 && (
          <div className="scripts-tabs-empty">
            Откройте файл в дереве слева
          </div>
        )}
      </div>

      <div className="scripts-editor-host">
        {openFiles.map((file) => (
          <ScriptEditor
            key={file.path}
            file={file}
            breakpoints={breakpointsByFile[file.path] ?? new Set()}
            visible={activePath === file.path}
            onChange={(content) => onChange(file.path, content)}
            onToggleBreakpoint={(line) =>
              onToggleBreakpoint(file.path, line)
            }
          />
        ))}
        {!activeFile && openFiles.length === 0 && (
          <div className="scripts-editor-placeholder" />
        )}
      </div>
    </div>
  );
}

function ScriptEditor({
  file,
  breakpoints,
  visible,
  onChange,
  onToggleBreakpoint,
}: {
  file: OpenFile;
  breakpoints: Set<number>;
  visible: boolean;
  onChange: (content: string) => void;
  onToggleBreakpoint: (line: number) => void;
}) {
  const [isDark, setIsDark] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const extensions = useMemo(
    () => [
      StreamLanguage.define(lua),
      breakpointGutter(breakpoints, onToggleBreakpoint),
    ],
    [breakpoints, onToggleBreakpoint]
  );

  const handleChange = useCallback(
    (value: string) => onChange(value),
    [onChange]
  );

  return (
    <div
      className="scripts-editor"
      style={{ display: visible ? "block" : "none" }}
    >
      <CodeMirror
        value={file.content}
        height="100%"
        extensions={extensions}
        theme={isDark ? "dark" : "light"}
        onChange={handleChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
        }}
      />
    </div>
  );
}