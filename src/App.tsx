import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import  "./styles/app.css";

import { MenuBar } from "./components/MenuBar";
import { Sidebar } from "./components/Sidebar";
import { TabsPanel } from "./components/TabsPanel";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { AboutDialog } from "./components/AboutDialog";
import { AuthDialog } from "./components/AuthDialog";
import { SettingsDialog } from "./components/SettingsDialog";

import { INITIAL_SERVERS, SETTINGS_TABS, createServer, createFolder } from "./data";
import type { Server, ServerNode, TabId } from "./types";
import { checkConnection, type CheckStatus } from "./checkConnection";

import {
  loadAppSettings,
  saveAppSettings,
  type AppSettings,
} from "./appSettings";

import {
  flattenServers,
  findServerById,
  findNodeById,
  insertNode,
  removeNode,
  updateServer,
  updateNodeName,
  countServersIn,
  collectIds,
  moveNode,
} from "./treeUtils";

const MIN_WIDTH = 160;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 260;
const STORAGE_KEY = "sidebar-width";
const FILE_KEY = "current-settings-file";
const RECENT_KEY = "recent-files";
const MAX_RECENT = 8;

interface SettingsFile {
  version: 2;
  servers: ServerNode[];
}

function loadSidebarWidth(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  const num = raw ? Number(raw) : NaN;
  if (Number.isFinite(num)) {
    return Math.min(Math.max(num, MIN_WIDTH), MAX_WIDTH);
  }
  return DEFAULT_WIDTH;
}

function loadRecentFiles(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return arr
        .filter((x): x is string => typeof x === "string")
        .slice(0, MAX_RECENT);
    }
  } catch {
    // игнорируем повреждённое значение
  }
  return [];
}

function pushRecent(list: string[], path: string): string[] {
  return [path, ...list.filter((p) => p !== path)].slice(0, MAX_RECENT);
}

function serialize(servers: ServerNode[]): string {
  const data: SettingsFile = { version: 2, servers };
  return JSON.stringify(data, null, 2);
}

