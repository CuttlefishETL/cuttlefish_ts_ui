import { useEffect, useMemo, useRef, useState } from "react";
import type { ConnectorInput } from "./api";
import type {
  ConnectorInstance,
  ConnectorTemplate,
  Direction,
  ParamMeta,
} from "./types";

interface Props {
  initialValue: ConnectorInstance | null;
  templates: ConnectorTemplate[];
  templatesByType: Record<string, ConnectorTemplate>;
  folderPath?: string;
  onSubmit: (input: ConnectorInput) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

const DIRECTIONS: Direction[] = ["Source", "Sink", "Duplex"];

export function ConnectorProperties({
  initialValue,
  templates,
  templatesByType,
  folderPath,
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

  // Черновик: если пользователь не трогал чекбокс в форме,
  // синхронизируем его с изменением из списка.
  const enabledDirtyRef = useRef(false);

  useEffect(() => {
    if (!enabledDirtyRef.current) {
      setEnabled(initialValue?.enabled ?? true);
    }
  }, [initialValue?.enabled]);

  const currentTemplate = type ? templatesByType[type] : null;

  useEffect(() => {
    if (!currentTemplate) return;
    setParams((prev) => {
      const next: Record<string, unknown> = {};
      for (const [key, meta] of Object.entries(currentTemplate.params)) {
        next[key] = key in prev ? prev[key] : meta.default ?? "";
      }
      return next;
    });
  }, [currentTemplate]);

  const sortedParams = useMemo(() => {
    if (!currentTemplate) return [];
    return Object.entries(currentTemplate.params).sort(
      ([, a], [, b]) => a.order - b.order,
    );
  }, [currentTemplate]);

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
    if (currentTemplate) {
      for (const [key, meta] of Object.entries(currentTemplate.params)) {
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
        } else {
          normalizedParams[key] = raw;
        }
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

        {currentTemplate && sortedParams.length > 0 && (
          <>
            <div className="props-section">Параметры</div>
            {sortedParams.map(([key, meta]) => (
              <ParamRow
                key={key}
                name={key}
                meta={meta}
                value={params[key]}
                onChange={(v) => setParam(key, v)}
                disabled={saving}
              />
            ))}
          </>
        )}

        {localError && <div className="props-error">{localError}</div>}
      </div>

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

interface FieldRowProps {
  label: string;
  required?: boolean;
  align?: "center" | "top";
  children: React.ReactNode;
}

function FieldRow({
  label,
  required,
  align = "center",
  children,
}: FieldRowProps) {
  return (
    <div className={"props-field align-" + align}>
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      <div className="props-value">{children}</div>
    </div>
  );
}

interface ParamRowProps {
  name: string;
  meta: ParamMeta;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled: boolean;
}

function ParamRow({
  name,
  meta,
  value,
  onChange,
  disabled,
}: ParamRowProps) {
  const hint = meta.description ? (
    <div className="props-hint">{meta.description}</div>
  ) : null;

  return (
    <FieldRow label={name} required={meta.required} align="top">
      {renderControl()}
      {hint}
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