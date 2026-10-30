import { useEffect, useMemo, useState } from "react";
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
  onSubmit: (input: ConnectorInput) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

const DIRECTIONS: Direction[] = ["Source", "Sink", "Duplex"];

export function ConnectorForm({
  initialValue,
  templates,
  templatesByType,
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
  const [tags, setTags] = useState(
    (initialValue?.tags ?? []).join(", "),
  );
  const [description, setDescription] = useState(initialValue?.description ?? "");
  const [params, setParams] = useState<Record<string, unknown>>(
    initialValue?.params ?? {},
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const currentTemplate = type ? templatesByType[type] : null;

  // При смене типа подставляем дефолты для отсутствующих параметров.
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

    // object/array приходят как строки из textarea — попробуем распарсить
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
    });
  };

  return (
    <form className="connectors-form-inner" onSubmit={handleSubmit}>
      <div className="field">
        <label>
          Имя <span className="req">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
          autoFocus={!isEdit}
        />
      </div>

      <div className="field">
        <label>
          Тип <span className="req">*</span>
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          disabled={saving || isEdit}
          title={isEdit ? "Тип нельзя изменить у существующего коннектора" : undefined}
        >
          <option value="">— выберите —</option>
          {templates.map((t) => (
            <option key={t.type} value={t.type}>
              {t.label} ({t.type})
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>
          Направление <span className="req">*</span>
        </label>
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
      </div>

      <div className="checkbox-field">
        <input
          id="conn-enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={saving}
        />
        <label htmlFor="conn-enabled">Включён</label>
      </div>

      <div className="field">
        <label>Теги</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="api, prod"
          disabled={saving}
        />
      </div>

      <div className="field">
        <label>Описание</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={saving}
          rows={2}
        />
      </div>

      {currentTemplate && sortedParams.length > 0 && (
        <>
          <div className="connectors-form-section">Параметры</div>
          {sortedParams.map(([key, meta]) => (
            <DynamicParamField
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

      {localError && <div className="connectors-error">{localError}</div>}

      <div className="connectors-form-actions">
        <button className="btn primary" type="submit" disabled={saving}>
          Сохранить
        </button>
        <button className="btn" type="button" onClick={onCancel} disabled={saving}>
          Отмена
        </button>
      </div>
    </form>
  );
}

interface ParamProps {
  name: string;
  meta: ParamMeta;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled: boolean;
}

function DynamicParamField({ name, meta, value, onChange, disabled }: ParamProps) {
  const label = (
    <label>
      {name} {meta.required && <span className="req">*</span>}
    </label>
  );

  const hint = meta.description ? (
    <span className="param-hint">{meta.description}</span>
  ) : null;

  switch (meta.data_type) {
    case "boolean":
      return (
        <div className="checkbox-field">
          <input
            id={`p-${name}`}
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
          />
          <label htmlFor={`p-${name}`}>{name}</label>
          {hint}
        </div>
      );

    case "integer":
    case "number":
      return (
        <div className="field">
          {label}
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
          {hint}
        </div>
      );

    case "choice":
      return (
        <div className="field">
          {label}
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
          {hint}
        </div>
      );

    case "secret":
      return (
        <div className="field">
          {label}
          <input
            type="password"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            autoComplete="new-password"
          />
          {hint}
        </div>
      );

    case "object":
    case "array":
      return (
        <div className="field">
          {label}
          <textarea
            value={toJsonText(value, meta.data_type)}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            rows={4}
            spellCheck={false}
            placeholder={meta.data_type === "array" ? "[]" : "{}"}
          />
          {hint}
        </div>
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
        <div className="field">
          {label}
          <input
            type="text"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
          />
          {hint}
        </div>
      );
    }
  }
}

function toJsonText(value: unknown, kind: "object" | "array"): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return kind === "array" ? "[]" : "{}";
  }
}