function normalizeNode(raw: any, index: number): ServerNode {
  const id = String(
    raw?.id ??
      `${raw?.kind === "folder" ? "folder" : "server"}-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
  );
  const name = String(raw?.name ?? "");
  if (raw && raw.kind === "folder") {
    const children = Array.isArray(raw.children)
      ? raw.children.map((c: any, i: number) => normalizeNode(c, i))
      : [];
    return { id, kind: "folder", name, children };
  }
  return {
    id,
    kind: "server",
    name,
    url: String(raw?.url ?? ""),
    port: Number(raw?.port) || 0,
  };
}

function parseSettings(text: string): ServerNode[] {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.servers)) {
    throw new Error("Некорректный формат файла настроек");
  }
  return data.servers.map((n: any, i: number) => normalizeNode(n, i));
}

function App() {
  const initialPathRef = useRef<string | null>(localStorage.getItem(FILE_KEY));

  const initialFirstServerId = useMemo(
    () => flattenServers(INITIAL_SERVERS)[0]?.id ?? null,
    [],
  );

  const [servers, setServers] = useState<ServerNode[]>(INITIAL_SERVERS);
  const [selectedId, setSelectedId] = useState<string | null>(initialFirstServerId);
  const [openTabs, setOpenTabs] = useState<string[]>(
    initialFirstServerId ? [initialFirstServerId] : [],
  );
  const [activeTab, setActiveTab] = useState<string | null>(initialFirstServerId);
  const [activeSubTabs, setActiveSubTabs] = useState<Record<string, TabId>>({});

  const [savedServers, setSavedServers] = useState<Set<string>>(new Set());
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

  const [checkStatuses, setCheckStatuses] = useState<Record<string, CheckStatus>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [authTarget, setAuthTarget] = useState<Server | null>(null);

  const [currentFilePath, setCurrentFilePath] = useState<string | null>(
    initialPathRef.current,
  );
  const [dirty, setDirty] = useState(false);

  const [recentFiles, setRecentFiles] = useState<string[]>(loadRecentFiles);

  const [sidebarWidth, setSidebarWidth] = useState<number>(loadSidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ServerNode | null>(null);
  const [pendingClose, setPendingClose] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const [appSettings, setAppSettings] = useState<AppSettings>(loadAppSettings);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);

  const bypassCloseCheck = useRef(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const flatServers = useMemo(() => flattenServers(servers), [servers]);

  // --- Проверки ---
  const runChecks = async (list: Server[]) => {
    if (list.length === 0) return;
    setCheckStatuses((prev) => {
      const next = { ...prev };
      list.forEach((s) => {
        next[s.id] = "checking";
      });
      return next;
    });
    await Promise.all(
      list.map(async (s) => {
        const res = await checkConnection(s.url, s.port);
        setCheckStatuses((prev) => ({ ...prev, [s.id]: res.status }));
      }),
    );
  };

  const applyLoadedServers = (loaded: ServerNode[]) => {
    setServers(loaded);
    const flat = flattenServers(loaded);
    setSavedServers(new Set(flat.map((s) => s.id)));
    const first = flat[0]?.id ?? null;
    setSelectedId(first);
    setOpenTabs(first ? [first] : []);
    setActiveTab(first);
    setActiveSubTabs({});
    setConnectedIds(new Set());
    setDirty(false);
    runChecks(flat);
  };

  // --- Работа со списком последних файлов ---
  const addRecent = (path: string) => {
    setRecentFiles((prev) => pushRecent(prev, path));
  };

  const removeRecent = (path: string) => {
    setRecentFiles((prev) => prev.filter((p) => p !== path));
  };

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentFiles));
  }, [recentFiles]);

  // --- Загрузка последнего файла при старте ---
  useEffect(() => {
    const path = initialPathRef.current;
    (async () => {
      if (path) {
        try {
          const text = await invoke<string>("read_file", { path });
          const loaded = parseSettings(text);
          applyLoadedServers(loaded);
          addRecent(path);
          return;
        } catch (err) {
          console.warn("Не удалось открыть последний файл настроек:", err);
          localStorage.removeItem(FILE_KEY);
          setCurrentFilePath(null);
          removeRecent(path);
        }
      }
      runChecks(flattenServers(INITIAL_SERVERS));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Сплиттер ---
  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      setSidebarWidth(Math.min(Math.max(e.clientX, MIN_WIDTH), MAX_WIDTH));
    };
    const onUp = () => setIsResizing(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [isResizing]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    getCurrentWindow()
      .setTitle("Cuttlefish-UI")
      .catch((err) =>
        console.warn("Не удалось установить заголовок окна:", err),
      );
  }, []);

  // --- Перехват закрытия ---
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const appWindow = getCurrentWindow();
        const fn = await appWindow.onCloseRequested(async (event) => {
          if (bypassCloseCheck.current) return;
          if (dirtyRef.current) {
            event.preventDefault();
            setPendingClose(true);
          }
        });
        if (cancelled) fn();
        else unlisten = fn;
      } catch (err) {
        console.warn("Не удалось подписаться на закрытие окна:", err);
      }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const handleCloseConfirm = async () => {
    setPendingClose(false);
    bypassCloseCheck.current = true;
    try {
      await getCurrentWindow().destroy();
    } catch (err) {
      console.error("Ошибка закрытия окна:", err);
      bypassCloseCheck.current = false;
    }
  };

  const handleExit = async () => {
    if (dirty) {
      setPendingClose(true);
      return;
    }
    try {
      await getCurrentWindow().destroy();
    } catch (err) {
      console.error("Ошибка выхода из программы:", err);
    }
  };

  // --- Файловые операции ---
  const saveAs = async (): Promise<boolean> => {
    try {
      const path = await saveDialog({
        title: "Сохранить файл настроек",
        defaultPath: currentFilePath ?? "servers.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path || typeof path !== "string") return false;
      await invoke("write_file", { path, content: serialize(servers) });
      setCurrentFilePath(path);
      localStorage.setItem(FILE_KEY, path);
      setSavedServers(new Set(flatServers.map((s) => s.id)));
      setDirty(false);
      addRecent(path);
      return true;
    } catch (err) {
      alert(`Не удалось сохранить файл: ${err}`);
      return false;
    }
  };

  const saveToCurrent = async (): Promise<boolean> => {
    if (!currentFilePath) return saveAs();
    try {
      await invoke("write_file", {
        path: currentFilePath,
        content: serialize(servers),
      });
      setSavedServers(new Set(flatServers.map((s) => s.id)));
      setDirty(false);
      return true;
    } catch (err) {
      alert(`Не удалось сохранить файл: ${err}`);
      return false;
    }
  };

  const handleSaveAppSettings = (next: AppSettings) => {
    setAppSettings(next);
    saveAppSettings(next);
    setAppSettingsOpen(false);
  };

  const handleNewFile = () => {
    if (
      dirty &&
      !confirm(
        "Есть несохранённые изменения. Создать новый файл без сохранения?",
      )
    ) {
      return;
    }
    setServers([]);
    setSavedServers(new Set());
    setSelectedId(null);
    setOpenTabs([]);
    setActiveTab(null);
    setActiveSubTabs({});
    setConnectedIds(new Set());
    setCheckStatuses({});
    setCurrentFilePath(null);
    localStorage.removeItem(FILE_KEY);
    setDirty(false);
  };

  const handleOpenFile = async () => {
    if (
      dirty &&
      !confirm(
        "Есть несохранённые изменения. Открыть другой файл без сохранения?",
      )
    ) {
      return;
    }
    try {
      const path = await openDialog({
        title: "Открыть файл настроек",
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path || typeof path !== "string") return;
      const text = await invoke<string>("read_file", { path });
      const loaded = parseSettings(text);
      applyLoadedServers(loaded);
      setCurrentFilePath(path);
      localStorage.setItem(FILE_KEY, path);
      addRecent(path);
    } catch (err) {
      alert(`Не удалось открыть файл: ${err}`);
    }
  };

  const handleOpenRecent = async (path: string) => {
    if (path === currentFilePath) return;
    if (
      dirty &&
      !confirm(
        "Есть несохранённые изменения. Открыть другой файл без сохранения?",
      )
    ) {
      return;
    }
    try {
      const text = await invoke<string>("read_file", { path });
      const loaded = parseSettings(text);
      applyLoadedServers(loaded);
      setCurrentFilePath(path);
      localStorage.setItem(FILE_KEY, path);
      addRecent(path);
    } catch (err) {
      alert(`Не удалось открыть файл: ${err}`);
      removeRecent(path);
    }
  };

  // --- Вкладки ---
  const openServerTab = (serverId: string) => {
    setSelectedId(serverId);
    setOpenTabs((prev) =>
      prev.includes(serverId) ? prev : [...prev, serverId],
    );
    setActiveTab(serverId);
  };

  const handleSelectNode = (id: string) => {
    const node = findNodeById(servers, id);
    if (node && node.kind === "server") {
      openServerTab(id);
    } else {
      setSelectedId(id);
    }
  };

  const closeTab = (serverId: string) => {
    setOpenTabs((prev) => {
      const next = prev.filter((id) => id !== serverId);
      if (activeTab === serverId) {
        const nextActive = next.length > 0 ? next[next.length - 1] : null;
        setActiveTab(nextActive);
        if (selectedId === serverId) setSelectedId(nextActive);
      }
      return next;
    });
  };

  // --- Добавление узлов ---
  const handleAddServer = (parentId: string | null) => {
    const server = createServer();
    setServers((prev) => insertNode(prev, parentId, server));
    openServerTab(server.id);
    setDirty(true);
    runChecks([server]);
  };

  const handleAddFolder = (parentId: string | null) => {
    const folder = createFolder();
    setServers((prev) => insertNode(prev, parentId, folder));
    setSelectedId(folder.id);
    setDirty(true);
  };

  const handleRename = (id: string, currentName: string) => {
    const name = window.prompt("Новое название", currentName);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setServers((prev) => updateNodeName(prev, id, trimmed));
    setDirty(true);
  };

  const handleMoveNode = (nodeId: string, newParentId: string | null) => {
    const next = moveNode(servers, nodeId, newParentId);
    if (next === servers) return;
    setServers(next);
    setDirty(true);
  };

  // --- Удаление ---
  const handleDeleteNode = (id: string) => {
    const node = findNodeById(servers, id);
    if (node) setPendingDelete(node);
  };

  const handleDeleteConfirm = () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;

    const idsToRemove = new Set(collectIds([target]));
    const remaining = removeNode(servers, target.id);
    const nextOpen = openTabs.filter((id) => !idsToRemove.has(id));

    setServers(remaining);
    setOpenTabs(nextOpen);

    setSavedServers((prev) => {
      const next = new Set(prev);
      idsToRemove.forEach((id) => next.delete(id));
      return next;
    });
    setActiveSubTabs((prev) => {
      const next = { ...prev };
      idsToRemove.forEach((id) => delete next[id]);
      return next;
    });
    setCheckStatuses((prev) => {
      const next = { ...prev };
      idsToRemove.forEach((id) => delete next[id]);
      return next;
    });
    setConnectedIds((prev) => {
      if (![...idsToRemove].some((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      idsToRemove.forEach((id) => next.delete(id));
      return next;
    });

    if (activeTab && idsToRemove.has(activeTab)) {
      const nextActive =
        nextOpen.length > 0 ? nextOpen[nextOpen.length - 1] : null;
      setActiveTab(nextActive);
      setSelectedId(nextActive);
    } else {
      setSelectedId(null);
    }

    setDirty(true);
  };

  // --- Настройка сервера ---
  const handleServerChange = (serverId: string, patch: Partial<Server>) => {
    setServers((prev) => updateServer(prev, serverId, patch));
    setDirty(true);
  };

  const markUnsaved = (serverId: string) => {
    setSavedServers((prev) => {
      const next = new Set(prev);
      next.delete(serverId);
      return next;
    });
  };

  const handleSaveServer = async (id: string) => {
    const s = findServerById(servers, id);
    const ok = await saveToCurrent();
    if (ok && s) runChecks([s]);
  };

  // --- Обновить статусы ---
  const handleRefresh = async () => {
    const list = flattenServers(servers);
    if (list.length === 0) return;
    setRefreshing(true);
    try {
      await runChecks(list);
    } finally {
      setRefreshing(false);
    }
  };

  // --- Подключение / отключение ---
  const handleConnect = (serverId: string) => {
    if (connectedIds.has(serverId)) return;
    const server = findServerById(servers, serverId);
    if (server) setAuthTarget(server);
  };

  const handleDisconnect = (serverId: string) => {
    setConnectedIds((prev) => {
      if (!prev.has(serverId)) return prev;
      const next = new Set(prev);
      next.delete(serverId);
      return next;
    });
  };

  const handleReconnect = (serverId: string) => {
    setConnectedIds((prev) => {
      const next = new Set(prev);
      next.delete(serverId);
      return next;
    });
    const server = findServerById(servers, serverId);
    if (server) setAuthTarget(server);
  };

  const handleServerDoubleClick = (serverId: string) => {
    if (connectedIds.has(serverId)) return;
    handleConnect(serverId);
  };

  const handleAuthSubmit = () => {
    if (!authTarget) return;
    const id = authTarget.id;
    setConnectedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setAuthTarget(null);
  };

  const handleAuthCancel = () => setAuthTarget(null);

  // --- Под-вкладки ---
  const activeSubTab: TabId = activeTab
    ? activeSubTabs[activeTab] ?? "settings"
    : "settings";

  const handleSubTabSelect = (tabId: TabId) => {
    if (!activeTab) return;
    setActiveSubTabs((prev) => ({ ...prev, [activeTab]: tabId }));
  };

  const pendingDeleteIsFolder = pendingDelete?.kind === "folder";
  const pendingDeleteServersCount =
    pendingDelete && pendingDelete.kind === "folder"
      ? countServersIn(pendingDelete)
      : 0;

  return (
    <div className="app">
      <MenuBar
        dirty={dirty}
        recentFiles={recentFiles.filter((p) => p !== currentFilePath)}
        currentFilePath={currentFilePath}
        onNew={handleNewFile}
        onOpen={handleOpenFile}
        onSave={saveToCurrent}
        onSaveAs={saveAs}
        onOpenRecent={handleOpenRecent}
        onExit={handleExit}
        onAbout={() => setAboutOpen(true)}
        onSettings={() => setAppSettingsOpen(true)}
      />
      <div className="body">
        <div className="sidebar-wrap" style={{ width: sidebarWidth }}>
          <Sidebar
            servers={servers}
            selectedId={selectedId}
            connectedIds={connectedIds}
            checkStatuses={checkStatuses}
            refreshing={refreshing}
            onSelect={handleSelectNode}
            onDoubleClick={handleServerDoubleClick}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onReconnect={handleReconnect}
            onAddServer={handleAddServer}
            onAddFolder={handleAddFolder}
            onRename={handleRename}
            onDeleteNode={handleDeleteNode}
            onRefresh={handleRefresh}
            onMoveNode={handleMoveNode}
          />
        </div>
        <div
          className={`splitter ${isResizing ? "active" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          role="separator"
          aria-orientation="vertical"
        />
        <TabsPanel
          servers={flatServers}
          subTabs={SETTINGS_TABS}
          openTabs={openTabs}
          activeTab={activeTab}
          activeSubTab={activeSubTab}
          connectedIds={connectedIds}
          savedServers={savedServers}
          onTabSelect={openServerTab}
          onTabClose={closeTab}
          onSubTabSelect={handleSubTabSelect}
          onChange={handleServerChange}
          onSave={handleSaveServer}
          onEdit={markUnsaved}
        />
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDeleteIsFolder ? "Удаление папки" : "Удаление сервера"}
        message={
          pendingDelete
            ? pendingDeleteIsFolder
              ? `Удалить папку «${pendingDelete.name || "(без имени)"}»${
                  pendingDeleteServersCount > 0
                    ? ` вместе с ${pendingDeleteServersCount} сервер(ами)`
                    : ""
                }?`
              : `Точно удалить «${pendingDelete.name || "(без имени)"}»?`
            : ""
        }
        confirmLabel="Да"
        cancelLabel="Отмена"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={pendingClose}
        title="Несохранённые изменения"
        message="Есть несохранённые настройки сервера. Закрыть программу?"
        confirmLabel="Да"
        cancelLabel="Нет"
        onConfirm={handleCloseConfirm}
        onCancel={() => setPendingClose(false)}
      />

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <SettingsDialog
        open={appSettingsOpen}
        settings={appSettings}
        onSave={handleSaveAppSettings}
        onClose={() => setAppSettingsOpen(false)}
      />

      <AuthDialog
        open={authTarget !== null}
        serverName={authTarget?.name || "(без имени)"}
        onSubmit={handleAuthSubmit}
        onCancel={handleAuthCancel}
      />
    </div>
  );
}

export default App;