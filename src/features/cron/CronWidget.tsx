import { useEffect, useMemo, useState } from "react";
import type { CronApi } from "./api";
import { useCron } from "./useCron";
import { buildCronTree, flattenTree } from "./buildTree";
import { CronDialog } from "./CronDialog";
import type { CronEntry } from "./types";
import { act, sep, useContextMenu } from "../../components/context-menu";
import "./cron.css";

interface Props {
  api: CronApi;
}

type DialogState =
  | { kind: "none" }
  | { kind: "create"; initial: CronEntry | null; isNew: true }
  | { kind: "edit"; initial: CronEntry; isNew: false }
  | { kind: "copy"; initial: CronEntry; isNew: true };

export function CronWidget({ api }: Props) {
  const { openContextMenu } = useContextMenu();
  const { items, scripts, loading, error, reload, toggleEnabled } = useCron(api);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const tree = useMemo(() => buildCronTree(items), [items]);

  useEffect(() => {
    if (expanded.size === 0 && tree.length > 0) {
      setExpanded(new Set(tree.map((g) => g.key)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.length]);

  const rows = useMemo(() => flattenTree(tree, expanded), [tree, expanded]);

  const selected = useMemo(
    () => items.find((t) => t.name === selectedName) ?? null,
    [items, selectedName],
  );

  const toggleSection = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAdd = () => {
    setDialog({ kind: "create", initial: null, isNew: true });
  };

  const handleEdit = (target?: CronEntry) => {
    const t = target ?? selected;
    if (!t) return;
    setDialog({ kind: "edit", initial: t, isNew: false });
  };

  const handleCopy = (target?: CronEntry) => {
    const t = target ?? selected;
    if (!t) return;
    const copyName = makeCopyName(t.name, items.map((x) => x.name));
    setDialog({
      kind: "copy",
      initial: { ...t, name: copyName },
      isNew: true,
    });
  };

  const handleSubmit = async (
    entry: CronEntry,
    originalName: string | null,
  ) => {
    setSaving(true);
    try {
      if (originalName) {
        await api.update(originalName, entry);
        setToast(`Задача «${entry.name}» сохранена`);
      } else {
        await api.create(entry);
        setToast(`Задача «${entry.name}» создана`);
      }
      setDialog({ kind: "none" });
      setSelectedName(entry.name);
      await reload();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const name = confirmDelete;
    setConfirmDelete(null);
    try {
      await api.remove(name);
      setToast(`Задача «${name}» удалена`);
      if (selectedName === name) setSelectedName(null);
      await reload();
    } catch (e) {
      setToast((e as Error).message);
    }
  };

  const handleToggle = async (task: CronEntry) => {
    const err = await toggleEnabled(task);
    if (err) setToast(err);
  };

  // -------- Context menu --------

  const openTaskMenu = (e: React.MouseEvent, task: CronEntry) => {
    setSelectedName(task.name);
    openContextMenu(e, [
      act("Редактировать", () => handleEdit(task)),
      act("Копировать", () => handleCopy(task)),
      sep(),
      act("Удалить", () => setConfirmDelete(task.name), { danger: true }),
      sep(),
      act("Обновить", () => void reload(), { disabled: loading }),
    ]);
  };

  const openBlankMenu = (e: React.MouseEvent) => {
    openContextMenu(e, [
      act("Добавить задачу", handleAdd),
      sep(),
      act("Обновить", () => void reload(), { disabled: loading }),
    ]);
  };

  return (
    <div className="cron-tab" onContextMenu={openBlankMenu}>
      <div className="cron-toolbar">
        <button className="btn" onClick={handleAdd}>
          Добавить
        </button>
        <button
          className="btn"
          onClick={() => handleEdit()}
          disabled={!selected}
        >
          Редактировать
        </button>
        <button
          className="btn"
          onClick={() => handleCopy()}
          disabled={!selected}
        >
          Копировать
        </button>
        <button
          className="btn danger"
          onClick={() => selected && setConfirmDelete(selected.name)}
          disabled={!selected}
        >
          Удалить
        </button>
        <button
          className="btn"
          onClick={() => void reload()}
          disabled={loading}
        >
          Обновить
        </button>

        <span className="cron-spacer" />

        <span className="cron-stats">Всего: {items.length}</span>
      </div>

      <div className="cron-list">
        <div className="cron-header">
          <div className="col-name">Имя</div>
          <div className="col-schedule">Расписание</div>
          <div className="col-script">Скрипт</div>
          <div className="col-uid">Владелец</div>
          <div className="col-enabled">Вкл.</div>
          <div className="col-section">Секция</div>
        </div>

        <div className="cron-body" role="tree">
          {loading && items.length === 0 && (
            <div className="cron-hint">Загрузка…</div>
          )}
          {error && items.length === 0 && (
            <div className="cron-hint">
              {error}{" "}
              <button className="btn" onClick={() => void reload()}>
                Повторить
              </button>
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="cron-hint">
              Задачи не найдены. Нажмите «Добавить».
            </div>
          )}

          {rows.map(({ node, depth }) => {
            const isSection = node.type === "section";
            const task = node.task;
            const isSelected = task ? task.name === selectedName : false;
            const isExpanded = expanded.has(node.key);

            return (
              <div
                key={node.key}
                role="treeitem"
                aria-selected={isSelected}
                className={
                  "cron-row" + (isSelected ? " is-selected" : "")
                }
                onClick={() => {
                  if (isSection) toggleSection(node.key);
                  else if (task) setSelectedName(task.name);
                }}
                onDoubleClick={() => {
                  if (task) {
                    setSelectedName(task.name);
                    setDialog({ kind: "edit", initial: task, isNew: false });
                  }
                }}
                onContextMenu={
                  task ? (e) => openTaskMenu(e, task) : undefined
                }
              >
                <div
                  className="cron-cell name"
                  style={{ paddingLeft: 8 + depth * 16 }}
                >
                  {isSection ? (
                    <button
                      className="cron-chevron"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSection(node.key);
                      }}
                      aria-label={isExpanded ? "Свернуть" : "Развернуть"}
                    >
                      {isExpanded ? "▾" : "▸"}
                    </button>
                  ) : (
                    <span className="cron-chevron-placeholder" />
                  )}
                  <span className="cron-icon">{isSection ? "📁" : "📄"}</span>
                  <span className="cron-label" title={node.label}>
                    {node.label}
                  </span>
                </div>

                <div className="cron-cell schedule mono">
                  {task?.schedule ?? ""}
                </div>
                <div className="cron-cell script">{task?.script ?? ""}</div>
                <div className="cron-cell uid">{task?.uid ?? ""}</div>
                <div className="cron-cell enabled">
                  {task && (
                    <input
                      type="checkbox"
                      checked={task.enabled}
                      onChange={() => handleToggle(task)}
                      onClick={(e) => e.stopPropagation()}
                      className="cron-checkbox"
                    />
                  )}
                </div>
                <div className="cron-cell section">{task?.section ?? ""}</div>
              </div>
            );
          })}
        </div>
      </div>

      {dialog.kind !== "none" && (
        <CronDialog
          initialValue={dialog.initial}
          isNew={dialog.isNew}
          scripts={scripts}
          onSubmit={handleSubmit}
          onCancel={() => setDialog({ kind: "none" })}
          saving={saving}
        />
      )}

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Удалить задачу?</h3>
            <p>{confirmDelete}</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setConfirmDelete(null)}>
                Отмена
              </button>
              <button className="btn danger" onClick={handleDelete}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="cron-toast">{toast}</div>}
    </div>
  );
}

function makeCopyName(base: string, existing: string[]): string {
  const stem = base.endsWith("_copy") ? base : `${base}_copy`;
  if (!existing.includes(stem)) return stem;
  let i = 2;
  while (existing.includes(`${stem}${i}`)) i++;
  return `${stem}${i}`;
}