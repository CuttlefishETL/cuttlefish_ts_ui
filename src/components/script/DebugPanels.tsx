import { JSX, useCallback, useMemo, useState } from "react";
import { Splitter } from "./Splitter";
import { ContextMenu, type AnchorRect, type ContextMenuItem } from "../ContextMenu";
import type { BreakpointMap } from "./breakpointField";
import {
  STUB_MESSAGES,
  STUB_STACK_FRAMES,
  STUB_VARIABLES,
  type OutputKind,
  type Variable,
} from "../../scriptStub";

const MESSAGE_COLOR: Record<OutputKind, string> = {
  log: "#333",
  info: "#396cd8",
  warn: "#c08000",
  error: "#b02020",
};

interface BpTreeFolder {
  type: "folder";
  name: string;
  path: string;
  children: BpTreeNode[];
}

interface BpTreeFile {
  type: "file";
  name: string;
  path: string;
  breakpoints: { line: number; enabled: boolean }[];
}

type BpTreeNode = BpTreeFolder | BpTreeFile;

type CtxNode =
  | { kind: "folder"; path: string }
  | { kind: "file"; path: string }
  | { kind: "line"; path: string; line: number; enabled: boolean };

function buildBpTree(
  breakpointsByFile: Record<string, BreakpointMap>
): BpTreeNode[] {
  const root: BpTreeFolder = {
    type: "folder",
    name: "",
    path: "",
    children: [],
  };

  const paths = Object.entries(breakpointsByFile)
    .filter(([, map]) => map.size > 0)
    .map(([path]) => path);

  for (const path of paths) {
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) continue;

    let current = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const subPath = "/" + segments.slice(0, i + 1).join("/");
      let folder = current.children.find(
        (c): c is BpTreeFolder =>
          c.type === "folder" && c.path === subPath
      );
      if (!folder) {
        folder = {
          type: "folder",
          name: segments[i],
          path: subPath,
          children: [],
        };
        current.children.push(folder);
      }
      current = folder;
    }

    const fileName = segments[segments.length - 1];
    const map = breakpointsByFile[path] ?? new Map<number, boolean>();
    const bps = [...map.entries()]
      .map(([line, enabled]) => ({ line, enabled }))
      .sort((a, b) => a.line - b.line);

    current.children.push({
      type: "file",
      name: fileName,
      path,
      breakpoints: bps,
    });
  }

  const sortNodes = (nodes: BpTreeNode[]): BpTreeNode[] =>
    [...nodes]
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((n) =>
        n.type === "folder"
          ? { ...n, children: sortNodes(n.children) }
          : n
      );

  return sortNodes(root.children);
}

interface DebugPanelsProps {
  breakpointsByFile: Record<string, BreakpointMap>;
  onNavigateBreakpoint: (path: string, line: number) => void;
  onRemoveBreakpoint: (path: string, line: number) => void;
  onDeleteAll: () => void;
  onSetAllEnabled: (enabled: boolean) => void;
  onSetNodeEnabled: (
    targetPath: string,
    isFolder: boolean,
    enabled: boolean,
    line?: number
  ) => void;
}

