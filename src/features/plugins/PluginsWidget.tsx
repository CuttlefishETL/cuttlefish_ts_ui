import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  allFolderKeys,
  buildPluginTree,
  filterTree,
  flatten,
} from "./buildTree";
import type { PluginListItem } from "./types";
import { pluginTypeFromFilename } from "./types";
import { usePlugins } from "./usePlugins";
import { PluginCardDialog } from "./PluginCardDialog";
import { UploadPluginDialog } from "./UploadPluginDialog";
import { act, sep, useContextMenu } from "../../components/context-menu";
import "./plugins.css";

interface Props {
  api: import("./api").PluginsApi;
}

export function PluginsWidget({ api }: Props) {
  const { openContextMenu } = useContextMenu();

  const {
    plugins,
    status,
    loading,
    error,
    stale,
    busyIds,
    reload,
    toggle,
    load,
    unload,
    remove,
  } = usePlugins(api);

  const [userExpanded, setUserExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cardId, setCardId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<PluginListItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const tree = useMemo(() => buildPluginTree(plugins), [plugins]);
  const filteredTree = useMemo(
    () => filterTree(tree, search),
    [tree, search],
  );

  const effectiveExpanded = useMemo(
    () => (search.trim() ? allFolderKeys(filteredTree) : userExpanded),
    [search, filteredTree, userExpanded],
  );

  const rows = useMemo(
    () => flatten(filteredTree, effectiveExpanded),
    [filteredTree, effectiveExpanded],
  );

  const selectedPlugin = useMemo(
    () => rows.find((r) => r.node.key === selected)?.node.plugin ?? null,
    [rows, selected],
  );

  const toggleExpand = useCallback((key: string) => {
    setUserExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleToggle = async (p: PluginListItem) => {
    const err = await toggle(p);
    if (err) setToast(err);
  };

  const handleLoad = async (p: PluginListItem) => {
    const err = await load(p.id);
    if (err) setToast(err);
  };

  const handleUnload = async (p: PluginListItem) => {
    const err = await unload(p.id);
    if (err) setToast(err);
  };

  const handleDownload = async (p: PluginListItem) => {
    try {
      const blob = await api.download(p.id);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = p.filename.split("/").pop() ?? p.name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setToast((e as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    const p = confirmDel;
    setConfirmDel(null);
    const err = await remove(p.id);
    if (err) setToast(err);
  };

  const handleUpload = async (
    file: File,
    onProgress: (p: number) => void,
  ) => {
    await api.upload(file, onProgress);
    setUploadOpen(false);
    await reload();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault();
        void reload();
      } else if (e.key === "Insert") {
        e.preventDefault();
        setUploadOpen(true);
      } else if (e.key === "Delete" && selectedPlugin) {
        e.preventDefault();
        setConfirmDel(selectedPlugin);
      } else if (e.key === "Enter" && selectedPlugin) {
        e.preventDefault();
        setCardId(selectedPlugin.id);
      } else if (e.key === "Escape") {
        if (cardId) setCardId(null);
        else if (uploadOpen) setUploadOpen(false);
        else if (confirmDel) setConfirmDel(null);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reload, selectedPlugin, cardId, uploadOpen, confirmDel]);

  const canDownload = !!selectedPlugin;
  const canDelete = !!selectedPlugin;
  const canLoad =
    !!selectedPlugin &&
    (selectedPlugin.state === "Inactive" ||
      selectedPlugin.state === "Unloaded" ||
      selectedPlugin.state === "Failed");
  const canUnload = !!selectedPlugin && selectedPlugin.state === "Active";

  // -------- Context menu --------

  const openPluginMenu = (
    e: React.MouseEvent,
    plugin: PluginListItem,
  ) => {
    setSelected(`plugin:${plugin.id}`);
    openContextMenu(e, [
      act("Загрузить", () => void handleLoad(plugin), {
        disabled:
          plugin.state === "Active" || busyIds.has(plugin.id),
      }),
      act("Выгрузить", () => void handleUnload(plugin), {
        disabled:
          plugin.state !== "Active" || busyIds.has(plugin.id),
      }),
      sep(),
      act("Скачать", () => void handleDownload(plugin), {
        disabled: busyIds.has(plugin.id),
      }),
      act("Удалить", () => setConfirmDel(plugin), {
        danger: true,
        disabled: busyIds.has(plugin.id),
      }),
      sep(),
      act("Открыть карточку", () => setCardId(plugin.id)),
    ]);
  };

  const openBlankMenu = (e: React.MouseEvent) => {
    openContextMenu(e, [
      act("Добавить плагин", () => setUploadOpen(true)),
      sep(),
      act("Обновить", () => void reload(), { disabled: loading }),
    ]);
  };

  return (
    <div className="plugins-tab" onContextMenu={openBlankMenu}>
      <div className="plugins-toolbar">
        <button className="btn" onClick={() => setUploadOpen(true)}>
          Добавить
        </button>
        <button
          className="btn"
          onClick={() => selectedPlugin && void handleDownload(selectedPlugin)}
          disabled={!canDownload}
        >
          Скачать
        </button>
        <button
          className="btn danger"
          onClick={() => selectedPlugin && setConfirmDel(selectedPlugin)}
          disabled={!canDelete}
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

        <span className="plugins-toolbar-sep" />

        <button
          className="btn"
          onClick={() => selectedPlugin && void handleLoad(selectedPlugin)}
          disabled={!canLoad}
        >
          Загрузить
        </button>
        <button
          className="btn"
          onClick={() => selectedPlugin && void handleUnload(selectedPlugin)}
          disabled={!canUnload}
        >
          Выгрузить
        </button>

        <span className="plugins-spacer" />

        <input
          ref={searchInputRef}
          type="search"
          className="plugins-search"
          placeholder="Поиск…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="plugins-header">
        <div className="plugins-col-name">Имя</div>
        <div className="plugins-col-type">Тип</div>
        <div className="plugins-col-enabled">Вкл.</div>
        <div className="plugins-col-note">Примечание</div>
      </div>

      <div className="plugins-body" role="tree">
        {loading && plugins.length === 0 && (
          <div className="plugins-hint">Загрузка…</div>
        )}

        {!loading && error && plugins.length === 0 && (
          <div className="plugins-hint">
            {error}{" "}
            <button className="btn" onClick={() => void reload()}>
              Повторить
            </button>
          </div>
        )}

        {!loading && !error && rows.length === 0 && plugins.length === 0 && (
          <div className="plugins-hint">
            Плагины не найдены. Добавьте плагин кнопкой «Добавить».
          </div>
        )}

        {rows.map(({ node, depth }) => {
          const p = node.plugin;
          const isFolder = node.type === "folder";
          const isSelected = node.key === selected;
          const isBusy = p ? busyIds.has(p.id) : false;
          const isExpanded = effectiveExpanded.has(node.key);

          return (
            <div
              key={node.key}
              role="treeitem"
              aria-selected={isSelected}
              className={
                "plugins-row" +
                (isSelected ? " is-selected" : "") +
                (isBusy ? " is-busy" : "")
              }
              onClick={() => {
                setSelected(node.key);
                if (isFolder) toggleExpand(node.key);
              }}
              onDoubleClick={() => {
                if (!isFolder && p) setCardId(p.id);
              }}
              onContextMenu={
                p ? (e) => openPluginMenu(e, p) : undefined
              }
            >
              <div
                className="plugins-col-name"
                style={{ paddingLeft: 8 + depth * 16 }}
              >
                {isFolder ? (
                  <button
                    className="plugins-chevron"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(node.key);
                    }}
                    aria-label={isExpanded ? "Свернуть" : "Развернуть"}
                  >
                    {isExpanded ? "▾" : "▸"}
                  </button>
                ) : (
                  <span className="plugins-chevron-placeholder" />
                )}
                <span className="plugins-icon">{isFolder ? "📁" : "📄"}</span>
                <span className="plugins-label" title={node.label}>
                  {node.label}
                </span>
                {isBusy && <span className="plugins-spinner">⟳</span>}
                {p?.state === "Failed" && (
                  <span
                    className="plugins-failed"
                    title="Ошибка загрузки плагина"
                  >
                    ⚠
                  </span>
                )}
                {p?.state === "Unloaded" && (
                  <span className="plugins-unloaded" title="Выгружен">
                    ○
                  </span>
                )}
              </div>

              <div className="plugins-col-type">
                {p ? pluginTypeFromFilename(p.filename) : ""}
              </div>

              <div className="plugins-col-enabled">
                {p && (
                  <input
                    className="plugins-check"
                    type="checkbox"
                    checked={p.enabled}
                    disabled={isBusy}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => handleToggle(p)}
                  />
                )}
              </div>

              <div className="plugins-col-note">{p ? extSummary(p) : ""}</div>
            </div>
          );
        })}
      </div>

      <div className="plugins-footer">
        {status
          ? `Всего: ${status.total} · Активных: ${status.active} · Ядро ${status.core_version} · API ${status.api_version}`
          : "…"}
        {stale && error && (
          <span className="plugins-stale"> · Не удалось обновить: {error}</span>
        )}
      </div>

      {cardId && (
        <PluginCardDialog
          api={api}
          pluginId={cardId}
          onClose={() => setCardId(null)}
        />
      )}

      {uploadOpen && (
        <UploadPluginDialog
          onClose={() => setUploadOpen(false)}
          onUpload={handleUpload}
        />
      )}

      {confirmDel && (
        <div className="modal-backdrop" onClick={() => setConfirmDel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Удалить плагин?</h3>
            <p>{confirmDel.name}</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setConfirmDel(null)}>
                Отмена
              </button>
              <button className="btn danger" onClick={handleDelete}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="plugins-toast">{toast}</div>}
    </div>
  );
}

function extSummary(p: PluginListItem): string {
  const e = p.extensions;
  const parts: string[] = [];
  if (e.connectors) parts.push(`conn:${e.connectors}`);
  if (e.metrics) parts.push(`metrics:${e.metrics}`);
  if (e.config_params) parts.push(`cfg:${e.config_params}`);
  if (e.lua_functions) parts.push(`lua:${e.lua_functions}`);
  return parts.join(" ");
}