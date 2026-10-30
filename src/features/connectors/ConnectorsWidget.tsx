import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ConnectorsApi, ConnectorInput } from "./api";
import { useConnectors } from "./useConnectors";
import { ConnectorProperties } from "./ConnectorProperties";
import {
  allFolderKeys,
  buildConnectorTree,
  canMoveFolderTo,
  flattenTree,
} from "./buildTree";
import type { ConnectorInstance, ConnectorTreeNode } from "./types";
import {
  connectorTypeIcon,
  directionShort,
  folderName,
  getConnectorFolder,
  parentPath,
  validateFolderName,
} from "./types";
import { PromptDialog } from "./PromptDialog";
import "./connectors.css";

interface Props {
  api: ConnectorsApi;
}

type DragPayload =
  | { kind: "connector"; name: string }
  | { kind: "folder"; path: string };

type PromptState =
  | { kind: "none" }
  | { kind: "create-folder"; parent: string }
  | { kind: "rename-folder"; path: string };

type ConfirmState =
  | { kind: "connector"; name: string }
  | { kind: "folder"; path: string }
  | null;

interface ContextMenuState {
  x: number;
  y: number;
  node: ConnectorTreeNode | null;  // null — правый клик по пустому месту
}

export function ConnectorsWidget({ api }: Props) {
  const {
    items,
    templates,
    templatesByType,
    folders,
    status,
    loading,
    error,
    reload,
    toggleEnabled,
    createFolder,
    deleteFolder,
    renameFolder,
    moveConnector,
    moveFolder,
  } = useConnectors(api);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingInFolder, setCreatingInFolder] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmState>(null);
  const [prompt, setPrompt] = useState<PromptState>({ kind: "none" });
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const dragPayloadRef = useRef<DragPayload | null>(null);
  const dropCounterRef = useRef(0);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // Закрытие контекстного меню: клик вне, Escape, прокрутка
  useEffect(() => {
    if (!contextMenu) return;
    const onClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    const onScroll = () => setContextMenu(null);
    window.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [contextMenu]);

  const tree = useMemo(
    () => buildConnectorTree(items, folders),
    [items, folders],
  );

  useEffect(() => {
    if (expanded.size === 0 && tree.length > 0) {
      setExpanded(allFolderKeys(tree));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.length]);

  const rows = useMemo(() => flattenTree(tree, expanded), [tree, expanded]);

  const selectedNode = useMemo(
    () => rows.find((r) => r.node.key === selectedKey)?.node ?? null,
    [rows, selectedKey],
  );

  const selectedConnector =
    selectedNode?.type === "connector" ? selectedNode.connector ?? null : null;
  const selectedFolderPath =
    selectedNode?.type === "folder" ? selectedNode.path : null;

  const isFormOpen = creating || selectedConnector !== null;

  const toggleExpand = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const expandPath = useCallback((path: string) => {
    if (!path) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      const parts = path.split("/");
      for (let i = 1; i <= parts.length; i++) {
        next.add(`folder:${parts.slice(0, i).join("/")}`);
      }
      return next;
    });
  }, []);

  const handleSelect = (node: ConnectorTreeNode) => {
    setCreating(false);
    setCreatingInFolder("");
    setSelectedKey(node.key);
  };

  const handleCreateConnector = (folderOverride?: string) => {
    const folder =
      folderOverride !== undefined
        ? folderOverride
        : selectedFolderPath ?? "";
    setCreating(true);
    setCreatingInFolder(folder);
    setSelectedKey(null);
  };

  const handleCancelForm = () => {
    setCreating(false);
    setCreatingInFolder("");
    setSelectedKey(null);
  };

  const handleSubmit = async (input: ConnectorInput) => {
    setBusy(true);
    try {
      if (creating) {
        const payload: ConnectorInput = creatingInFolder
          ? {
              ...input,
              metadata: { ...(input.metadata ?? {}), folder: creatingInFolder },
            }
          : input;
        await api.create(payload);
        setToast(`Коннектор «${input.name}» создан`);
        if (creatingInFolder) expandPath(creatingInFolder);
        setCreating(false);
        setCreatingInFolder("");
        setSelectedKey(`conn:${input.name}`);
      } else if (selectedConnector) {
        const fresh =
          items.find((x) => x.name === selectedConnector.name) ??
          selectedConnector;
        const payload: ConnectorInput = {
          ...input,
          metadata: fresh.metadata,
        };
        await api.update(selectedConnector.name, payload);
        setToast(`Коннектор «${input.name}» сохранён`);
        setSelectedKey(`conn:${input.name}`);
      }
      await reload();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (c: ConnectorInstance) => {
    const err = await toggleEnabled(c);
    if (err) setToast(err);
  };

  const handleTest = async (target?: ConnectorInstance | null) => {
    const c = target ?? selectedConnector;
    if (!c) return;
    setBusy(true);
    try {
      await api.test(c.name);
      setToast(`Соединение «${c.name}» в порядке`);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleReload = async () => {
    setBusy(true);
    try {
      await api.reload();
      await reload();
      setToast("Конфигурация коннекторов перезагружена");
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openDeleteConfirm = (target: {
    kind: "connector";
    name: string;
  } | {
    kind: "folder";
    path: string;
  } | null) => {
    if (!target) return;
    setConfirmDelete(target);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      if (confirmDelete.kind === "connector") {
        await api.remove(confirmDelete.name);
        setToast(`Коннектор «${confirmDelete.name}» удалён`);
        if (selectedConnector?.name === confirmDelete.name) {
          setSelectedKey(null);
        }
      } else {
        const err = await deleteFolder(confirmDelete.path);
        if (err) {
          setToast(err);
        } else {
          setToast(`Папка «${confirmDelete.path}» удалена`);
          if (selectedFolderPath === confirmDelete.path) {
            setSelectedKey(null);
          }
        }
      }
      setConfirmDelete(null);
      await reload();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const newFolderParent = (): string => {
    if (selectedFolderPath !== null) return selectedFolderPath;
    if (selectedConnector) return getConnectorFolder(selectedConnector);
    return "";
  };

  const openCreateFolder = (parentOverride?: string) => {
    const parent =
      parentOverride !== undefined ? parentOverride : newFolderParent();
    setPrompt({ kind: "create-folder", parent });
  };

  const openRenameFolder = (path?: string) => {
    const target = path ?? selectedFolderPath;
    if (target === null) return;
    setPrompt({ kind: "rename-folder", path: target });
  };

  const handlePromptSubmit = async (value: string) => {
    if (prompt.kind === "create-folder") {
      const err = validateFolderName(value);
      if (err) {
        setToast(err);
        return;
      }
      const newPath = prompt.parent ? `${prompt.parent}/${value}` : value;
      const opErr = await createFolder(newPath);
      if (opErr) {
        setToast(opErr);
        return;
      }
      expandPath(prompt.parent);
      setToast(`Папка «${newPath}» создана`);
      setPrompt({ kind: "none" });
      await reload();
    } else if (prompt.kind === "rename-folder") {
      const err = validateFolderName(value);
      if (err) {
        setToast(err);
        return;
      }
      const opErr = await renameFolder(prompt.path, value);
      if (opErr) {
        setToast(opErr);
        return;
      }
      setToast("Папка переименована");
      setPrompt({ kind: "none" });
      await reload();
    }
  };

  // -------- Drag & Drop --------

  const handleDragStart = (e: React.DragEvent, node: ConnectorTreeNode) => {
    if (node.type === "connector" && node.connector) {
      dragPayloadRef.current = { kind: "connector", name: node.connector.name };
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", `conn:${node.connector.name}`);
    } else if (node.type === "folder") {
      dragPayloadRef.current = { kind: "folder", path: node.path };
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", `folder:${node.path}`);
    }
  };

  const handleDragOver = (e: React.DragEvent, node: ConnectorTreeNode) => {
    const payload = dragPayloadRef.current;
    if (!payload) return;
    if (node.type !== "folder") return;
    if (payload.kind === "folder" && !canMoveFolderTo(payload.path, node.path)) {
      return;
    }
    if (payload.kind === "connector") {
      const c = items.find((x) => x.name === payload.name);
      if (c && getConnectorFolder(c) === node.path) return;
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
    if (dropCounterRef.current === 0) {
      setDropTarget(null);
    }
    const next = e.relatedTarget as Node | null;
    if (next && (e.currentTarget as Node).contains(next)) {
      dropCounterRef.current += 1;
    }
  };

  const handleDrop = async (e: React.DragEvent, node: ConnectorTreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    dropCounterRef.current = 0;
    const payload = dragPayloadRef.current;
    dragPayloadRef.current = null;
    if (!payload || node.type !== "folder") return;

    if (payload.kind === "connector") {
      const err = await moveConnector(payload.name, node.path);
      if (err) setToast(err);
      else {
        expandPath(node.path);
        setToast(
          `Коннектор «${payload.name}» перемещён в «${node.path || "корень"}»`,
        );
      }
    } else if (payload.kind === "folder") {
      if (!canMoveFolderTo(payload.path, node.path)) {
        setToast("Нельзя переместить папку внутрь себя");
        return;
      }
      const err = await moveFolder(payload.path, node.path);
      if (err) setToast(err);
      else {
        expandPath(node.path);
        setToast(
          `Папка «${folderName(payload.path)}» перемещена в «${node.path || "корень"}»`,
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

    if (payload.kind === "connector") {
      const err = await moveConnector(payload.name, "");
      if (err) setToast(err);
      else setToast(`Коннектор «${payload.name}» перемещён в корень`);
    } else if (payload.kind === "folder") {
      const err = await moveFolder(payload.path, "");
      if (err) setToast(err);
      else setToast(`Папка «${folderName(payload.path)}» перемещена в корень`);
    }
    await reload();
  };

  // -------- Context menu --------

  const openContextMenu = (e: React.MouseEvent, node: ConnectorTreeNode | null) => {
    e.preventDefault();
    e.stopPropagation();
    // если правый клик по элементу — выделяем его
    if (node) {
      if (node.type === "connector") {
        setSelectedKey(node.key);
        setCreating(false);
        setCreatingInFolder("");
      } else if (node.type === "folder") {
        setSelectedKey(node.key);
        setCreating(false);
        setCreatingInFolder("");
      }
    }
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleContextCreateConnector = () => {
    if (!contextMenu) return;
    const n = contextMenu.node;
    const folder =
      n === null
        ? ""
        : n.type === "folder"
          ? n.path
          : n.connector
            ? getConnectorFolder(n.connector)
            : "";
    closeContextMenu();
    handleCreateConnector(folder);
  };

  const handleContextCreateFolder = () => {
    if (!contextMenu) return;
    const n = contextMenu.node;
    const parent =
      n === null
        ? ""
        : n.type === "folder"
          ? n.path
          : n.connector
            ? getConnectorFolder(n.connector)
            : "";
    closeContextMenu();
    openCreateFolder(parent);
  };

  const handleContextRename = () => {
    if (!contextMenu) return;
    const n = contextMenu.node;
    if (!n || n.type !== "folder") return;
    closeContextMenu();
    openRenameFolder(n.path);
  };

  const handleContextDelete = () => {
    if (!contextMenu) return;
    const n = contextMenu.node;
    closeContextMenu();
    if (!n) return;
    if (n.type === "connector" && n.connector) {
      openDeleteConfirm({ kind: "connector", name: n.connector.name });
    } else if (n.type === "folder") {
      openDeleteConfirm({ kind: "folder", path: n.path });
    }
  };

  const handleContextTest = () => {
    if (!contextMenu) return;
    const n = contextMenu.node;
    closeContextMenu();
    if (n && n.type === "connector" && n.connector) {
      void handleTest(n.connector);
    }
  };

  const handleContextReload = () => {
    closeContextMenu();
    void handleReload();
  };

  const menuNodeType = contextMenu?.node?.type ?? null;
  const menuIsConnector = menuNodeType === "connector";
  const menuIsFolder = menuNodeType === "folder";

  return (
    <div className="connectors-tab">
      <div className="connectors-toolbar">
        <button className="btn" onClick={() => handleCreateConnector()} disabled={busy}>
          Создать
        </button>
        <button className="btn" onClick={() => openCreateFolder()} disabled={busy}>
          Новая папка
        </button>
        <button
          className="btn"
          onClick={() => openRenameFolder()}
          disabled={selectedFolderPath === null || busy}
        >
          Переименовать
        </button>
        <button
          className="btn danger"
          onClick={() => {
            if (selectedConnector) {
              setConfirmDelete({
                kind: "connector",
                name: selectedConnector.name,
              });
            } else if (selectedFolderPath !== null) {
              setConfirmDelete({ kind: "folder", path: selectedFolderPath });
            }
          }}
          disabled={(!selectedConnector && selectedFolderPath === null) || busy}
        >
          Удалить
        </button>
        <button
          className="btn"
          onClick={() => handleTest()}
          disabled={!selectedConnector || busy}
          title="Проверка соединения (в текущей версии ядра недоступна)"
        >
          Тест
        </button>
        <button className="btn" onClick={handleReload} disabled={busy}>
          Перезагрузить
        </button>

        <span className="connectors-spacer" />

        {status && (
          <span className="connectors-stats">
            Всего: {status.total_connectors} · Вкл:{" "}
            {status.enabled_connectors} · Откл: {status.disabled_connectors}
          </span>
        )}
      </div>

      <div className="connectors-main">
        <div className="connectors-list">
          <div className="connectors-list-header">
            <div className="col-name">Имя</div>
            <div className="col-type">Тип</div>
            <div className="col-enabled">Вкл.</div>
            <div className="col-tags">Теги</div>
            <div className="col-direction" title="Направление">
              ↔
            </div>
          </div>

          <div
            className="connectors-list-body"
            role="tree"
            onDragOver={handleRootDragOver}
            onDragLeave={handleRootDragLeave}
            onDrop={handleRootDrop}
            onContextMenu={(e) => openContextMenu(e, null)}
          >
            {loading && items.length === 0 && (
              <div className="connectors-hint">Загрузка…</div>
            )}
            {error && items.length === 0 && (
              <div className="connectors-hint">
                {error}{" "}
                <button className="btn" onClick={() => void reload()}>
                  Повторить
                </button>
              </div>
            )}
            {!loading &&
              !error &&
              items.length === 0 &&
              folders.length === 0 && (
                <div className="connectors-hint">
                  Коннекторы не найдены. Нажмите «Создать» или «Новая папка».
                </div>
              )}

            {rows.map(({ node, depth }) => {
              const isFolder = node.type === "folder";
              const c = node.connector;
              const isSelected = node.key === selectedKey;
              const isExpanded = expanded.has(node.key);
              const isDrop = dropTarget === node.key;

              return (
                <div
                  key={node.key}
                  role="treeitem"
                  aria-selected={isSelected}
                  draggable={isFolder || !!c}
                  className={
                    "connectors-row" +
                    (isSelected ? " is-selected" : "") +
                    (isDrop ? " is-drop-target" : "")
                  }
                  onClick={() => handleSelect(node)}
                  onDoubleClick={() => {
                    if (isFolder) toggleExpand(node.key);
                  }}
                  onContextMenu={(e) => openContextMenu(e, node)}
                  onDragStart={(e) => handleDragStart(e, node)}
                  onDragEnter={handleDragEnter}
                  onDragOver={(e) => handleDragOver(e, node)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, node)}
                >
                  <div
                    className="connectors-cell name"
                    style={{ paddingLeft: 8 + depth * 16 }}
                  >
                    {isFolder ? (
                      <button
                        className="connectors-chevron"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(node.key);
                        }}
                        aria-label={isExpanded ? "Свернуть" : "Развернуть"}
                      >
                        {isExpanded ? "▾" : "▸"}
                      </button>
                    ) : (
                      <span className="connectors-chevron-placeholder" />
                    )}
                    <span className="connectors-icon">
                      {isFolder ? "📁" : connectorTypeIcon(c?.type ?? "")}
                    </span>
                    <span className="connectors-label" title={node.label}>
                      {node.label}
                    </span>
                  </div>

                  <div className="connectors-cell type">{c?.type ?? ""}</div>

                  <div className="connectors-cell enabled">
                    {c && (
                      <input
                        type="checkbox"
                        checked={c.enabled}
                        onChange={() => handleToggle(c)}
                        onClick={(e) => e.stopPropagation()}
                        className="connectors-checkbox"
                      />
                    )}
                  </div>

                  <div
                    className="connectors-cell tags"
                    title={(c?.tags ?? []).join(", ")}
                  >
                    {c ? (c.tags ?? []).join(", ") : ""}
                  </div>

                  <div
                    className="connectors-cell direction"
                    title={c?.direction}
                  >
                    {c ? directionShort(c.direction) : ""}
                  </div>
                </div>
              );
            })}

            {dropTarget === "__root__" && rows.length > 0 && (
              <div className="connectors-drop-root">Переместить в корень</div>
            )}
          </div>
        </div>

        <div className="connectors-props">
          {!isFormOpen && selectedFolderPath === null && (
            <div className="connectors-hint props-hint">
              Выберите коннектор или папку в дереве
            </div>
          )}

          {!isFormOpen && selectedFolderPath !== null && (
            <div className="props">
              <div className="props-header">
                Папка «{selectedFolderPath}»
              </div>
              <div className="props-body">
                <div className="prop-row">
                  <div className="prop-label">Путь</div>
                  <div className="prop-value mono">{selectedFolderPath}</div>
                </div>
                <div className="prop-row">
                  <div className="prop-label">Родитель</div>
                  <div className="prop-value mono">
                    {parentPath(selectedFolderPath) || "корень"}
                  </div>
                </div>
                <div className="prop-row">
                  <div className="prop-label">Коннекторов</div>
                  <div className="prop-value">
                    {
                      items.filter(
                        (c) => getConnectorFolder(c) === selectedFolderPath,
                      ).length
                    }
                  </div>
                </div>
                <div className="prop-row">
                  <div className="prop-label">Вложенных папок</div>
                  <div className="prop-value">
                    {
                      folders.filter(
                        (p) =>
                          p !== selectedFolderPath &&
                          p.startsWith(selectedFolderPath + "/"),
                      ).length
                    }
                  </div>
                </div>
              </div>
            </div>
          )}

          {isFormOpen && (
            <ConnectorProperties
              key={creating ? "__new__" : selectedConnector!.name}
              initialValue={creating ? null : selectedConnector}
              templates={templates}
              templatesByType={templatesByType}
              folderPath={creating ? creatingInFolder : undefined}
              onSubmit={handleSubmit}
              onCancel={handleCancelForm}
              saving={busy}
            />
          )}
        </div>
      </div>

      {prompt.kind !== "none" && (
        <PromptDialog
          title={
            prompt.kind === "create-folder"
              ? "Новая папка"
              : "Переименовать папку"
          }
          label="Имя папки"
          initialValue={
            prompt.kind === "rename-folder" ? folderName(prompt.path) : ""
          }
          placeholder="например, prod-api"
          validate={validateFolderName}
          onSubmit={handlePromptSubmit}
          onClose={() => setPrompt({ kind: "none" })}
        />
      )}

      {confirmDelete && (
        <div
          className="modal-backdrop"
          onClick={() => setConfirmDelete(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {confirmDelete.kind === "connector"
                ? "Удалить коннектор?"
                : "Удалить папку?"}
            </h3>
            <p>
              {confirmDelete.kind === "connector"
                ? confirmDelete.name
                : confirmDelete.path}
            </p>
            <div className="modal-actions">
              <button
                className="btn"
                onClick={() => setConfirmDelete(null)}
              >
                Отмена
              </button>
              <button
                className="btn danger"
                onClick={handleDeleteConfirm}
                disabled={busy}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            className="context-menu-item"
            onClick={handleContextCreateConnector}
            disabled={busy}
          >
            Создать коннектор
          </button>
          <button
            className="context-menu-item"
            onClick={handleContextCreateFolder}
            disabled={busy}
          >
            Новая папка
          </button>

          <div className="context-menu-sep" />

          <button
            className="context-menu-item"
            onClick={handleContextRename}
            disabled={!menuIsFolder || busy}
          >
            Переименовать
          </button>
          <button
            className="context-menu-item danger"
            onClick={handleContextDelete}
            disabled={(!menuIsConnector && !menuIsFolder) || busy}
          >
            Удалить
          </button>

          <div className="context-menu-sep" />

          <button
            className="context-menu-item"
            onClick={handleContextTest}
            disabled={!menuIsConnector || busy}
          >
            Тест
          </button>
          <button
            className="context-menu-item"
            onClick={handleContextReload}
            disabled={busy}
          >
            Перезагрузить
          </button>
        </div>
      )}

      {toast && <div className="connectors-toast">{toast}</div>}
    </div>
  );
}