export function DebugPanels({
  breakpointsByFile,
  onNavigateBreakpoint,
  onRemoveBreakpoint,
  onDeleteAll,
  onSetAllEnabled,
  onSetNodeEnabled,
}: DebugPanelsProps) {
  const [stackWidth, setStackWidth] = useState(200);
  const [breakpointsWidth, setBreakpointsWidth] = useState(240);
  const [messagesWidth, setMessagesWidth] = useState(280);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    new Set()
  );
  const [context, setContext] = useState<{
    anchor: AnchorRect;
    node: CtxNode;
  } | null>(null);

  const bpTree = useMemo(
    () => buildBpTree(breakpointsByFile),
    [breakpointsByFile]
  );
  const totalBps = useMemo(
    () =>
      Object.values(breakpointsByFile).reduce(
        (s, map) => s + map.size,
        0
      ),
    [breakpointsByFile]
  );

  const toggleFolder = (path: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleNodeContext = useCallback(
    (e: React.MouseEvent, node: CtxNode) => {
      e.preventDefault();
      e.stopPropagation();
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setContext({
        anchor: {
          left: r.left,
          top: r.top,
          bottom: r.bottom,
          right: r.right,
        },
        node,
      });
    },
    []
  );

  const buildContextItems = (node: CtxNode): ContextMenuItem[] => {
    if (node.kind === "line") {
      return [
        {
          label: "Отключить точку",
          action: () =>
            onSetNodeEnabled(node.path, false, false, node.line),
          disabled: !node.enabled,
        },
        {
          label: "Включить точку",
          action: () =>
            onSetNodeEnabled(node.path, false, true, node.line),
          disabled: node.enabled,
        },
      ];
    }
    if (node.kind === "file") {
      return [
        {
          label: "Отключить все точки",
          action: () => onSetNodeEnabled(node.path, false, false),
        },
        {
          label: "Включить все точки",
          action: () => onSetNodeEnabled(node.path, false, true),
        },
      ];
    }
    return [
      {
        label: "Отключить все точки",
        action: () => onSetNodeEnabled(node.path, true, false),
      },
      {
        label: "Включить все точки",
        action: () => onSetNodeEnabled(node.path, true, true),
      },
    ];
  };

  return (
    <div className="debug-panels">
      <div className="debug-panel" style={{ width: stackWidth }}>
        <div className="debug-panel-header">Стек вызовов</div>
        <div className="debug-panel-body">
          {STUB_STACK_FRAMES.length === 0 && (
            <div className="debug-empty">Нет данных</div>
          )}
          {STUB_STACK_FRAMES.map((f, i) => (
            <div
              key={f.id}
              className={`stack-frame ${i === 0 ? "current" : ""}`}
              title={`${f.file}:${f.line}`}
            >
              <span className="stack-frame-name">{f.name}</span>
              <span className="stack-frame-loc">
                {f.file.split("/").pop()}:{f.line}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Splitter
        direction="vertical"
        onDelta={(d) =>
          setStackWidth((w) => Math.max(120, Math.min(500, w + d)))
        }
      />

      <div className="debug-panel" style={{ width: breakpointsWidth }}>
        <div className="debug-panel-header">
          <span>Breakpoints</span>
          {totalBps > 0 && (
            <span className="debug-panel-count">{totalBps}</span>
          )}
          <span className="bp-header-actions">
            <button
              type="button"
              className="bp-header-btn danger"
              onClick={onDeleteAll}
              disabled={totalBps === 0}
              title="Удалить все точки останова"
            >
              ✕
            </button>
            <button
              type="button"
              className="bp-header-btn"
              onClick={() => onSetAllEnabled(false)}
              disabled={totalBps === 0}
              title="Отключить все точки останова"
            >
              ⏸
            </button>
            <button
              type="button"
              className="bp-header-btn"
              onClick={() => onSetAllEnabled(true)}
              disabled={totalBps === 0}
              title="Включить все точки останова"
            >
              ▶
            </button>
          </span>
        </div>
        <div className="debug-panel-body bp-tree-body">
          {bpTree.length === 0 && (
            <div className="debug-empty">Нет точек останова</div>
          )}
          <BreakpointsTree
            nodes={bpTree}
            depth={0}
            collapsed={collapsedFolders}
            onToggleFolder={toggleFolder}
            onNavigate={onNavigateBreakpoint}
            onRemove={onRemoveBreakpoint}
            onNodeContext={handleNodeContext}
          />
        </div>
      </div>

      <Splitter
        direction="vertical"
        onDelta={(d) =>
          setBreakpointsWidth((w) =>
            Math.max(120, Math.min(500, w + d))
          )
        }
      />

      <div className="debug-panel" style={{ width: messagesWidth }}>
        <div className="debug-panel-header">Сообщения</div>
        <div className="debug-panel-body">
          {STUB_MESSAGES.length === 0 && (
            <div className="debug-empty">Нет сообщений</div>
          )}
          {STUB_MESSAGES.map((m) => (
            <div key={m.id} className="message-row">
              <span className="message-time">{m.time}</span>
              <span
                className="message-text"
                style={{ color: MESSAGE_COLOR[m.kind] }}
              >
                {m.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Splitter
        direction="vertical"
        onDelta={(d) =>
          setMessagesWidth((w) => Math.max(120, Math.min(600, w + d)))
        }
      />

      <div className="debug-panel" style={{ flex: 1 }}>
        <div className="debug-panel-header">Переменные</div>
        <div className="debug-panel-body">
          {STUB_VARIABLES.length === 0 && (
            <div className="debug-empty">Нет переменных</div>
          )}
          {renderVariables(STUB_VARIABLES)}
        </div>
      </div>

      {context && (
        <ContextMenu
          anchor={context.anchor}
          items={buildContextItems(context.node)}
          onClose={() => setContext(null)}
        />
      )}
    </div>
  );
}

function BreakpointsTree({
  nodes,
  depth,
  collapsed,
  onToggleFolder,
  onNavigate,
  onRemove,
  onNodeContext,
}: {
  nodes: BpTreeNode[];
  depth: number;
  collapsed: Set<string>;
  onToggleFolder: (path: string) => void;
  onNavigate: (path: string, line: number) => void;
  onRemove: (path: string, line: number) => void;
  onNodeContext: (e: React.MouseEvent, node: CtxNode) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        if (node.type === "folder") {
          const isOpen = !collapsed.has(node.path);
          return (
            <div key={node.path}>
              <div
                className="bp-tree-folder"
                style={{ paddingLeft: 6 + depth * 12 }}
                onClick={() => onToggleFolder(node.path)}
                onContextMenu={(e) =>
                  onNodeContext(e, { kind: "folder", path: node.path })
                }
              >
                <span className="bp-tree-chevron">
                  {isOpen ? "▾" : "▸"}
                </span>
                <span className="bp-tree-name">{node.name}</span>
              </div>
              {isOpen && (
                <BreakpointsTree
                  nodes={node.children}
                  depth={depth + 1}
                  collapsed={collapsed}
                  onToggleFolder={onToggleFolder}
                  onNavigate={onNavigate}
                  onRemove={onRemove}
                  onNodeContext={onNodeContext}
                />
              )}
            </div>
          );
        }

        return (
          <div key={node.path}>
            <div
              className="bp-tree-file"
              style={{ paddingLeft: 6 + depth * 12 + 14 }}
              title={node.path}
              onContextMenu={(e) =>
                onNodeContext(e, { kind: "file", path: node.path })
              }
            >
              <span className="bp-tree-name">{node.name}</span>
              <span className="bp-tree-file-count">
                {node.breakpoints.length}
              </span>
            </div>
            {node.breakpoints.map((bp) => (
              <div
                key={`${node.path}:${bp.line}`}
                className={`bp-tree-line ${bp.enabled ? "" : "disabled"}`}
                style={{ paddingLeft: 6 + depth * 12 + 28 }}
                title={`${node.path}:${bp.line}`}
                onClick={() => onNavigate(node.path, bp.line)}
                onContextMenu={(e) =>
                  onNodeContext(e, {
                    kind: "line",
                    path: node.path,
                    line: bp.line,
                    enabled: bp.enabled,
                  })
                }
              >
                <span
                  className={`bp-tree-line-dot ${
                    bp.enabled ? "" : "disabled"
                  }`}
                >
                  {bp.enabled ? "●" : "○"}
                </span>
                <span className="bp-tree-line-text">
                  строка {bp.line}
                </span>
                <button
                  type="button"
                  className="bp-tree-remove"
                  title="Удалить точку останова"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(node.path, bp.line);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

function renderVariables(vars: Variable[], depth = 0): JSX.Element[] {
  return vars.flatMap((v) => {
    const rows: JSX.Element[] = [
      <div
        key={`${depth}-${v.name}`}
        className="var-row"
        style={{ paddingLeft: depth * 12 }}
      >
        <span className="var-name">{v.name}</span>
        <span className="var-value">{v.value}</span>
        <span className="var-type">{v.type}</span>
      </div>,
    ];
    if (v.children && v.children.length > 0) {
      rows.push(...renderVariables(v.children, depth + 1));
    }
    return rows;
  });
}