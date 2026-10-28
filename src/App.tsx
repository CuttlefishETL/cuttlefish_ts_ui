import { useEffect, useState } from "react";
import "./styles/app.css";

import { MenuBar } from "./components/MenuBar";
import { Sidebar } from "./components/Sidebar";
import { TabsPanel } from "./components/TabsPanel";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { AboutDialog } from "./components/AboutDialog";
import { AuthDialog } from "./components/AuthDialog";
import { SettingsDialog } from "./components/SettingsDialog";

import { SETTINGS_TABS } from "./data";
import type { Server, ServerNode, TabId } from "./types";
import { flattenServers } from "./treeUtils";

import { useAppSettings } from "./hooks/useAppSettings";
import { useConnections } from "./hooks/useConnections";
import { useFileIO } from "./hooks/useFileIO";
import { useRecentFiles } from "./hooks/useRecentFiles";
import { useServers } from "./hooks/useServers";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useTabs } from "./hooks/useTabs";
import { useWindowClose } from "./hooks/useWindowClose";

function App() {
  // --- Независимые хуки ---
  const recentFiles = useRecentFiles();
  const appSettings = useAppSettings();
  const sidebar = useSidebarResize();

  // --- Серверы ---
  const servers = useServers();

  // --- Соединения (зависят от серверов и настроек) ---
  const connections = useConnections(servers.servers, appSettings.settings);

  // --- Файлы (зависят от recentFiles) ---
  const fileIO = useFileIO(recentFiles.addRecent, recentFiles.removeRecent);

  // --- Вкладки (зависят от серверов) ---
  const tabs = useTabs(servers.servers);

  // --- Окно (зависит от dirty) ---
  const windowClose = useWindowClose(fileIO.dirty);

  // --- Локальное UI-состояние ---
  const [aboutOpen, setAboutOpen] = useState(false);

  // --- Применение загруженного состояния ---
  const loadAndApply = (loaded: ServerNode[]) => {
    servers.applyLoaded(loaded);
    const first = flattenServers(loaded)[0]?.id ?? null;
    tabs.setLoaded(first);
    connections.reset();
    void connections.runChecks(flattenServers(loaded));
  };

  // --- Загрузка последнего файла при старте ---
  useEffect(() => {
    (async () => {
      const loaded = await fileIO.loadInitial();
      if (loaded) {
        loadAndApply(loaded);
        return;
      }
      const flat = flattenServers(servers.servers);
      const first = flat[0]?.id ?? null;
      tabs.setLoaded(first);
      void connections.runChecks(flat);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Файловые операции ---
  const saveAs = async (): Promise<boolean> => {
    const ok = await fileIO.saveAs(servers.servers);
    if (ok) servers.markAllSaved();
    return ok;
  };

  const saveToCurrent = async (): Promise<boolean> => {
    const ok = await fileIO.saveToCurrent(servers.servers);
    if (ok) servers.markAllSaved();
    return ok;
  };

  const handleNewFile = () => {
    if (
      fileIO.dirty &&
      !confirm(
        "Есть несохранённые изменения. Создать новый файл без сохранения?",
      )
    ) {
      return;
    }
    servers.reset();
    tabs.reset();
    connections.reset();
    fileIO.newFile();
  };

  const handleOpenFile = async () => {
    if (
      fileIO.dirty &&
      !confirm(
        "Есть несохранённые изменения. Открыть другой файл без сохранения?",
      )
    ) {
      return;
    }
    const loaded = await fileIO.openFile();
    if (!loaded) return;
    loadAndApply(loaded);
  };

  const handleOpenRecent = async (path: string) => {
    if (path === fileIO.currentFilePath) return;
    if (
      fileIO.dirty &&
      !confirm(
        "Есть несохранённые изменения. Открыть другой файл без сохранения?",
      )
    ) {
      return;
    }
    const loaded = await fileIO.openRecent(path);
    if (!loaded) return;
    loadAndApply(loaded);
  };

  // --- Серверы ---
  const handleAddServer = (parentId: string | null) => {
    const s = servers.addServer(parentId);
    tabs.open(s.id);
    fileIO.markDirty();
    void connections.runChecks([s]);
  };

  const handleAddFolder = (parentId: string | null) => {
    const f = servers.addFolder(parentId);
    tabs.handleSelectNode(f.id);
    fileIO.markDirty();
  };

  const handleRename = (id: string, currentName: string) => {
    const name = window.prompt("Новое название", currentName);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) return;
    servers.rename(id, trimmed);
    fileIO.markDirty();
  };

  const handleMoveNode = (nodeId: string, newParentId: string | null) => {
    if (servers.move(nodeId, newParentId)) fileIO.markDirty();
  };

  const handleDeleteConfirm = () => {
    const ids = servers.confirmDelete();
    if (!ids) return;
    tabs.removeMany(ids);
    connections.removeIds(ids);
    fileIO.markDirty();
  };

  const handleServerChange = (
    serverId: string,
    patch: Partial<Server>,
  ) => {
    servers.update(serverId, patch);
    fileIO.markDirty();
  };

  const handleSaveServer = async (id: string) => {
    const s = servers.flatServers.find((x) => x.id === id);
    const ok = await fileIO.saveToCurrent(servers.servers);
    if (ok) {
      servers.markAllSaved();
      if (s) void connections.runChecks([s]);
    }
  };

  const handleSubTabSelect = (tabId: TabId) => {
    tabs.selectSub(tabId);
  };

  return (
    <div className="app">
      <MenuBar
        dirty={fileIO.dirty}
        recentFiles={recentFiles.recentFiles.filter(
          (p) => p !== fileIO.currentFilePath,
        )}
        currentFilePath={fileIO.currentFilePath}
        onNew={handleNewFile}
        onOpen={handleOpenFile}
        onSave={saveToCurrent}
        onSaveAs={saveAs}
        onOpenRecent={handleOpenRecent}
        onExit={windowClose.exit}
        onAbout={() => setAboutOpen(true)}
        onSettings={appSettings.open}
      />
      <div className="body">
        <div className="sidebar-wrap" style={{ width: sidebar.sidebarWidth }}>
          <Sidebar
            servers={servers.servers}
            selectedId={tabs.selectedId}
            connectedIds={connections.connectedIds}
            checkStatuses={connections.checkStatuses}
            refreshing={connections.refreshing}
            onSelect={tabs.handleSelectNode}
            onDoubleClick={(id) =>
              connections.serverDoubleClick(id, servers.servers)
            }
            onConnect={(id) => connections.connect(id, servers.servers)}
            onDisconnect={connections.disconnect}
            onReconnect={(id) =>
              connections.reconnect(id, servers.servers)
            }
            onAddServer={handleAddServer}
            onAddFolder={handleAddFolder}
            onRename={handleRename}
            onDeleteNode={servers.askDelete}
            onRefresh={() => connections.refresh(servers.servers)}
            onMoveNode={handleMoveNode}
          />
        </div>
        <div
          className={`splitter ${sidebar.isResizing ? "active" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            sidebar.startResize();
          }}
          role="separator"
          aria-orientation="vertical"
        />
        <TabsPanel
          servers={servers.flatServers}
          subTabs={SETTINGS_TABS}
          openTabs={tabs.openTabs}
          activeTab={tabs.activeTab}
          activeSubTab={tabs.activeSubTab}
          connectedIds={connections.connectedIds}
          savedServers={servers.savedServers}
          onTabSelect={tabs.open}
          onTabClose={tabs.close}
          onSubTabSelect={handleSubTabSelect}
          onChange={handleServerChange}
          onSave={handleSaveServer}
          onEdit={servers.markUnsaved}
        />
      </div>

      <ConfirmDialog
        open={servers.pendingDelete !== null}
        title={
          servers.pendingDeleteIsFolder
            ? "Удаление папки"
            : "Удаление сервера"
        }
        message={
          servers.pendingDelete
            ? servers.pendingDeleteIsFolder
              ? `Удалить папку «${servers.pendingDelete.name || "(без имени)"}»${
                  servers.pendingDeleteCount > 0
                    ? ` вместе с ${servers.pendingDeleteCount} сервер(ами)`
                    : ""
                }?`
              : `Точно удалить «${servers.pendingDelete.name || "(без имени)"}»?`
            : ""
        }
        confirmLabel="Да"
        cancelLabel="Отмена"
        onConfirm={handleDeleteConfirm}
        onCancel={servers.cancelDelete}
      />

      <ConfirmDialog
        open={windowClose.pendingClose}
        title="Несохранённые изменения"
        message="Есть несохранённые настройки сервера. Закрыть программу?"
        confirmLabel="Да"
        cancelLabel="Нет"
        onConfirm={windowClose.confirmClose}
        onCancel={windowClose.cancelClose}
      />

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <SettingsDialog
        open={appSettings.isOpen}
        settings={appSettings.settings}
        onSave={appSettings.save}
        onClose={appSettings.close}
      />

      <AuthDialog
        open={connections.authTarget !== null}
        serverName={connections.authTarget?.name || "(без имени)"}
        onSubmit={connections.submitAuth}
        onCancel={connections.cancelAuth}
      />
    </div>
  );
}

export default App;