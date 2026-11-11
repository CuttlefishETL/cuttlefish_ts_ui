import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ConnectorInput } from "./api";
import type {
  ConnectorInstance,
  ConnectorTemplate,
  DataType,
  Direction,
  ParamMeta,
} from "./types";
import { ScriptParamField } from "./ScriptParamField";

interface Props {
  initialValue: ConnectorInstance | null;
  templates: ConnectorTemplate[];
  templatesByType: Record<string, ConnectorTemplate>;
  folderPath?: string;
  /** baseUrl для загрузки дерева скриптов в параметрах data_type === "script" */
  scriptBaseUrl: string;
  onSubmit: (input: ConnectorInput) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

const DIRECTIONS: Direction[] = ["Source", "Sink", "Duplex"];

/* ---------- размеры блоков ---------- */
const SPLITTER_HEIGHT = 6;
const MIN_TOP = 100;
const MIN_BOTTOM = 100;
const DEFAULT_TOP = 240;
const STORAGE_KEY = "cuttlefish.connectors.propsTopHeight";

function loadTopHeight(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n >= MIN_TOP) return n;
  } catch {
    /* ignore */
  }
  return DEFAULT_TOP;
}

/** Тип параметра «на лету», если в шаблоне ключа нет. */
function inferParamMeta(value: unknown, key: string): ParamMeta {
  const k = key.toLowerCase();

  if (typeof value === "boolean") {
    return { data_type: "boolean", required: false, order: 999 };
  }
  if (typeof value === "number") {
    return { data_type: "number", required: false, order: 999 };
  }
  if (Array.isArray(value)) {
    return { data_type: "array", required: false, order: 999 };
  }
  if (value !== null && typeof value === "object") {
    return { data_type: "object", required: false, order: 999 };
  }

  if (/(password|secret|token|api[_-]?key)/.test(k)) {
    return { data_type: "secret", required: false, order: 999 };
  }
  if (/(url|uri|endpoint|host)/.test(k)) {
    return { data_type: "uri", required: false, order: 999 };
  }
  return { data_type: "string", required: false, order: 999 };
}

function isNumericType(t: DataType): boolean {
  return t === "integer" || t === "number";
}

