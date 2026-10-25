import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import "./App.css";

import { NodeId, ServerLeaf, ServerNode, TabId } from "./types";
import { CURRENT_VERSION, parseSettings, serializeSettings } from "./appSettings";
import {
  findNode,
  findPath,
  insertChild,
  isServer,
  makeId,
  moveNode,
  removeNode,
  updateNode,
  walkLeaves,
} from "./treeUtils";
import { INITIAL_SERVERS, SETTINGS_TABS } from "./data";
import { CheckStatus, checkConnection } from "./checkConnection";
import { Sidebar } from "./components/Sidebar";
import { TabsPanel } from "./components/TabsPanel";
import { MenuBar } from "./components/MenuBar";
import { AboutDialog } from "./components/AboutDialog";
import { AuthDialog } from "./components/AuthDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ContextMenu, ContextMenuItem } from "./components/ContextMenu";
import { ServerEditDialog, ServerEditDraft } from "./components/ServerEditDialog";
import { baseNameOf } from "./pathUtils";

const LS_EXPANDED = "cuttlefish.expanded";
const LS_SIDEBAR_WIDTH = "cuttlefish.sidebarWidth";
const LS_RECENT = "cuttlefish.recentFiles";

function loadExpanded(): Set<NodeId> {
  try {
    const raw = localStorage.getItem(LS_EXPANDED);
    return new Set(raw ? (JSON.parse(raw) as NodeId[]) : []);
  } catch {
    return new Set();
  }
}

function loadSidebarWidth(): number {
  const raw = localStorage.getItem(LS_SIDEBAR_WIDTH);
  const n = raw ? Number(raw) : 260;
  return Number.isFinite(n) && n >= 160 && n <= 500 ? n : 260;
}

