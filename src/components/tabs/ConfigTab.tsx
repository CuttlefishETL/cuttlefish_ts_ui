import { useEffect, useMemo, useState } from "react";
import type { Server } from "../../types";
import { buildBaseUrl } from "../../checkConnection";
import { createConfigApi } from "../../features/config/api";
import { useConfig } from "../../features/config/useConfig";
import type { ConfigParam, ParamMeta } from "../../features/config/types";
import { Splitter } from "../script/Splitter";
import "./config.css";

interface ConfigTabProps {
  server: Server;
}

const MIN_TREE_WIDTH = 180;
const MAX_TREE_WIDTH = 800;
const DEFAULT_TREE_WIDTH = 340;

export function ConfigTab({ server }: ConfigTabProps) {
  const baseUrl = useMemo(() => {
    try {
      return buildBaseUrl(server.url, server.port);
    } catch {
      return "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.url, server.port]);

  const api = useMemo(
    () => (baseUrl ? createConfigApi(baseUrl) : null),
    [baseUrl],
  );
  const {
    sections,
    sectionNames,
    loading,
    reloading,
    error,
    busyPaths,
    reload,
    reloadFromFile,
    updateParam,
  } = useConfig(api);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [filterPending, setFilterPending] = useState(false);
  const [treeWidth, setTreeWidth] = useState<number>(DEFAULT_TREE_WIDTH);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (sectionNames.length > 0 && expanded.size === 0) {
      setExpanded(new Set(sectionNames));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionNames.length]);

  const totalCount = useMemo(
    () => Object.values(sections).reduce((s, list) => s + list.length, 0),
    [sections],
  );

  const pendingCount = useMemo(
    () =>
      Object.values(sections).reduce(
        (s, list) => s + list.filter((p) => p.pending_restart).length,
        0,
      ),
    [sections],
  );

  const selected = useMemo(() => {
    if (!selectedPath) return null;
    for (const list of Object.values(sections)) {
      const p = list.find((p) => p.path === selectedPath);
      if (p) return p;
    }
    return null;
  }, [sections, selectedPath]);

  const toggleExpand = (sec: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sec)) next.delete(sec);
      else next.add(sec);
      return next;
    });
  };

  const handleTreeResize = (delta: number) => {
    setTreeWidth((w) =>
      Math.max(MIN_TREE_WIDTH, Math.min(MAX_TREE_WIDTH, w + delta)),
    );
  };

  const handleSave = async (path: string, value: unknown): Promise<boolean> => {
    const result = await updateParam(path, value);
    if (!result.ok) {
      setToast(`Ошибка: ${result.message ?? "не удалось сохранить"}`);
      return false;
    }
    if (result.pendingRestart) {
      setToast("Сохранено. Требуется перезапуск для применения.");
    } else {
      setToast("Сохранено");
    }
    return true;
  };

  if (!baseUrl) {
    return (
      <div className="config-tab">
        <div className="config-hint">
          Не удалось определить адрес сервера (проверьте URL и порт).
        </div>
      </div>
    );
  }

  return (
    <div className="config-tab">
      <div className="config-toolbar">
        <button
          type="button"
          className="btn"
          onClick={() => void reload()}
          disabled={loading || reloading}
        >
          Обновить
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => void reloadFromFile()}
          disabled={loading || reloading}
          title="POST /api/reload — перечитать config.yaml"
        >
          {reloading ? "Перезагрузка…" : "Перезагрузить из файла"}
        </button>
        <label className="config-filter">
          <input
            type="checkbox"
            checked={filterPending}
            onChange={(e) => setFilterPending(e.target.checked)}
          />
          Только изменённые (требуют перезапуск)
        </label>

        <span className="config-spacer" />

        <span className="config-stats">
          Всего: {totalCount}
          {pendingCount > 0 && (
            <>
              {" · "}
              <span className="config-pending-count">
                Требуют перезапуск: {pendingCount}
              </span>
            </>
          )}
        </span>
      </div>

      {loading && sectionNames.length === 0 && (
        <div className="config-hint">Загрузка параметров…</div>
      )}
      {!loading && error && sectionNames.length === 0 && (
        <div className="config-hint">
          {error}{" "}
          <button className="btn" onClick={() => void reload()}>
            Повторить
          </button>
        </div>
      )}
      {!loading && !error && sectionNames.length === 0 && (
        <div className="config-hint">Параметры не найдены</div>
      )}

      {sectionNames.length > 0 && (
        <div className="config-main">
          <div className="config-tree-wrap" style={{ width: treeWidth }}>
            <div className="config-tree-body">
              {sectionNames.map((sec) => {
                const list = sections[sec] ?? [];
                const visible = filterPending
                  ? list.filter((p) => p.pending_restart)
                  : list;
                if (filterPending && visible.length === 0) return null;
                const open = expanded.has(sec) || filterPending;
                return (
                  <div key={sec} className="config-section">
                    <div
                      className="config-section-row"
                      onClick={() => toggleExpand(sec)}
                    >
                      <span className="config-chevron">
                        {open ? "▾" : "▸"}
                      </span>
                      <span className="config-section-name">{sec}</span>
                      <span className="config-count">{visible.length}</span>
                    </div>
                    {open &&
                      visible.map((p) => (
                        <div
                          key={p.path}
                          className={
                            "config-param-row" +
                            (selectedPath === p.path ? " is-selected" : "")
                          }
                          title={p.path}
                          onClick={() => setSelectedPath(p.path)}
                        >
                          <span className="config-param-path">
                            {stripSection(p.path, sec)}
                          </span>
                          {p.pending_restart && (
                            <span
                              className="config-badge config-badge--pending"
                              title="Требуется перезапуск"
                            >
                              ⚠
                            </span>
                          )}
                          {p.meta.read_only && (
                            <span
                              className="config-badge config-badge--ro"
                              title="Только чтение"
                            >
                              🔒
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>

          <Splitter direction="vertical" onDelta={handleTreeResize} />

          <div className="config-editor-wrap">
            {!selected && (
              <div className="config-hint">Выберите параметр слева</div>
            )}
            {selected && (
              <ParamEditor
                key={selected.path}
                param={selected}
                busy={busyPaths.has(selected.path)}
                onSave={(v) => handleSave(selected.path, v)}
              />
            )}
          </div>
        </div>
      )}

      {toast && <div className="config-toast">{toast}</div>}
    </div>
  );
}

function stripSection(path: string, section: string): string {
  const seg = section.toLowerCase();
  const parts = path.split(".");
  if (parts.length > 1 && parts[0].toLowerCase() === seg) {
    return parts.slice(1).join(".");
  }
  return path;
}

function ParamEditor({
  param,
  busy,
  onSave,
}: {
  param: ConfigParam;
  busy: boolean;
  onSave: (value: unknown) => Promise<boolean>;
}) {
  const [value, setValue] = useState<unknown>(param.value);
  const [error, setError] = useState<string | null>(null);
  const { meta } = param;

  const isDirty = useMemo(
    () => JSON.stringify(value) !== JSON.stringify(param.value),
    [value, param.value],
  );

  const handleSave = async () => {
    let toSave = value;

    if (meta.type === "json" && typeof toSave === "string") {
      try {
        toSave = JSON.parse(toSave);
      } catch {
        setError("Невалидный JSON");
        return;
      }
    }

    const err = validateValue(toSave, meta);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    await onSave(toSave);
  };

  return (
    <div className="config-editor">
      <div className="config-editor-header">
        <div className="config-editor-path" title={param.path}>
          {param.path}
        </div>
        <div className="config-editor-badges">
          {meta.read_only && (
            <span className="config-badge config-badge--ro">
              только чтение
            </span>
          )}
          {meta.restart_required && (
            <span className="config-badge config-badge--restart">
              требует перезапуск
            </span>
          )}
          {param.pending_restart && (
            <span className="config-badge config-badge--pending">
              изменён после старта
            </span>
          )}
        </div>
      </div>

      {meta.description && (
        <div className="config-editor-description">{meta.description}</div>
      )}

      <div className="config-editor-type">
        Тип: <code>{meta.type}</code>
        {meta.required && (
          <span className="config-editor-required"> · обязательный</span>
        )}
      </div>

      <div className="config-editor-field">
        <label>Значение</label>
        <ValueInput
          value={value}
          onChange={setValue}
          meta={meta}
          disabled={busy || meta.read_only}
        />
      </div>

      {meta.default !== undefined && meta.default !== null && (
        <div className="config-editor-hint">
          По умолчанию: <code>{formatValue(meta.default)}</code>
        </div>
      )}
      {typeof meta.min === "number" && (
        <div className="config-editor-hint">Минимум: {meta.min}</div>
      )}
      {typeof meta.max === "number" && (
        <div className="config-editor-hint">Максимум: {meta.max}</div>
      )}
      {meta.pattern && (
        <div className="config-editor-hint">
          Шаблон: <code>{meta.pattern}</code>
        </div>
      )}

      {error && <div className="config-editor-error">{error}</div>}

      <div className="config-editor-actions">
        <button
          type="button"
          className="btn primary"
          onClick={() => void handleSave()}
          disabled={busy || meta.read_only || !isDirty}
        >
          {busy ? "Сохранение…" : "Сохранить"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setValue(param.value);
            setError(null);
          }}
          disabled={busy || !isDirty}
        >
          Отменить
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ValueInput — контрол по типу параметра                            */
/* ------------------------------------------------------------------ */

function ValueInput({
  value,
  onChange,
  meta,
  disabled,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  meta: ParamMeta;
  disabled: boolean;
}) {
  switch (meta.type) {
    case "boolean": {
      const checked =
        typeof value === "boolean"
          ? value
          : value === "true" || value === "1" || value === 1;
      return (
        <label className="config-editor-checkbox">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
          />
          <span>{checked ? "включено" : "выключено"}</span>
        </label>
      );
    }

    case "number":
      return (
        <input
          type="number"
          value={value === null || value === undefined ? "" : String(value)}
          min={typeof meta.min === "number" ? meta.min : undefined}
          max={typeof meta.max === "number" ? meta.max : undefined}
          step="any"
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          disabled={disabled}
        />
      );

    case "choice": {
      const choices = (meta.choices ?? []).map((c) => String(c));
      const current = value === null || value === undefined ? "" : String(value);
      const missingFromChoices = current !== "" && !choices.includes(current);
      return (
        <select
          value={current}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">— выберите —</option>
          {choices.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          {missingFromChoices && (
            <option value={current}>
              {current} (нет в списке допустимых)
            </option>
          )}
        </select>
      );
    }

    case "json":
      return (
        <textarea
          value={toJsonText(value)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={6}
          spellCheck={false}
          placeholder="{}"
        />
      );

    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );

    case "duration":
      return (
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="30s, 5m, 1h"
        />
      );

    case "string":
    default:
      return (
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );
  }
}

function toJsonText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return "";
  }
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function validateValue(value: unknown, meta: ParamMeta): string | null {
  switch (meta.type) {
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(n)) return "Введите число";
      if (typeof meta.min === "number" && n < meta.min)
        return `Минимум: ${meta.min}`;
      if (typeof meta.max === "number" && n > meta.max)
        return `Максимум: ${meta.max}`;
      if (meta.required && (value === null || value === undefined || value === "")) {
        return "Обязательное поле";
      }
      return null;
    }
    case "json": {
      if (typeof value === "string") {
        try {
          JSON.parse(value);
        } catch {
          return "Невалидный JSON";
        }
      }
      return null;
    }
    case "date": {
      if (typeof value === "string" && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return "Формат: YYYY-MM-DD";
      }
      if (meta.required && !value) return "Обязательное поле";
      return null;
    }
    case "duration": {
      if (
        typeof value === "string" &&
        value &&
        !/^\d+(\.\d+)?\s*(s|m|h|d|w|sec|min|hour|day|week|second|minute|hour|day|week)s?$/i.test(
          value.trim(),
        )
      ) {
        return "Формат: 30s, 5m, 1h";
      }
      if (meta.required && !value) return "Обязательное поле";
      return null;
    }
    case "string": {
      if (meta.required && (value === null || value === undefined || value === "")) {
        return "Обязательное поле";
      }
      if (meta.pattern && typeof value === "string" && value) {
        try {
          if (!new RegExp(meta.pattern).test(value)) {
            return `Не соответствует шаблону ${meta.pattern}`;
          }
        } catch {
          /* invalid regex in metadata — skip */
        }
      }
      return null;
    }
    case "choice": {
      if (meta.required && (value === null || value === undefined || value === "")) {
        return "Выберите значение";
      }
      if (typeof value === "string" && value) {
        const choices = (meta.choices ?? []).map((c) => String(c));
        if (choices.length > 0 && !choices.includes(value)) {
          return `Значение «${value}» отсутствует в списке допустимых`;
        }
      }
      return null;
    }
    case "boolean":
    default:
      return null;
  }
}