import { useEffect, useMemo, useState } from "react";
import type { ConnectorsApi, ConnectorInput } from "./api";
import { useConnectors } from "./useConnectors";
import { ConnectorProperties } from "./ConnectorProperties";
import { buildConnectorTree, flattenTree } from "./buildTree";
import type { ConnectorInstance } from "./types";
import { directionShort } from "./types";
import "./connectors.css";

interface Props {
  api: ConnectorsApi;
}

export function ConnectorsWidget({ api }: Props) {
  const {
    items,
    templates,
    templatesByType,
    status,
    loading,
    error,
    reload,
    toggleEnabled,
  } = useConnectors(api);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const tree = useMemo(
    () => buildConnectorTree(items, templates),
    [items, templates],
  );

  // Автоматически раскрываем все группы при первой загрузке
  useEffect(() => {
    if (expanded.size === 0 && tree.length > 0) {
      setExpanded(new Set(tree.map((g) => g.key)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.length]);

  const rows = useMemo(() => flattenTree(tree, expanded), [tree, expanded]);

  const selected = useMemo(
    () => items.find((c) => c.name === selectedName) ?? null,
    [items, selectedName],
  );

  const isFormOpen = creating || selected !== null;

  const toggleGroup = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelect = (name: string) => {
    setCreating(false);
    setSelectedName(name);
  };

  const handleCreate = () => {
    setCreating(true);
    setSelectedName(null);
  };

  const handleCancel = () => {
    setCreating(false);
    setSelectedName(null);
  };

  const handleSubmit = async (input: ConnectorInput) => {
    setBusy(true);
    try {
      if (creating) {
        await api.create(input);
        setToast(`Коннектор «${input.name}» создан`);
      } else if (selected) {
        await api.update(selected.name, input);
        setToast(`Коннектор «${input.name}» сохранён`);
      }
      setCreating(false);
      setSelectedName(input.name);
      await reload();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const name = confirmDelete;
    setConfirmDelete(null);
    setBusy(true);
    try {
      await api.remove(name);
      setToast(`Коннектор «${name}» удалён`);
      if (selectedName === name) setSelectedName(null);
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

  const handleTest = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.test(selected.name);
      setToast(`Соединение «${selected.name}» в порядке`);
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

  return (
    <div className="connectors-tab">
      <div className="connectors-toolbar">
        <button className="btn" onClick={handleCreate} disabled={busy}>
          Создать
        </button>
        <button
          className="btn danger"
          onClick={() => selected && setConfirmDelete(selected.name)}
          disabled={!selected || busy}
        >
          Удалить
        </button>
        <button
          className="btn"
          onClick={handleTest}
          disabled={!selected || busy}
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
            Всего: {status.total_connectors} · Вкл: {status.enabled_connectors} · Откл:{" "}
            {status.disabled_connectors}
          </span>
        )}
      </div>

      <div className="connectors-main">
        <div className="connectors-list">
          <div className="connectors-list-header">
            <div className="col-name">Имя</div>
            <div className="col-enabled">Вкл.</div>
            <div className="col-tags">Теги</div>
            <div className="col-direction" title="Направление">
              ↔
            </div>
          </div>

          <div className="connectors-list-body" role="tree">
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
            {!loading && !error && items.length === 0 && (
              <div className="connectors-hint">
                Коннекторы не найдены. Нажмите «Создать».
              </div>
            )}

            {rows.map(({ node, depth }) => {
              const isGroup = node.type === "group";
              const c = node.connector;
              const isSelected = c && c.name === selectedName;
              const isExpanded = expanded.has(node.key);

              return (
                <div
                  key={node.key}
                  role="treeitem"
                  aria-selected={!!isSelected}
                  className={
                    "connectors-row" + (isSelected ? " is-selected" : "")
                  }
                  onClick={() => {
                    if (isGroup) toggleGroup(node.key);
                    else if (c) handleSelect(c.name);
                  }}
                >
                  <div
                    className="connectors-cell name"
                    style={{ paddingLeft: 8 + depth * 16 }}
                  >
                    {isGroup ? (
                      <button
                        className="connectors-chevron"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGroup(node.key);
                        }}
                        aria-label={isExpanded ? "Свернуть" : "Развернуть"}
                      >
                        {isExpanded ? "▾" : "▸"}
                      </button>
                    ) : (
                      <span className="connectors-chevron-placeholder" />
                    )}
                    <span className="connectors-icon">
                      {isGroup ? "📁" : "📄"}
                    </span>
                    <span className="connectors-label" title={node.label}>
                      {node.label}
                    </span>
                  </div>

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
          </div>
        </div>

        <div className="connectors-props">
          {!isFormOpen && (
            <div className="connectors-hint props-hint">
              Выберите коннектор в дереве или нажмите «Создать»
            </div>
          )}
          {isFormOpen && (
            <ConnectorProperties
              key={creating ? "__new__" : selected!.name}
              initialValue={creating ? null : selected}
              templates={templates}
              templatesByType={templatesByType}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              saving={busy}
            />
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Удалить коннектор?</h3>
            <p>{confirmDelete}</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setConfirmDelete(null)}>
                Отмена
              </button>
              <button className="btn danger" onClick={handleDelete} disabled={busy}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="connectors-toast">{toast}</div>}
    </div>
  );
}