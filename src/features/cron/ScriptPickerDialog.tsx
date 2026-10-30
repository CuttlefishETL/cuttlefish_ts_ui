import { useState } from "react";
import type { CodeTreeNode } from "./types";

interface Props {
  tree: CodeTreeNode[];
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function ScriptPickerDialog({ tree, onSelect, onClose }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(collectFolders(tree)),
  );
  const [selected, setSelected] = useState<string | null>(null);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleChoose = () => {
    if (selected) onSelect(selected);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal cron-script-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Выбор скрипта</h3>

        <div className="cron-script-tree" role="tree">
          {renderNodes(tree, 0, expanded, toggle, selected, setSelected)}
        </div>

        <div className="modal-actions">
          <button className="btn primary" onClick={handleChoose} disabled={!selected}>
            Выбрать
          </button>
          <button className="btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

function collectFolders(nodes: CodeTreeNode[]): string[] {
  const out: string[] = [];
  const walk = (list: CodeTreeNode[]) => {
    for (const n of list) {
      if (n.type === "folder") {
        out.push(n.path);
        if (n.children) walk(n.children);
      }
    }
  };
  walk(nodes);
  return out;
}

function renderNodes(
  nodes: CodeTreeNode[],
  depth: number,
  expanded: Set<string>,
  toggle: (path: string) => void,
  selected: string | null,
  setSelected: (path: string | null) => void,
): React.ReactNode {
  return nodes.map((n) => {
    const isFolder = n.type === "folder";
    const isExpanded = expanded.has(n.path);
    const isSelected = selected === n.path;

    return (
      <div key={n.path}>
        <div
          className={"cron-script-row" + (isSelected ? " is-selected" : "")}
          style={{ paddingLeft: 8 + depth * 16 }}
          onClick={() => {
            if (isFolder) toggle(n.path);
            else setSelected(n.path);
          }}
          onDoubleClick={() => {
            if (!isFolder) setSelected(n.path);
          }}
        >
          {isFolder ? (
            <button
              className="cron-chevron"
              onClick={(e) => {
                e.stopPropagation();
                toggle(n.path);
              }}
            >
              {isExpanded ? "▾" : "▸"}
            </button>
          ) : (
            <span className="cron-chevron-placeholder" />
          )}
          <span className="cron-icon">{isFolder ? "📁" : "📄"}</span>
          <span className="cron-label">{n.name}</span>
        </div>
        {isFolder && isExpanded && n.children && (
          <div>{renderNodes(n.children, depth + 1, expanded, toggle, selected, setSelected)}</div>
        )}
      </div>
    );
  });
}