import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { EditorView } from "@codemirror/view";
import {
  breakpointField,
  breakpointGutter,
  breakpointKeymap,
  breakpointTheme,
  getBreakpoints,
  setBreakpointsEffect,
  toggleBreakpointEffect,
  setsEqual,
} from "./breakpointField";

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
  onBreakpointsChange: (path: string, bps: Set<number>) => void;
}

const EMPTY_SET: Set<number> = new Set();

export function ScriptEditorTabs({
  openFiles,
  activePath,
  breakpointsByFile,
  onActivate,
  onClose,
  onChange,
  onBreakpointsChange,
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
            breakpoints={breakpointsByFile[file.path] ?? EMPTY_SET}
            visible={activePath === file.path}
            onChange={(content) => onChange(file.path, content)}
            onBreakpointsChange={(bps) =>
              onBreakpointsChange(file.path, bps)
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
  onBreakpointsChange,
}: {
  file: OpenFile;
  breakpoints: Set<number>;
  visible: boolean;
  onChange: (content: string) => void;
  onBreakpointsChange: (bps: Set<number>) => void;
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

  const viewRef = useRef<EditorView | null>(null);
  const breakpointsRef = useRef(breakpoints);
  breakpointsRef.current = breakpoints;

  const onBpChangeRef = useRef(onBreakpointsChange);
  onBpChangeRef.current = onBreakpointsChange;

  const onCreateEditor = useCallback((view: EditorView) => {
    viewRef.current = view;
    if (breakpointsRef.current.size > 0) {
      view.dispatch({
        effects: setBreakpointsEffect.of([...breakpointsRef.current]),
      });
    }
  }, []);

  // Внешние изменения брейкпоинтов → StateField
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.field(breakpointField);
    if (setsEqual(current, breakpoints)) return;
    view.dispatch({
      effects: setBreakpointsEffect.of([...breakpoints]),
    });
  }, [breakpoints]);

  // StateField меняется (клик по гуттеру / F9) → сообщаем наружу
  const extensions = useMemo(
    () => [
      StreamLanguage.define(lua),
      breakpointField,
      breakpointGutter,
      breakpointKeymap,
      breakpointTheme,
      EditorView.updateListener.of((update) => {
        const hasBpEffect = update.transactions.some((tr) =>
          tr.effects.some(
            (e) =>
              e.is(toggleBreakpointEffect) || e.is(setBreakpointsEffect)
          )
        );
        if (hasBpEffect) {
          onBpChangeRef.current(getBreakpoints(update.view));
        }
      }),
    ],
    []
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
        onCreateEditor={onCreateEditor}
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