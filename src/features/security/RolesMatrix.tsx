import { useState } from "react";
import { ALL_ACTIONS, RESOURCE_ACTIONS, RESOURCE_ORDER, validateRoleName } from "./types";

interface Props {
  initialName: string;
  initialResources: string[];
  nameEditable: boolean;
  busy: boolean;
  onSave: (name: string, resources: string[]) => void;
  onCancel: () => void;
}

interface MatrixState {
  fullAccess: boolean;
  readOnly: boolean;
  specific: Set<string>;
}

function parseInitial(resources: string[]): MatrixState {
  if (resources.includes("*")) {
    return { fullAccess: true, readOnly: false, specific: new Set() };
  }
  if (resources.includes("*:read")) {
    return { fullAccess: false, readOnly: true, specific: new Set() };
  }
  return {
    fullAccess: false,
    readOnly: false,
    specific: new Set(resources),
  };
}

function toOutput(state: MatrixState): string[] {
  if (state.fullAccess) return ["*"];
  if (state.readOnly) return ["*:read"];
  return Array.from(state.specific).sort();
}

export function RolesMatrix({
  initialName,
  initialResources,
  nameEditable,
  busy,
  onSave,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialName);
  const [state, setState] = useState<MatrixState>(() => parseInitial(initialResources));
  const [nameError, setNameError] = useState<string | null>(null);

  const toggleCell = (resource: string, action: string) => {
    if (state.fullAccess || state.readOnly) return;
    const key = `${resource}:${action}`;
    setState((prev) => {
      const next = new Set(prev.specific);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, specific: next };
    });
  };

  const setFullAccess = (on: boolean) => {
    setState({ fullAccess: on, readOnly: false, specific: new Set() });
  };

  const setReadOnly = (on: boolean) => {
    setState({ fullAccess: false, readOnly: on, specific: new Set() });
  };

  const isCellChecked = (resource: string, action: string): boolean => {
    if (state.fullAccess) return true;
    if (state.readOnly) return action === "read";
    return state.specific.has(`${resource}:${action}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameEditable) {
      const err = validateRoleName(name);
      if (err) {
        setNameError(err);
        return;
      }
    }
    setNameError(null);
    onSave(nameEditable ? name : initialName, toOutput(state));
  };

  return (
    <form className="props" onSubmit={handleSubmit}>
      <div className="props-header">
        {nameEditable ? "Новая роль" : `Редактирование роли «${initialName}»`}
      </div>
      <div className="props-body">
        {nameEditable && (
          <div className="prop-row">
            <div className="prop-label">
              Имя <span className="req">*</span>
            </div>
            <div className="prop-value">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value.toLowerCase());
                  setNameError(null);
                }}
                disabled={busy}
                placeholder="developer, monitoring, devops"
                autoFocus
                spellCheck={false}
              />
              {nameError && <div className="field-error">{nameError}</div>}
            </div>
          </div>
        )}

        <div className="matrix-presets">
          <label>
            <input
              type="checkbox"
              checked={state.fullAccess}
              onChange={(e) => setFullAccess(e.target.checked)}
              disabled={busy}
            />
            <span>
              Полный доступ (<code>*:*</code>)
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={state.readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
              disabled={busy}
            />
            <span>
              Только чтение (<code>*:read</code>)
            </span>
          </label>
        </div>

        <div className="matrix-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th></th>
                {ALL_ACTIONS.map((a) => (
                  <th key={a} title={a}>
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RESOURCE_ORDER.map((resource) => {
                const allowed = RESOURCE_ACTIONS[resource] ?? [];
                return (
                  <tr key={resource}>
                    <th className="row-label">{resource}</th>
                    {ALL_ACTIONS.map((action) => {
                      const applicable = allowed.includes(action);
                      if (!applicable) {
                        return <td key={action} className="matrix-na" />;
                      }
                      const checked = isCellChecked(resource, action);
                      const disabled = busy || state.fullAccess || state.readOnly;
                      return (
                        <td key={action}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCell(resource, action)}
                            disabled={disabled}
                            title={`${resource}:${action}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="matrix-summary">
          Итог: <code>{toOutput(state).join(", ") || "—"}</code>
        </div>
      </div>

      <div className="props-footer">
        <button className="btn primary" type="submit" disabled={busy}>
          Сохранить
        </button>
        <button className="btn" type="button" onClick={onCancel} disabled={busy}>
          Отмена
        </button>
      </div>
    </form>
  );
}