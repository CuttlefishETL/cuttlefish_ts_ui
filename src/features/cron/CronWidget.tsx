import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CronApi } from "./api";
import { useCron } from "./useCron";
import {
  allSectionKeys,
  buildCronTree,
  canMoveSectionTo,
  flattenTree,
} from "./buildTree";
import { CronDialog } from "./CronDialog";
import type { CronEntry, CronTreeNode } from "./types";
import {
  getTaskSection,
  sectionName,
  validateSectionName,
} from "./types";
import { PromptDialog } from "../../components/PromptDialog";
import { act, sep, useContextMenu } from "../../components/context-menu";
import "./cron.css";

interface Props {
  api: CronApi;
}

type DialogState =
  | { kind: "none" }
  | { kind: "create"; initial: CronEntry | null; isNew: true; section: string }
  | { kind: "edit"; initial: CronEntry; isNew: false }
  | { kind: "copy"; initial: CronEntry; isNew: true; section: string };

type PromptState =
  | { kind: "none" }
  | { kind: "create-section"; parent: string }
  | { kind: "rename-section"; path: string };

type ConfirmState =
  | { kind: "task"; name: string }
  | { kind: "section"; path: string }
  | null;

type DragPayload =
  | { kind: "task"; name: string }
  | { kind: "section"; path: string };

