import { useEffect, useState } from "react";
import type { CodeTreeNode } from "./types";
import { collectFolderPaths, findByPath } from "./types";

interface Props {
  tree: CodeTreeNode[];
  /** Текущее значение поля «скрипт» — подсвечивается в дереве. */
  initialSelected?: string | null;
  /** Идёт загрузка списка. */
  loading?: boolean;
  /** Ошибка загрузки (если была). */
  errorMessage?: string | null;
  /** Перезапросить список (кнопка «Повторить» при ошибке). */
  onReload?: () => void;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function ScriptPickerDialog({
  tree,
  initialSelected,
  loading,
  errorMessage,
  onReload,
  onSelect,
  onClose,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(collectFolderPaths(tree)),
  );
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!initialSelected) return;
    if (findByPath(tree, initialSelected)) {
      setSelected(initialSelected);
    }
  }, [initialSelected, tree]);

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

  const isEmpty = tree.length === 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal cron-script-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Выбор скрипта</h3>

        {loading && (
          <div className="cron-script-empty">Загрузка списка скриптов…</div>
        )}

        {!loading && errorMessage && (
          <div className="cron-script-error">
            Не удалось загрузить список скриптов: {errorMessage}
            {onReload && (
              <div style={{ marginTop: 8 }}>
                <button className="btn" onClick={() => onReload()}>
                  Повторить
                </button>
              </div>
            )}
          </div>
        )}

        {!loading && !errorMessage && isEmpty && (
          <div className="cron-script-empty">
            Файлы скриптов не найдены на сервере.
            <br />
            Закройте окно и введите путь вручную в поле «Скрипт».
          </div>
        )}

        {!loading && !errorMessage && !isEmpty && (
          <div className="cron-script-tree" role="tree">
            {renderNodes(tree, 0, expanded, toggle, selected, setSelected)}
          </div>
        )}

        <div className="modal-actions">
          <button
            className="btn primary"
            onClick={handleChoose}
            disabled={!selected}
          >
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
      <div key={n.path || n.name}>
        <div
          className={"cron-script-row" + (isSelected ? " is-selected" : "")}
          style={{ paddingLeft: 8 + depth * 16 }}
          title={n.path}
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
          <div>
            {renderNodes(
              n.children,
              depth + 1,
              expanded,
              toggle,
              selected,
              setSelected,
            )}
          </div>
        )}
      </div>
    );
  });
}
