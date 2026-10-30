import { useEffect, useMemo, useState } from "react";
import type { SecurityApi } from "./api";
import type { RoleRecord, UserRecord } from "./types";
import { isReservedRole } from "./types";
import { RolesMatrix } from "./RolesMatrix";
import { act, sep, useContextMenu } from "../../components/context-menu";

interface Props {
  api: SecurityApi;
  state: {
    data: RoleRecord[];
    loading: boolean;
    error: string | null;
    reload: () => Promise<void>;
  };
  users: UserRecord[];
  readonly: boolean;
}

type Editor =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; role: RoleRecord };

export function RolesTab({ api, state, users, readonly }: Props) {
  const { openContextMenu } = useContextMenu();
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RoleRecord | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["builtin", "custom"]),
  );

  const selected = state.data.find((r) => r.name === selectedName) ?? null;
  const builtin = state.data.filter((r) => r.privilege !== null);
  const custom = state.data.filter((r) => r.privilege === null);

  const userCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of users) m.set(u.role, (m.get(u.role) ?? 0) + 1);
    return m;
  }, [users]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const toggleGroup = (key: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const canEdit = (r: RoleRecord | null): boolean => {
    if (!r) return false;
    if (readonly) return false;
    if (r.privilege !== null) return false;
    return true;
  };

  const canDelete = (r: RoleRecord | null): boolean => {
    if (!r) return false;
    if (readonly) return false;
    if (r.privilege !== null) return false;
    if (isReservedRole(r.name)) return false;
    if ((userCounts.get(r.name) ?? 0) > 0) return false;
    return true;
  };

  const deleteDisabledReason = (r: RoleRecord | null): string | undefined => {
    if (!r) return undefined;
    if (r.privilege !== null) return "Встроенную роль нельзя удалить";
    if (isReservedRole(r.name)) return "Роль зарезервирована";
    const n = userCounts.get(r.name) ?? 0;
    if (n > 0) {
      return `Роль используется ${n} пользовател${n === 1 ? "ем" : "ями"}`;
    }
    return undefined;
  };

  const handleSelect = (r: RoleRecord) => {
    setEditor({ kind: "none" });
    setSelectedName(r.name);
  };

  const handleCreate = () => {
    setSelectedName(null);
    setEditor({ kind: "create" });
  };

  const handleSave = async (name: string, resources: string[]) => {
    setBusy(true);
    try {
      if (editor.kind === "create") {
        await api.createRole({ name, allowed_resources: resources });
        setToast(`Роль «${name}» создана`);
        setSelectedName(name);
      } else if (editor.kind === "edit") {
        await api.updateRole(editor.role.name, {
          name,
          allowed_resources: resources,
        });
        setToast(`Роль «${name}» сохранена`);
        setSelectedName(name);
      }
      setEditor({ kind: "none" });
      await state.reload();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const r = confirmDelete;
    setConfirmDelete(null);
    setBusy(true);
    try {
      await api.deleteRole(r.name);
      setToast(`Роль «${r.name}» удалена`);
      if (selectedName === r.name) setSelectedName(null);
      await state.reload();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openRowMenu = (e: React.MouseEvent, role: RoleRecord) => {
    setSelectedName(role.name);
    openContextMenu(e, [
      act("Редактировать", () => setEditor({ kind: "edit", role }), {
        disabled: !canEdit(role) || busy,
      }),
      sep(),
      act("Удалить", () => setConfirmDelete(role), {
        danger: true,
        disabled: !canDelete(role) || busy,
      }),
      sep(),
      act("Обновить", () => void state.reload(), {
        disabled: state.loading || busy,
      }),
    ]);
  };

  const openBlankMenu = (e: React.MouseEvent) => {
    openContextMenu(e, [
      act("Создать роль", handleCreate, { disabled: readonly || busy }),
      sep(),
      act("Обновить", () => void state.reload(), {
        disabled: state.loading || busy,
      }),
    ]);
  };

  return (
    <div className="sec-panel" onContextMenu={openBlankMenu}>
      <div className="sec-toolbar">
        <button
          className="btn"
          onClick={handleCreate}
          disabled={readonly || busy}
        >
          Создать
        </button>
        <button
          className="btn danger"
          onClick={() =>
            selected && canDelete(selected) && setConfirmDelete(selected)
          }
          disabled={!selected || !canDelete(selected) || busy}
          title={deleteDisabledReason(selected)}
        >
          Удалить
        </button>
        <button
          className="btn"
          onClick={() => state.reload()}
          disabled={state.loading || busy}
        >
          Обновить
        </button>
        <span className="spacer" />
        <span className="sec-stats">
          Всего: {state.data.length}
          {" · "}Встроенных: {builtin.length}
          {" · "}Кастомных: {custom.length}
        </span>
      </div>

      <div className="sec-split">
        <div className="sec-tree">
          {state.loading && state.data.length === 0 && (
            <div className="sec-hint">Загрузка…</div>
          )}
          {state.error && state.data.length === 0 && (
            <div className="sec-hint">
              {state.error}{" "}
              <button className="btn" onClick={() => state.reload()}>
                Повторить
              </button>
            </div>
          )}

          <RoleGroup
            label="Встроенные"
            groupKey="builtin"
            roles={builtin}
            expanded={expanded.has("builtin")}
            onToggle={() => toggleGroup("builtin")}
            selectedName={selectedName}
            userCounts={userCounts}
            onSelect={handleSelect}
            onContextMenu={openRowMenu}
          />
          <RoleGroup
            label="Кастомные"
            groupKey="custom"
            roles={custom}
            expanded={expanded.has("custom")}
            onToggle={() => toggleGroup("custom")}
            selectedName={selectedName}
            userCounts={userCounts}
            onSelect={handleSelect}
            onContextMenu={openRowMenu}
          />
        </div>

        <div className="sec-props">
          {editor.kind === "none" && !selected && (
            <div className="sec-hint props-hint">
              Выберите роль в дереве или нажмите «Создать»
            </div>
          )}
          {editor.kind === "none" && selected && (
            <RoleView
              role={selected}
              canEdit={canEdit(selected)}
              userCount={userCounts.get(selected.name) ?? 0}
              onEdit={() => setEditor({ kind: "edit", role: selected })}
            />
          )}
          {editor.kind === "create" && (
            <RolesMatrix
              initialName=""
              initialResources={[]}
              nameEditable={true}
              busy={busy}
              onSave={handleSave}
              onCancel={() => setEditor({ kind: "none" })}
            />
          )}
          {editor.kind === "edit" && (
            <RolesMatrix
              initialName={editor.role.name}
              initialResources={editor.role.allowed_resources}
              nameEditable={false}
              busy={busy}
              onSave={handleSave}
              onCancel={() => setEditor({ kind: "none" })}
            />
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Удалить роль?</h3>
            <p>
              Роль <b>{confirmDelete.name}</b> будет удалена безвозвратно.
              Пользователей с этой ролью:{" "}
              {userCounts.get(confirmDelete.name) ?? 0}.
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setConfirmDelete(null)}>
                Отмена
              </button>
              <button
                className="btn danger"
                onClick={handleDelete}
                disabled={busy}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="sec-toast">{toast}</div>}
    </div>
  );
}

interface RoleGroupProps {
  label: string;
  groupKey: string;
  roles: RoleRecord[];
  expanded: boolean;
  onToggle: () => void;
  selectedName: string | null;
  userCounts: Map<string, number>;
  onSelect: (r: RoleRecord) => void;
  onContextMenu: (e: React.MouseEvent, r: RoleRecord) => void;
}

function RoleGroup({
  label,
  roles,
  expanded,
  onToggle,
  selectedName,
  userCounts,
  onSelect,
  onContextMenu,
}: RoleGroupProps) {
  return (
    <div className="sec-group">
      <div className="sec-group-header" onClick={onToggle}>
        <span className="chevron">{expanded ? "▾" : "▸"}</span>
        <span className="icon">📁</span>
        <span className="label">{label}</span>
        <span className="count">({roles.length})</span>
      </div>
      {expanded &&
        roles.map((r) => {
          const usage = userCounts.get(r.name) ?? 0;
          const tail = r.privilege
            ? r.privilege
            : `${r.allowed_resources.length}${usage > 0 ? ` · ${usage}👤` : ""}`;
          return (
            <div
              key={r.name}
              className={
                "sec-leaf" +
                (r.name === selectedName ? " is-selected" : "")
              }
              onClick={() => onSelect(r)}
              onContextMenu={(e) => onContextMenu(e, r)}
            >
              <span className="icon">🛡</span>
              <span className="label">{r.name}</span>
              <span className="muted">{tail}</span>
            </div>
          );
        })}
    </div>
  );
}

interface RoleViewProps {
  role: RoleRecord;
  canEdit: boolean;
  userCount: number;
  onEdit: () => void;
}

function RoleView({ role, canEdit, userCount, onEdit }: RoleViewProps) {
  const isBuiltin = role.privilege !== null;
  const isReserved = isReservedRole(role.name);
  return (
    <div className="props">
      <div className="props-header">Роль «{role.name}»</div>
      <div className="props-body">
        <div className="prop-row">
          <div className="prop-label">Имя</div>
          <div className="prop-value mono">{role.name}</div>
        </div>
        <div className="prop-row">
          <div className="prop-label">Privilege</div>
          <div className="prop-value">{role.privilege ?? "—"}</div>
        </div>
        <div className="prop-row">
          <div className="prop-label">Пользователей</div>
          <div className="prop-value">
            {userCount}
            {userCount > 0 && (
              <span className="muted"> (роль нельзя удалить)</span>
            )}
          </div>
        </div>
        <div className="prop-row">
          <div className="prop-label">Ресурсы</div>
          <div className="prop-value">
            {role.allowed_resources.length === 0 ? (
              <span className="muted">нет</span>
            ) : role.allowed_resources.includes("*") ? (
              <span className="mono">*:* (все действия)</span>
            ) : role.allowed_resources.includes("*:read") ? (
              <span className="mono">*:read (только чтение)</span>
            ) : (
              <span className="mono">
                {role.allowed_resources.length} шт.
              </span>
            )}
          </div>
        </div>

        {isBuiltin && (
          <div className="props-banner">
            Встроенная роль. Её права определяются ядром, изменить или удалить
            нельзя.
          </div>
        )}
        {!isBuiltin && isReserved && (
          <div className="props-banner">
            Зарезервированная роль. Ресурсы редактируются, удаление запрещено.
          </div>
        )}

        <div className="prop-row">
          <div className="prop-label">Список</div>
          <div className="prop-value">
            <pre className="scope-list">
              {role.allowed_resources.join("\n")}
            </pre>
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="props-footer">
          <button className="btn primary" onClick={onEdit}>
            Редактировать
          </button>
        </div>
      )}
    </div>
  );
}