export function CronWidget({ api }: Props) {
  const { openContextMenu } = useContextMenu();
  const {
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
  } = useCron(api);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [prompt, setPrompt] = useState<PromptState>({ kind: "none" });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const dragPayloadRef = useRef<DragPayload | null>(null);
  const dropCounterRef = useRef(0);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const tree = useMemo(
    () => buildCronTree(items, sections),
    [items, sections],
  );

  useEffect(() => {
    if (expanded.size === 0 && tree.length > 0) {
      setExpanded(allSectionKeys(tree));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.length]);

  const rows = useMemo(() => flattenTree(tree, expanded), [tree, expanded]);

  const selectedNode = useMemo(
    () => rows.find((r) => r.node.key === selectedKey)?.node ?? null,
    [rows, selectedKey],
  );

  const selectedTask =
    selectedNode?.type === "task" ? selectedNode.task ?? null : null;
  const selectedSectionPath =
    selectedNode?.type === "section" ? selectedNode.path : null;

  const expandPath = useCallback((path: string) => {
    if (!path) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      const parts = path.split("/");
      for (let i = 1; i <= parts.length; i++) {
        next.add(`sec:${parts.slice(0, i).join("/")}`);
      }
      return next;
    });
  }, []);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelect = (node: CronTreeNode) => {
    setDialog({ kind: "none" });
    setSelectedKey(node.key);
  };

  const handleAddTask = (sectionOverride?: string) => {
    const section = sectionOverride ?? selectedSectionPath ?? "";
    setDialog({ kind: "create", initial: null, isNew: true, section });
    setSelectedKey(null);
  };

  const handleEdit = (target?: CronEntry) => {
    const t = target ?? selectedTask;
    if (!t) return;
    setDialog({ kind: "edit", initial: t, isNew: false });
  };

  const handleCopy = (target?: CronEntry) => {
    const t = target ?? selectedTask;
    if (!t) return;
    const copyName = makeCopyName(t.name, items.map((x) => x.name));
    setDialog({
      kind: "copy",
      initial: { ...t, name: copyName },
      isNew: true,
      section: t.section,
    });
  };

  const handleSubmit = async (entry: CronEntry, originalName: string | null) => {
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
      setSelectedKey(`task:${entry.name}`);
      if (entry.section) expandPath(entry.section);
      await reload();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      if (confirmDelete.kind === "task") {
        await api.remove(confirmDelete.name);
        setToast(`Задача «${confirmDelete.name}» удалена`);
        if (selectedTask?.name === confirmDelete.name) setSelectedKey(null);
      } else {
        const err = await deleteSection(confirmDelete.path);
        if (err) {
          setToast(err);
        } else {
          setToast(`Секция «${confirmDelete.path}» удалена`);
          if (selectedSectionPath === confirmDelete.path) setSelectedKey(null);
        }
      }
      setConfirmDelete(null);
      await reload();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (task: CronEntry) => {
    const err = await toggleEnabled(task);
    if (err) setToast(err);
  };

  // -------- Prompt (section) --------

  const openCreateSection = (parent: string) => {
    setPrompt({ kind: "create-section", parent });
  };

  const openRenameSection = (path: string) => {
    setPrompt({ kind: "rename-section", path });
  };

  const handlePromptSubmit = async (value: string) => {
    if (prompt.kind === "create-section") {
      const err = validateSectionName(value);
      if (err) {
        setToast(err);
        return;
      }
      const newPath = prompt.parent ? `${prompt.parent}/${value}` : value;
      const opErr = await createSection(newPath);
      if (opErr) {
        setToast(opErr);
        return;
      }
      expandPath(prompt.parent);
      setToast(`Секция «${newPath}» создана`);
      setPrompt({ kind: "none" });
      await reload();
    } else if (prompt.kind === "rename-section") {
      const err = validateSectionName(value);
      if (err) {
        setToast(err);
        return;
      }
      const opErr = await renameSection(prompt.path, value);
      if (opErr) {
        setToast(opErr);
        return;
      }
      setToast("Секция переименована");
      setPrompt({ kind: "none" });
      await reload();
    }
  };

  // -------- DnD --------

  const handleDragStart = (e: React.DragEvent, node: CronTreeNode) => {
    if (node.type === "task" && node.task) {
      dragPayloadRef.current = { kind: "task", name: node.task.name };
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", `task:${node.task.name}`);
    } else if (node.type === "section") {
      dragPayloadRef.current = { kind: "section", path: node.path };
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", `section:${node.path}`);
    }
  };

  const handleDragOver = (e: React.DragEvent, node: CronTreeNode) => {
    const payload = dragPayloadRef.current;
    if (!payload) return;
    if (node.type !== "section") return;
    if (
      payload.kind === "section" &&
      !canMoveSectionTo(payload.path, node.path)
    ) {
      return;
    }
    if (payload.kind === "task") {
      const t = items.find((x) => x.name === payload.name);
      if (t && getTaskSection(t) === node.path) return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(node.key);
  };

  const handleDragEnter = () => {
    dropCounterRef.current += 1;
  };

  const handleDragLeave = (e: React.DragEvent) => {
    dropCounterRef.current = Math.max(0, dropCounterRef.current - 1);
    if (dropCounterRef.current === 0) setDropTarget(null);
    const next = e.relatedTarget as Node | null;
    if (next && (e.currentTarget as Node).contains(next)) {
      dropCounterRef.current += 1;
    }
  };

  const handleDrop = async (e: React.DragEvent, node: CronTreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    dropCounterRef.current = 0;
    const payload = dragPayloadRef.current;
    dragPayloadRef.current = null;
    if (!payload || node.type !== "section") return;

    if (payload.kind === "task") {
      const err = await moveTask(payload.name, node.path);
      if (err) setToast(err);
      else {
        expandPath(node.path);
        setToast(
          `Задача «${payload.name}» перемещена в «${node.path || "корень"}»`,
        );
      }
    } else if (payload.kind === "section") {
      if (!canMoveSectionTo(payload.path, node.path)) {
        setToast("Нельзя переместить секцию внутрь себя");
        return;
      }
      const err = await moveSection(payload.path, node.path);
      if (err) setToast(err);
      else {
        expandPath(node.path);
        setToast(
          `Секция «${sectionName(payload.path)}» перемещена в «${node.path || "корень"}»`,
        );
      }
    }
    await reload();
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    if (!dragPayloadRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget("__root__");
  };

  const handleRootDragLeave = (e: React.DragEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && (e.currentTarget as Node).contains(next)) return;
    if (dropTarget === "__root__") setDropTarget(null);
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDropTarget(null);
    const payload = dragPayloadRef.current;
    dragPayloadRef.current = null;
    if (!payload) return;

    if (payload.kind === "task") {
      const err = await moveTask(payload.name, "");
      if (err) setToast(err);
      else setToast(`Задача «${payload.name}» перемещена в корень`);
    } else if (payload.kind === "section") {
      const err = await moveSection(payload.path, "");
      if (err) setToast(err);
      else setToast(`Секция «${sectionName(payload.path)}» перемещена в корень`);
    }
    await reload();
  };

  // -------- Context menu --------

  const sectionForNode = (node: CronTreeNode | null): string => {
    if (!node) return "";
    if (node.type === "section") return node.path;
    if (node.type === "task" && node.task) return getTaskSection(node.task);
    return "";
  };

  const buildMenu = (node: CronTreeNode | null) => {
    const isSection = node?.type === "section";
    const isTask = node?.type === "task";
    const section = sectionForNode(node);
    const path = isSection ? node.path : "";

    return [
      act("Добавить задачу", () => handleAddTask(section)),
      act("Новая секция", () => openCreateSection(section)),
      sep(),
      act("Редактировать", () => {
        if (isTask && node.task) handleEdit(node.task);
      }, { disabled: !isTask }),
      act("Копировать", () => {
        if (isTask && node.task) handleCopy(node.task);
      }, { disabled: !isTask }),
      act("Переименовать секцию", () => {
        if (isSection) openRenameSection(path);
      }, { disabled: !isSection }),
      sep(),
      act("Удалить", () => {
        if (isTask && node.task) {
          setConfirmDelete({ kind: "task", name: node.task.name });
        } else if (isSection) {
          setConfirmDelete({ kind: "section", path });
        }
      }, { danger: true, disabled: !isTask && !isSection }),
      sep(),
      act("Обновить", () => void reload(), { disabled: loading }),
    ];
  };

  const openRowMenu = (e: React.MouseEvent, node: CronTreeNode) => {
    setSelectedKey(node.key);
    openContextMenu(e, buildMenu(node));
  };

  const openBlankMenu = (e: React.MouseEvent) => {
    openContextMenu(e, buildMenu(null));
  };

  return (
    <div className="cron-tab">
      <div className="cron-toolbar">
        <button className="btn" onClick={() => handleAddTask()}>
          Добавить
        </button>
        <button className="btn" onClick={() => openCreateSection("")}>
          Новая секция
        </button>
        <button
          className="btn"
          onClick={() => selectedSectionPath && openRenameSection(selectedSectionPath)}
          disabled={!selectedSectionPath}
        >
          Переименовать
        </button>
        <button
          className="btn"
          onClick={() => selectedTask && handleEdit(selectedTask)}
          disabled={!selectedTask}
        >
          Редактировать
        </button>
        <button
          className="btn"
          onClick={() => selectedTask && handleCopy(selectedTask)}
          disabled={!selectedTask}
        >
          Копировать
        </button>
        <button
          className="btn danger"
          onClick={() => {
            if (selectedTask) {
              setConfirmDelete({ kind: "task", name: selectedTask.name });
            } else if (selectedSectionPath) {
              setConfirmDelete({ kind: "section", path: selectedSectionPath });
            }
          }}
          disabled={!selectedTask && !selectedSectionPath}
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

        <span className="cron-stats">
          Задач: {items.length} · Секций: {sections.length}
        </span>
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

        <div
          className="cron-body"
          role="tree"
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
          onContextMenu={openBlankMenu}
        >
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
          {!loading && !error && items.length === 0 && sections.length === 0 && (
            <div className="cron-hint">
              Задачи не найдены. Нажмите «Добавить» или «Новая секция».
            </div>
          )}

          {rows.map(({ node, depth }) => {
            const isSection = node.type === "section";
            const task = node.task;
            const isSelected = node.key === selectedKey;
            const isExpanded = expanded.has(node.key);
            const isDrop = dropTarget === node.key;

            return (
              <div
                key={node.key}
                role="treeitem"
                aria-selected={isSelected}
                draggable={isSection || !!task}
                className={
                  "cron-row" +
                  (isSelected ? " is-selected" : "") +
                  (isDrop ? " is-drop-target" : "")
                }
                onClick={() => handleSelect(node)}
                onDoubleClick={() => {
                  if (isSection) toggleExpand(node.key);
                  else if (task) handleEdit(task);
                }}
                onContextMenu={(e) => openRowMenu(e, node)}
                onDragStart={(e) => handleDragStart(e, node)}
                onDragEnter={handleDragEnter}
                onDragOver={(e) => handleDragOver(e, node)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, node)}
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
                        toggleExpand(node.key);
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

          {dropTarget === "__root__" && rows.length > 0 && (
            <div className="cron-drop-root">Переместить в корень</div>
          )}
        </div>
      </div>

      {dialog.kind === "create" && (
        <CronDialog
          initialValue={
            dialog.section
              ? { ...(dialog.initial ?? emptyTask()), section: dialog.section }
              : dialog.initial
          }
          isNew={true}
          scripts={scripts}
          sections={sections}
          onSubmit={handleSubmit}
          onCancel={() => setDialog({ kind: "none" })}
          saving={saving}
        />
      )}

      {dialog.kind === "copy" && (
        <CronDialog
          initialValue={{ ...dialog.initial, section: dialog.section }}
          isNew={true}
          scripts={scripts}
          sections={sections}
          onSubmit={handleSubmit}
          onCancel={() => setDialog({ kind: "none" })}
          saving={saving}
        />
      )}

      {dialog.kind === "edit" && (
        <CronDialog
          initialValue={dialog.initial}
          isNew={false}
          scripts={scripts}
          sections={sections}
          onSubmit={handleSubmit}
          onCancel={() => setDialog({ kind: "none" })}
          saving={saving}
        />
      )}

      {prompt.kind !== "none" && (
        <PromptDialog
          title={
            prompt.kind === "create-section"
              ? "Новая секция"
              : "Переименовать секцию"
          }
          label="Имя секции"
          initialValue={
            prompt.kind === "rename-section" ? sectionName(prompt.path) : ""
          }
          placeholder="например, maintenance"
          validate={validateSectionName}
          onSubmit={handlePromptSubmit}
          onClose={() => setPrompt({ kind: "none" })}
        />
      )}

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {confirmDelete.kind === "task"
                ? "Удалить задачу?"
                : "Удалить секцию?"}
            </h3>
            <p>
              {confirmDelete.kind === "task"
                ? confirmDelete.name
                : confirmDelete.path}
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setConfirmDelete(null)}>
                Отмена
              </button>
              <button
                className="btn danger"
                onClick={handleDeleteConfirm}
                disabled={saving}
              >
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

function emptyTask(): CronEntry {
  return {
    name: "",
    schedule: "0 0 0 * * *",
    script: "",
    uid: "",
    section: "",
    enabled: true,
    description: "",
  };
}