export function ConnectorProperties({
  initialValue,
  templates,
  templatesByType,
  folderPath,
  scriptBaseUrl,
  onSubmit,
  onCancel,
  saving,
}: Props) {
  const isEdit = initialValue !== null;

  const [name, setName] = useState(initialValue?.name ?? "");
  const [type, setType] = useState(initialValue?.type ?? "");
  const [direction, setDirection] = useState<Direction>(
    initialValue?.direction ?? "Duplex",
  );
  const [enabled, setEnabled] = useState(initialValue?.enabled ?? true);
  const [tags, setTags] = useState((initialValue?.tags ?? []).join(", "));
  const [description, setDescription] = useState(
    initialValue?.description ?? "",
  );
  const [params, setParams] = useState<Record<string, unknown>>(
    initialValue?.params ?? {},
  );
  const [localError, setLocalError] = useState<string | null>(null);

  /* ---------- вертикальный splitter ---------- */
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const [topHeight, setTopHeight] = useState<number>(loadTopHeight);
  const [resizing, setResizing] = useState(false);

  const clampTop = useCallback((h: number, totalH: number): number => {
    const maxTop = Math.max(MIN_TOP, totalH - MIN_BOTTOM - SPLITTER_HEIGHT);
    return Math.max(MIN_TOP, Math.min(maxTop, h));
  }, []);

  useLayoutEffect(() => {
    const container = splitContainerRef.current;
    if (!container) return;
    const totalH = container.clientHeight;
    if (totalH <= 0) return;
    setTopHeight((h) => clampTop(h, totalH));
  }, [clampTop]);

  useEffect(() => {
    const container = splitContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const totalH = container.clientHeight;
      if (totalH <= 0) return;
      setTopHeight((h) => clampTop(h, totalH));
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [clampTop]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(topHeight));
    } catch {
      /* ignore */
    }
  }, [topHeight]);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const container = splitContainerRef.current;
      if (!container) return;

      const startY = e.clientY;
      const startH = topHeight;
      const totalH = container.clientHeight;

      const onMove = (ev: MouseEvent) => {
        const dy = ev.clientY - startY;
        setTopHeight(clampTop(startH + dy, totalH));
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setResizing(false);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      setResizing(true);
    },
    [topHeight, clampTop],
  );

  /* ---------- синхронизация с initialValue ---------- */
  const enabledDirtyRef = useRef(false);

  useEffect(() => {
    if (!enabledDirtyRef.current) {
      setEnabled(initialValue?.enabled ?? true);
    }
  }, [initialValue?.enabled]);

  const currentTemplate = type ? templatesByType[type] : null;

  useEffect(() => {
    setName(initialValue?.name ?? "");
    setType(initialValue?.type ?? "");
    setDirection(initialValue?.direction ?? "Duplex");
    setEnabled(initialValue?.enabled ?? true);
    setTags((initialValue?.tags ?? []).join(", "));
    setDescription(initialValue?.description ?? "");
    setParams(initialValue?.params ?? {});
    setLocalError(null);
    enabledDirtyRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  useEffect(() => {
    if (!currentTemplate) return;
    setParams((prev) => {
      const next: Record<string, unknown> = { ...prev };
      for (const [key, meta] of Object.entries(currentTemplate.params)) {
        if (!(key in next)) next[key] = meta.default ?? "";
      }
      return next;
    });
  }, [currentTemplate]);

  /* ---------- union параметров ---------- */
  const paramEntries = useMemo(() => {
    const result: Array<[string, ParamMeta, unknown]> = [];
    const seen = new Set<string>();

    if (currentTemplate) {
      const entries = Object.entries(currentTemplate.params).sort(
        ([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0),
      );
      for (const [key, meta] of entries) {
        result.push([key, meta, params[key]]);
        seen.add(key);
      }
    }

    for (const key of Object.keys(params)) {
      if (seen.has(key)) continue;
      result.push([key, inferParamMeta(params[key], key), params[key]]);
      seen.add(key);
    }

    return result;
  }, [currentTemplate, params]);

  const hasParams = paramEntries.length > 0;

  const setParam = (key: string, value: unknown) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!name.trim()) {
      setLocalError("Имя обязательно");
      return;
    }
    if (!type) {
      setLocalError("Выберите тип коннектора");
      return;
    }
    if (!direction) {
      setLocalError("Выберите направление");
      return;
    }

    if (currentTemplate) {
      for (const [key, meta] of Object.entries(currentTemplate.params)) {
        const val = params[key];
        if (
          meta.required &&
          (val === undefined || val === null || val === "")
        ) {
          setLocalError(`Параметр «${key}» обязателен`);
          return;
        }
      }
    }

    const normalizedParams: Record<string, unknown> = {};
    for (const [key, meta] of paramEntries) {
      const raw = params[key];
      if (meta.data_type === "object" || meta.data_type === "array") {
        if (typeof raw === "string" && raw.trim()) {
          try {
            normalizedParams[key] = JSON.parse(raw);
          } catch {
            setLocalError(`Параметр «${key}»: невалидный JSON`);
            return;
          }
        } else if (raw !== undefined) {
          normalizedParams[key] = raw;
        }
      } else if (isNumericType(meta.data_type)) {
        if (raw === "" || raw === undefined || raw === null) {
          // не отправляем пустое число
        } else {
          normalizedParams[key] = raw;
        }
      } else {
        normalizedParams[key] = raw;
      }
    }

    const tagsArr = tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    await onSubmit({
      name: name.trim(),
      type,
      enabled,
      direction,
      description: description.trim() || undefined,
      tags: tagsArr.length ? tagsArr : undefined,
      params: normalizedParams,
      metadata: initialValue?.metadata,
    });
  };

  return (
    <form className="props-panel" onSubmit={handleSubmit}>
      <div className="props-header">
        {isEdit ? `Коннектор «${initialValue.name}»` : "Новый коннектор"}
        {!isEdit && folderPath && (
          <span className="props-header-folder"> → {folderPath}</span>
        )}
        {!isEdit && !folderPath && (
          <span className="props-header-folder"> → корень</span>
        )}
      </div>

      <div className="props-split-container" ref={splitContainerRef}>
        {/* ---------- блок 1: основные поля ---------- */}
        <div
          className="props-block props-block-main"
          style={
            hasParams
              ? { flex: `0 1 ${topHeight}px` }
              : { flex: "1 1 0" }
          }
        >
          <div className="props-body">
            <FieldRow label="Имя" required>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                autoFocus={!isEdit}
              />
            </FieldRow>

            <FieldRow label="Тип" required>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={saving || isEdit}
                title={
                  isEdit
                    ? "Тип нельзя изменить у существующего коннектора"
                    : undefined
                }
              >
                <option value="">— выберите —</option>
                {templates.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label} ({t.type})
                  </option>
                ))}
                {type && !templatesByType[type] && (
                  <option value={type}>{type}</option>
                )}
              </select>
            </FieldRow>

            <FieldRow label="Направление" required>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as Direction)}
                disabled={saving}
              >
                {DIRECTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d === "Source"
                      ? "📥 Источник"
                      : d === "Sink"
                        ? "📤 Приёмник"
                        : "🔄 Двунаправленный"}
                  </option>
                ))}
              </select>
            </FieldRow>

            <FieldRow label="Включён">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => {
                  setEnabled(e.target.checked);
                  enabledDirtyRef.current = true;
                }}
                disabled={saving}
                className="props-checkbox"
              />
            </FieldRow>

            <FieldRow label="Теги">
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="api, prod"
                disabled={saving}
              />
            </FieldRow>

            <FieldRow label="Описание" align="top">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
                rows={2}
              />
            </FieldRow>
          </div>
        </div>

        {/* ---------- разделитель ---------- */}
        {hasParams && (
          <div
            className={
              "props-vsplitter" + (resizing ? " is-resizing" : "")
            }
            role="separator"
            aria-orientation="horizontal"
            title="Потяните, чтобы изменить высоту блоков"
            onMouseDown={startResize}
          />
        )}

        {/* ---------- блок 2: параметры ---------- */}
        {hasParams && (
          <div className="props-block props-block-params">
            <div className="props-section">
              Параметры
              {currentTemplate && (
                <span className="props-header-folder">
                  {" "}— шаблон «{currentTemplate.label}»
                </span>
              )}
              {!currentTemplate && (
                <span className="props-header-folder">
                  {" "}— нет шаблона, поля выведены из значений
                </span>
              )}
            </div>
            <div className="props-body">
              {paramEntries.map(([key, meta]) => (
                <ParamRow
                  key={key}
                  name={key}
                  meta={meta}
                  value={params[key]}
                  onChange={(v) => setParam(key, v)}
                  disabled={saving}
                  scriptBaseUrl={scriptBaseUrl}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {localError && <div className="props-error">{localError}</div>}

      <div className="props-footer">
        <button className="btn primary" type="submit" disabled={saving}>
          Сохранить
        </button>
        <button
          className="btn"
          type="button"
          onClick={onCancel}
          disabled={saving}
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  FieldRow — с tooltip на label                                      */
/* ------------------------------------------------------------------ */

interface FieldRowProps {
  label: string;
  required?: boolean;
  align?: "center" | "top";
  hint?: string;
  children: React.ReactNode;
}

function FieldRow({
  label,
  required,
  align = "center",
  hint,
  children,
}: FieldRowProps) {
  return (
    <div className={"props-field align-" + align}>
      <label
        title={hint || undefined}
        className={hint ? "has-hint" : undefined}
      >
        {label} {required && <span className="req">*</span>}
        {hint && (
          <span className="props-hint-icon" aria-label={hint} title={hint}>
            ?
          </span>
        )}
      </label>
      <div className="props-value">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ParamRow                                                           */
/* ------------------------------------------------------------------ */

interface ParamRowProps {
  name: string;
  meta: ParamMeta;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled: boolean;
  scriptBaseUrl: string;
}

function ParamRow({
  name,
  meta,
  value,
  onChange,
  disabled,
  scriptBaseUrl,
}: ParamRowProps) {
  return (
    <FieldRow
      label={name}
      required={meta.required}
      align="top"
      hint={meta.description}
    >
      {renderControl()}
    </FieldRow>
  );

  function renderControl() {
    switch (meta.data_type) {
      case "boolean":
        return (
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="props-checkbox"
          />
        );

      case "integer":
      case "number":
        return (
          <input
            type="number"
            value={value === undefined || value === null ? "" : String(value)}
            min={meta.min}
            max={meta.max}
            step={meta.data_type === "integer" ? 1 : "any"}
            onChange={(e) =>
              onChange(e.target.value === "" ? "" : Number(e.target.value))
            }
            disabled={disabled}
          />
        );

      case "choice":
        return (
          <select
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">— выберите —</option>
            {(meta.choices ?? []).map((c) => (
              <option key={String(c)} value={String(c)}>
                {String(c)}
              </option>
            ))}
          </select>
        );

      case "secret":
        return (
          <input
            type="password"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            autoComplete="new-password"
          />
        );

      case "object":
      case "array":
        return (
          <textarea
            value={toJsonText(value, meta.data_type)}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            rows={4}
            spellCheck={false}
            placeholder={meta.data_type === "array" ? "[]" : "{}"}
          />
        );

      case "script":
        return (
          <ScriptParamField
            value={typeof value === "string" ? value : ""}
            onChange={onChange}
            disabled={disabled}
            baseUrl={scriptBaseUrl}
          />
        );

      case "uri":
      case "hostname":
      case "duration":
      case "string":
      default: {
        const placeholder =
          meta.data_type === "uri"
            ? "http:// или https://…"
            : meta.data_type === "duration"
              ? "30s, 5m, 2h"
              : meta.data_type === "hostname"
                ? "example.com"
                : meta.pattern
                  ? `Шаблон: ${meta.pattern}`
                  : undefined;

        return (
          <input
            type="text"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
          />
        );
      }
    }
  }
}

function toJsonText(value: unknown, kind: "object" | "array"): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return kind === "array" ? "[]" : "{}";
  }
}