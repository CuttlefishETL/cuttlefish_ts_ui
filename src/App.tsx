import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import { MenuBar } from "./components/MenuBar";
import { Sidebar } from "./components/Sidebar";
import { TabsPanel } from "./components/TabsPanel";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { AuthDialog } from "./components/AuthDialog";
import { INITIAL_SERVERS, SETTINGS_TABS, createServer } from "./data";
import type { Server, TabId } from "./types";
import { checkConnection, type CheckStatus } from "./checkConnection";

const MIN_WIDTH = 160;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 260;
const STORAGE_KEY = "sidebar-width";

function loadSidebarWidth(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  const num = raw ? Number(raw) : NaN;
  if (Number.isFinite(num)) {
    return Math.min(Math.max(num, MIN_WIDTH), MAX_WIDTH);
  }
  return DEFAULT_WIDTH;
}

function App() {
  const [servers, setServers] = useState<Server[]>(INITIAL_SERVERS);
  const [selectedId, setSelectedId] = useState<string | null>(
    INITIAL_SERVERS[0]?.id ?? null
  );
  const [openTabs, setOpenTabs] = useState<string[]>(
    INITIAL_SERVERS[0] ? [INITIAL_SERVERS[0].id] : []
  );
  const [activeTab, setActiveTab] = useState<string | null>(
    INITIAL_SERVERS[0]?.id ?? null
  );
  const [activeSubTabs, setActiveSubTabs] = useState<Record<string, TabId>>({});

  const [savedServers, setSavedServers] = useState<Set<string>>(new Set());

  // Множество подключённых серверов — можно работать с несколькими одновременно
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

  const [checkStatuses, setCheckStatuses] = useState<
    Record<string, CheckStatus>
  >({});
  const [refreshing, setRefreshing] = useState(false);
  const [authTarget, setAuthTarget] = useState<Server | null>(null);

  const [sidebarWidth, setSidebarWidth] = useState<number>(loadSidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Server | null>(null);
  const [pendingClose, setPendingClose] = useState(false);

  const bypassCloseCheck = useRef(false);
  const serversRef = useRef(servers);
  const savedServersRef = useRef(savedServers);
  serversRef.current = servers;
  savedServersRef.current = savedServers;

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
      })
    );
  };

  useEffect(() => {
    runChecks(INITIAL_SERVERS);
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

  // --- Перехват закрытия окна ---
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const appWindow = getCurrentWindow();
        const fn = await appWindow.onCloseRequested(async (event) => {
          if (bypassCloseCheck.current) return;
          const hasUnsaved = serversRef.current.some(
            (s) => !savedServersRef.current.has(s.id)
          );
          if (hasUnsaved) {
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

  // --- Вкладки ---
  const openServerTab = (serverId: string) => {
    setSelectedId(serverId);
    setOpenTabs((prev) =>
      prev.includes(serverId) ? prev : [...prev, serverId]
    );
    setActiveTab(serverId);
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
    // Подключение при закрытии вкладки НЕ сбрасываем —
    // пользователь может вернуться к серверу без повторного входа.
  };

  const handleAdd = () => {
    const server = createServer();
    setServers((prev) => [...prev, server]);
    setSelectedId(server.id);
    setOpenTabs((prev) => [...prev, server.id]);
    setActiveTab(server.id);
    runChecks([server]);
  };

  // --- Удаление ---
  const handleDeleteClick = () => {
    if (!selectedId) return;
    const s = servers.find((x) => x.id === selectedId);
    if (s) setPendingDelete(s);
  };

  const handleDeleteConfirm = () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;

    const idx = servers.findIndex((s) => s.id === target.id);
    const remaining = servers.filter((s) => s.id !== target.id);
    const nextOpen = openTabs.filter((id) => id !== target.id);

    setServers(remaining);
    setOpenTabs(nextOpen);

    setSavedServers((prev) => {
      const next = new Set(prev);
      next.delete(target.id);
      return next;
    });
    setActiveSubTabs((prev) => {
      const { [target.id]: _drop, ...rest } = prev;
      return rest;
    });
    setCheckStatuses((prev) => {
      const { [target.id]: _drop, ...rest } = prev;
      return rest;
    });
    setConnectedIds((prev) => {
      if (!prev.has(target.id)) return prev;
      const next = new Set(prev);
      next.delete(target.id);
      return next;
    });

    if (activeTab === target.id) {
      const nextActive =
        nextOpen.length > 0 ? nextOpen[nextOpen.length - 1] : null;
      setActiveTab(nextActive);
      setSelectedId(nextActive);
    } else {
      setSelectedId(remaining[Math.min(idx, remaining.length - 1)]?.id ?? null);
    }
  };

  // --- Настройка сервера ---
  const handleServerChange = (serverId: string, patch: Partial<Server>) => {
    setServers((prev) =>
      prev.map((s) => (s.id === serverId ? { ...s, ...patch } : s))
    );
  };

  const markSaved = (serverId: string, saved: boolean) => {
    setSavedServers((prev) => {
      const next = new Set(prev);
      if (saved) next.add(serverId);
      else next.delete(serverId);
      return next;
    });
  };

  const handleSave = (id: string) => {
    markSaved(id, true);
    const s = servers.find((x) => x.id === id);
    if (s) runChecks([s]);
  };

  // --- Обновить ---
  const handleRefresh = async () => {
    if (servers.length === 0) return;
    setRefreshing(true);
    try {
      await runChecks(servers);
    } finally {
      setRefreshing(false);
    }
  };

  // --- Подключение / отключение по двойному щелчку ---
  const handleServerDoubleClick = (serverId: string) => {
    if (connectedIds.has(serverId)) {
      // Уже подключён — отключаем без диалога
      setConnectedIds((prev) => {
        const next = new Set(prev);
        next.delete(serverId);
        return next;
      });
      return;
    }
    const server = servers.find((s) => s.id === serverId);
    if (!server) return;
    setAuthTarget(server);
  };

  const handleAuthSubmit = () => {
    if (!authTarget) return;
    setConnectedIds((prev) => {
      const next = new Set(prev);
      next.add(authTarget.id);
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

  return (
    <div className="app">
      <MenuBar />
      <div className="body">
        <div className="sidebar-wrap" style={{ width: sidebarWidth }}>
          <Sidebar
            servers={servers}
            selectedId={selectedId}
            connectedIds={connectedIds}
            checkStatuses={checkStatuses}
            refreshing={refreshing}
            onSelect={openServerTab}
            onDoubleClick={handleServerDoubleClick}
            onAdd={handleAdd}
            onDelete={handleDeleteClick}
            onRefresh={handleRefresh}
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
          servers={servers}
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
          onSave={handleSave}
          onEdit={(id) => markSaved(id, false)}
        />
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Удаление сервера"
        message={
          pendingDelete
            ? `Точно удалить «${pendingDelete.name || "(без имени)"}»?`
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