function loadRecentFiles(): string[] {
  try {
    const raw = localStorage.getItem(LS_RECENT);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

interface EditState {
  mode: "add" | "edit";
  kind: "folder" | "server";
  parentId: NodeId | null;
  editingId: NodeId | null;
  initial: ServerEditDraft;
}

interface CtxMenuState {
  x: number;
  y: number;
  targetId: NodeId | null;
}

interface DeleteState {
  id: NodeId;
  name: string;
  leafCount: number;
}

export default function App() {
  const [servers, setServers] = useState<ServerNode[]>(INITIAL_SERVERS);
  const [selectedId, setSelectedId] = useState<NodeId | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("settings");
  const [expanded, setExpanded] = useState<Set<NodeId>>(loadExpanded);
  const [statusById, setStatusById] = useState<Record<NodeId, CheckStatus>>({});
  const [sidebarWidth, setSidebarWidth] = useState<number>(loadSidebarWidth);
  const [settingsFilePath, setSettingsFilePath] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<string[]>(loadRecentFiles);
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DeleteState | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [statusText, setStatusText] = useState("");

  // --- persistence helpers ---
  const persistExpanded = (next: Set<NodeId>) => {
    try { localStorage.setItem(LS_EXPANDED, JSON.stringify([...next])); } catch { /* noop */ }
  };
  const persistSidebarWidth = (w: number) => {
    try { localStorage.setItem(LS_SIDEBAR_WIDTH, String(w)); } catch { /* noop */ }
  };
  const persistRecent = (list: string[]) => {
    try { localStorage.setItem(LS_RECENT, JSON.stringify(list)); } catch { /* noop */ }
  };

  const pushRecent = (path: string) => {
    setRecentFiles((prev) => {
      const next = [path, ...prev.filter((p) => p !== path)].slice(0, 10);
      persistRecent(next);
      return next;
    });
  };

  const expandParent = (id: NodeId) => {
    setExpanded((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      persistExpanded(next);
      return next;
    });
  };

  // --- derived ---
  const selectedNode = selectedId ? findNode(servers, selectedId) : null;
  const selectedLeaf: ServerLeaf | null =
    selectedNode && isServer(selectedNode) ? selectedNode : null;

  const breadcrumbs = useMemo(
    () => (selectedId ? findPath(servers, selectedId) : []),
    [servers, selectedId],
  );

  // --- expand / collapse ---
  const toggleExpand = (id: NodeId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persistExpanded(next);
      return next;
    });
  };

  // --- connection checks ---
  const checkOne = async (leaf: ServerLeaf) => {
    setStatusById((p) => ({ ...p, [leaf.id]: "checking" }));
    try {
      const ok = await checkConnection(leaf.url, leaf.port);
      setStatusById((p) => ({ ...p, [leaf.id]: ok ? "ok" : "error" }));
    } catch {
      setStatusById((p) => ({ ...p, [leaf.id]: "error" }));
    }
  };

  const checkAll = async (nodes: ServerNode[] = servers) => {
    const leaves = walkLeaves(nodes);
    await Promise.all(leaves.map(checkOne));
  };

  // --- add / edit ---
  const openAdd = (kind: "folder" | "server", parentId: NodeId | null) => {
    setEditState({
      mode: "add",
      kind,
      parentId,
      editingId: null,
      initial: { kind, name: "", parentId, url: "localhost", port: 8080 },
    });
  };

  const openEdit = (id: NodeId) => {
    const node = findNode(servers, id);
    if (!node) return;
    const path = findPath(servers, id);
    const parent = path.length > 1 ? path[path.length - 2] : null;
    setEditState({
      mode: "edit",
      kind: node.kind,
      parentId: parent?.id ?? null,
      editingId: id,
      initial: {
        kind: node.kind,
        name: node.name,
        parentId: parent?.id ?? null,
        url: isServer(node) ? node.url : "localhost",
        port: isServer(node) ? node.port : 8080,
      },
    });
  };

  const saveEdit = (draft: ServerEditDraft) => {
    if (!editState) return;

    if (editState.mode === "add") {
      const node: ServerNode =
        draft.kind === "folder"
          ? { id: makeId(), kind: "folder", name: draft.name, children: [] }
          : {
              id: makeId(),
              kind: "server",
              name: draft.name,
              url: draft.url,
              port: draft.port,
            };
      setServers((prev) => insertChild(prev, draft.parentId, node));
      if (draft.parentId) expandParent(draft.parentId);
      setSelectedId(node.id);
    } else {
      const id = editState.editingId!;
      setServers((prev) => {
        const currentPath = findPath(prev, id);
        const currentParent =
          currentPath.length > 1 ? currentPath[currentPath.length - 2] : null;
        let next = updateNode(prev, id, {
          name: draft.name,
          ...(draft.kind === "server"
            ? { url: draft.url, port: draft.port }
            : {}),
        } as Partial<ServerNode>);
        if ((currentParent?.id ?? null) !== draft.parentId) {
          next = moveNode(next, id, draft.parentId);
        }
        return next;
      });
      if (draft.parentId) expandParent(draft.parentId);
    }
    setEditState(null);
  };

  // --- delete ---
  const askDelete = (id: NodeId) => {
    const node = findNode(servers, id);
    if (!node) return;
    const leafCount = isServer(node) ? 0 : walkLeaves([node]).length;
    setConfirmDelete({ id, name: node.name, leafCount });
  };

  const doDelete = () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    const next = removeNode(servers, id);
    setServers(next);

    setExpanded((prev) => {
      const s = new Set(prev);
      s.delete(id);
      persistExpanded(s);
      return s;
    });

    if (selectedId && !findNode(next, selectedId)) setSelectedId(null);

    setStatusById((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

    setConfirmDelete(null);
  };

  // --- context menu ---
  const openContext = (id: NodeId | null, x: number, y: number) => {
    setCtxMenu({ x, y, targetId: id });
  };

  const contextItems = (): ContextMenuItem[] => {
    if (!ctxMenu) return [];
    const id = ctxMenu.targetId;
    if (id === null) {
      return [
        { label: "Добавить сервер", onClick: () => openAdd("server", null) },
        { label: "Добавить папку", onClick: () => openAdd("folder", null) },
      ];
    }
    const node = findNode(servers, id);
    if (!node) return [];
    if (node.kind === "folder") {
      return [
        { label: "Добавить сервер", onClick: () => openAdd("server", id) },
        { label: "Добавить папку", onClick: () => openAdd("folder", id) },
        { label: "Переименовать", onClick: () => openEdit(id) },
        { label: "Удалить", onClick: () => askDelete(id), danger: true },
      ];
    }
    return [
      { label: "Подключиться", onClick: () => void checkOne(node) },
      { label: "Изменить", onClick: () => openEdit(id) },
      { label: "Удалить", onClick: () => askDelete(id), danger: true },
    ];
  };

  // --- config save/load ---
  const saveConfig = async (forceDialog = false) => {
    try {
      let target = forceDialog ? null : settingsFilePath;
      if (!target) {
        const chosen = await save({
          filters: [{ name: "JSON", extensions: ["json"] }],
          defaultPath: "cuttlefish.json",
        });
        if (!chosen) return;
        target = chosen;
      }
      const content = serializeSettings({ version: CURRENT_VERSION, servers });
      await invoke("save_settings_file", { path: target, content });
      setSettingsFilePath(target);
      pushRecent(target);
      setStatusText(`Сохранено: ${baseNameOf(target)}`);
    } catch (e) {
      setStatusText(`Ошибка сохранения: ${String(e)}`);
    }
  };

  const loadConfig = async (path?: string) => {
    try {
      let target = path;
      if (!target) {
        const chosen = await open({
          filters: [{ name: "JSON", extensions: ["json"] }],
          multiple: false,
        });
        if (!chosen || Array.isArray(chosen)) return;
        target = chosen;
      }
      const text = await invoke<string>("load_settings_file", { path: target });
      const parsed = parseSettings(text);
      setServers(parsed.servers);
      setSettingsFilePath(target);
      pushRecent(target);
      setSelectedId(null);
      setStatusText(`Загружено: ${baseNameOf(target)}`);
      void checkAll(parsed.servers);
    } catch (e) {
      setStatusText(`Ошибка загрузки: ${String(e)}`);
    }
  };

  const newConfig = () => {
    setServers([]);
    setSelectedId(null);
    setSettingsFilePath(null);
    setStatusText("Новый конфиг");
  };

  // --- sidebar resize ---
  const draggingRef = useRef(false);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const w = Math.min(500, Math.max(160, e.clientX));
      setSidebarWidth(w);
      persistSidebarWidth(w);
    };
    const onUp = () => { draggingRef.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startResize = () => { draggingRef.current = true; };

  // --- initial check ---
  useEffect(() => {
    if (servers.length > 0) void checkAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app">
      <MenuBar
        onNew={newConfig}
        onOpen={() => void loadConfig()}
        onSave={() => void saveConfig(false)}
        onSaveAs={() => void saveConfig(true)}
        onCheckAll={() => void checkAll()}
        onAbout={() => setShowAbout(true)}
        onAuth={() => setShowAuth(true)}
        onSettings={() => setShowSettings(true)}
        recentFiles={recentFiles}
        onOpenRecent={(p) => void loadConfig(p)}
        statusText={statusText}
      />

      <div className="app-body">
        <Sidebar
          width={sidebarWidth}
          nodes={servers}
          expanded={expanded}
          selectedId={selectedId}
          statusById={statusById}
          onToggle={toggleExpand}
          onSelect={(leaf) => setSelectedId(leaf.id)}
          onContext={(id, x, y) => openContext(id, x, y)}
          onRootContext={(x, y) => openContext(null, x, y)}
          onAdd={() => openAdd("server", null)}
        />
        <div className="resizer" onMouseDown={startResize} />

        <main className="main-area">
          {breadcrumbs.length > 0 && (
            <div className="breadcrumbs">
              {breadcrumbs.map((n, i) => (
                <span key={n.id} className="breadcrumb-item">
                  {i > 0 && <span className="breadcrumb-sep"> / </span>}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedId(n.id);
                    }}
                  >
                    {n.name}
                  </a>
                </span>
              ))}
            </div>
          )}

          {selectedLeaf ? (
            <TabsPanel
              tabs={SETTINGS_TABS}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              server={selectedLeaf}
              status={statusById[selectedLeaf.id] ?? "idle"}
              onRecheck={() => void checkOne(selectedLeaf)}
            />
          ) : (
            <div className="placeholder">
              {selectedNode && selectedNode.kind === "folder"
                ? `Папка «${selectedNode.name}» — выберите сервер`
                : "Выберите сервер в списке слева"}
            </div>
          )}
        </main>
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={contextItems()}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {editState && (
        <ServerEditDialog
          servers={servers}
          mode={editState.mode}
          initial={editState.initial}
          editingId={editState.editingId}
          onSave={saveEdit}
          onCancel={() => setEditState(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Удаление"
          message={
            confirmDelete.leafCount > 0
              ? `Удалить «${confirmDelete.name}» вместе с ${confirmDelete.leafCount} сервер(ами)?`
              : `Удалить «${confirmDelete.name}»?`
          }
          confirmLabel="Удалить"
          danger
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      {showAuth && <AuthDialog onClose={() => setShowAuth(false)} />}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  );
}