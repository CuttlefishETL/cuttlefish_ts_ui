import { useEffect, useMemo, useState } from "react";
import type { SecurityApi } from "./api";
import type { RoleRecord, UserRecord } from "./types";
import { groupUsersByRole } from "./types";
import { act, sep, useContextMenu } from "../../components/context-menu";

interface Props {
  api: SecurityApi;
  state: {
    data: UserRecord[];
    loading: boolean;
    error: string | null;
    reload: () => Promise<void>;
  };
  roles: RoleRecord[];
  readonly: boolean;
  currentSessionId: string | null;
}

type Editor =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; user: UserRecord };

export function UsersTab({ api, state, roles, readonly }: Props) {
  const { openContextMenu } = useContextMenu();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editor, setEditor] = useState<Editor>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRecord | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["admin", "user", "viewer", "other"]),
  );

  const selected = state.data.find((u) => u.id === selectedId) ?? null;
  const grouped = useMemo(() => groupUsersByRole(state.data), [state.data]);

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

  const handleSelect = (user: UserRecord) => {
    setEditor({ kind: "none" });
    setSelectedId(user.id);
  };

  const handleCreate = () => {
    setSelectedId(null);
    setEditor({ kind: "create" });
  };

  const handleSave = async (data: {
    username: string;
    role: string;
    password?: string;
  }) => {
    setBusy(true);
    try {
      if (editor.kind === "create") {
        await api.createUser({
          username: data.username,
          password: data.password ?? "",
          role: data.role,
        });
        setToast(`Пользователь «${data.username}» создан`);
      } else if (editor.kind === "edit") {
        await api.updateUser(editor.user.id, {
          username: data.username,
          role: data.role,
        });
        if (data.password) {
          await api.changePassword(editor.user.id, data.password);
        }
        setToast(`Пользователь «${data.username}» обновлён`);
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
    const u = confirmDelete;
    setConfirmDelete(null);
    setBusy(true);
    try {
      await api.deleteUser(u.id);
      setToast(`Пользователь «${u.username}» удалён`);
      if (selectedId === u.id) setSelectedId(null);
      await state.reload();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canEdit = (u: UserRecord): boolean => {
    if (readonly) return false;
    return u.username !== "admin";
  };
  const canDelete = (u: UserRecord): boolean => {
    if (readonly) return false;
    if (u.username === "admin") return false;
    return true;
  };

  const openRowMenu = (e: React.MouseEvent, user: UserRecord) => {
    setSelectedId(user.id);
    openContextMenu(e, [
      act("Редактировать", () => setEditor({ kind: "edit", user }), {
        disabled: !canEdit(user) || busy,
      }),
      act("Сбросить пароль", () => {
        const pwd = window.prompt(`Новый пароль для «${user.username}»:`);
        if (pwd) {
          void api
            .changePassword(user.id, pwd)
            .then(() => setToast("Пароль обновлён"))
            .catch((err) => setToast((err as Error).message));
        }
      }, { disabled: readonly || busy }),
      sep(),
      act("Удалить", () => setConfirmDelete(user), {
        danger: true,
        disabled: !canDelete(user) || busy,
      }),
      sep(),
      act("Обновить", () => void state.reload(), {
        disabled: state.loading || busy,
      }),
    ]);
  };

  const openBlankMenu = (e: React.MouseEvent) => {
    openContextMenu(e, [
      act("Создать пользователя", handleCreate, { disabled: readonly || busy }),
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
          title={
            selected?.username === "admin"
              ? "Нельзя удалить пользователя admin"
              : undefined
          }
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
          {" · "}Админов: {grouped.admin.length}
          {" · "}Пользователей: {grouped.user.length}
          {" · "}Наблюдателей: {grouped.viewer.length}
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

          <UserGroup
            label="Администраторы"
            groupKey="admin"
            users={grouped.admin}
            expanded={expanded.has("admin")}
            onToggle={() => toggleGroup("admin")}
            selectedId={selectedId}
            onSelect={handleSelect}
            onContextMenu={openRowMenu}
          />
          <UserGroup
            label="Пользователи API"
            groupKey="user"
            users={grouped.user}
            expanded={expanded.has("user")}
            onToggle={() => toggleGroup("user")}
            selectedId={selectedId}
            onSelect={handleSelect}
            onContextMenu={openRowMenu}
          />
          <UserGroup
            label="Наблюдатели"
            groupKey="viewer"
            users={grouped.viewer}
            expanded={expanded.has("viewer")}
            onToggle={() => toggleGroup("viewer")}
            selectedId={selectedId}
            onSelect={handleSelect}
            onContextMenu={openRowMenu}
          />
          {grouped.other.length > 0 && (
            <UserGroup
              label="Прочие роли"
              groupKey="other"
              users={grouped.other}
              expanded={expanded.has("other")}
              onToggle={() => toggleGroup("other")}
              selectedId={selectedId}
              onSelect={handleSelect}
              onContextMenu={openRowMenu}
            />
          )}
        </div>

        <div className="sec-props">
          {editor.kind === "none" && !selected && (
            <div className="sec-hint props-hint">
              Выберите пользователя в дереве или нажмите «Создать»
            </div>
          )}
          {editor.kind === "none" && selected && (
            <UserView
              user={selected}
              canEdit={canEdit(selected)}
              onEdit={() => setEditor({ kind: "edit", user: selected })}
              readonly={readonly}
            />
          )}
          {editor.kind !== "none" && (
            <UserForm
              initial={editor.kind === "edit" ? editor.user : null}
              roles={roles}
              readonly={readonly}
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
            <h3>Удалить пользователя?</h3>
            <p>{confirmDelete.username}</p>
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

interface GroupProps {
  label: string;
  groupKey: string;
  users: UserRecord[];
  expanded: boolean;
  onToggle: () => void;
  selectedId: number | null;
  onSelect: (u: UserRecord) => void;
  onContextMenu: (e: React.MouseEvent, u: UserRecord) => void;
}

function UserGroup({
  label,
  users,
  expanded,
  onToggle,
  selectedId,
  onSelect,
  onContextMenu,
}: GroupProps) {
  return (
    <div className="sec-group">
      <div className="sec-group-header" onClick={onToggle}>
        <span className="chevron">{expanded ? "▾" : "▸"}</span>
        <span className="icon">📁</span>
        <span className="label">{label}</span>
        <span className="count">({users.length})</span>
      </div>
      {expanded &&
        users.map((u) => (
          <div
            key={u.id}
            className={
              "sec-leaf" + (u.id === selectedId ? " is-selected" : "")
            }
            onClick={() => onSelect(u)}
            onContextMenu={(e) => onContextMenu(e, u)}
          >
            <span className="icon">👤</span>
            <span className="label">{u.username}</span>
            <span className="muted">{u.role}</span>
          </div>
        ))}
    </div>
  );
}

interface UserViewProps {
  user: UserRecord;
  canEdit: boolean;
  onEdit: () => void;
  readonly: boolean;
}

function UserView({ user, canEdit, onEdit, readonly }: UserViewProps) {
  return (
    <div className="props">
      <div className="props-header">Пользователь «{user.username}»</div>
      <div className="props-body">
        <PropRow label="ID">{user.id}</PropRow>
        <PropRow label="Имя">{user.username}</PropRow>
        <PropRow label="Роль">{user.role}</PropRow>
        {user.username === "admin" && (
          <div className="props-banner">
            Встроенный администратор. Роль нельзя изменить, пользователя нельзя
            удалить.
          </div>
        )}
      </div>
      {!readonly && canEdit && (
        <div className="props-footer">
          <button className="btn primary" onClick={onEdit}>
            Редактировать
          </button>
        </div>
      )}
    </div>
  );
}

function PropRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="prop-row">
      <div className="prop-label">{label}</div>
      <div className="prop-value">{children}</div>
    </div>
  );
}

interface UserFormProps {
  initial: UserRecord | null;
  roles: RoleRecord[];
  readonly: boolean;
  busy: boolean;
  onSave: (data: {
    username: string;
    role: string;
    password?: string;
  }) => Promise<void>;
  onCancel: () => void;
}

function UserForm({
  initial,
  roles,
  readonly,
  busy,
  onSave,
  onCancel,
}: UserFormProps) {
  const [username, setUsername] = useState(initial?.username ?? "");
  const [role, setRole] = useState(initial?.role ?? "user");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isEdit = initial !== null;
  const isAdmin = initial?.username === "admin";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) return setError("Имя обязательно");
    if (!isEdit && !password) return setError("Пароль обязателен при создании");
    await onSave({
      username: username.trim(),
      role,
      password: password || undefined,
    });
  };

  return (
    <form className="props" onSubmit={handleSubmit}>
      <div className="props-header">
        {isEdit ? `Редактирование «${initial.username}»` : "Новый пользователь"}
      </div>
      <div className="props-body">
        <div className="prop-row">
          <div className="prop-label">
            Имя <span className="req">*</span>
          </div>
          <div className="prop-value">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy || isAdmin}
              autoFocus
            />
          </div>
        </div>

        <div className="prop-row">
          <div className="prop-label">
            Роль <span className="req">*</span>
          </div>
          <div className="prop-value">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={busy || isAdmin}
            >
              {roles.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name}
                  {r.privilege ? ` (${r.privilege})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="prop-row">
          <div className="prop-label">
            {isEdit ? "Новый пароль" : "Пароль"}{" "}
            {!isEdit && <span className="req">*</span>}
          </div>
          <div className="prop-value">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              autoComplete="new-password"
              placeholder={isEdit ? "Оставьте пустым, чтобы не менять" : ""}
            />
          </div>
        </div>

        {error && <div className="props-error">{error}</div>}
      </div>
      <div className="props-footer">
        <button className="btn primary" type="submit" disabled={busy || readonly}>
          Сохранить
        </button>
        <button className="btn" type="button" onClick={onCancel} disabled={busy}>
          Отмена
        </button>
      </div>
    </form>
  );
}