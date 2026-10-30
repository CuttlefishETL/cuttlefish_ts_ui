import { useState } from "react";
import type { SecurityApi } from "./api";
import type { ActiveSession } from "./types";
import { formatRelative, shortSessionId, sourceIcon } from "./types";

interface Props {
  api: SecurityApi;
  state: {
    data: ActiveSession[];
    loading: boolean;
    error: string | null;
    reload: () => Promise<void>;
  };
  readonly: boolean;
  currentSessionId: string | null;
}

export function ActiveUsersTab({ api, state, readonly, currentSessionId }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmTerminate, setConfirmTerminate] = useState<ActiveSession | null>(null);

  const selected = state.data.find((s) => s.session_id === selectedId) ?? null;

  const canTerminate = !!selected && !selected.is_current && !readonly;

  const handleTerminate = async () => {
    if (!confirmTerminate) return;
    const target = confirmTerminate;
    setConfirmTerminate(null);
    setBusy(true);
    try {
      await api.deleteSession(target.session_id);
      setToast(`Сессия ${shortSessionId(target.session_id)} завершена`);
      setSelectedId(null);
      await state.reload();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleTerminateAll = async () => {
    if (!selected) return;
    if (
      !window.confirm(
        `Завершить все сессии пользователя «${selected.user_name}»?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await api.deleteUserSessions(selected.user_id);
      setToast(`Все сессии «${selected.user_name}» завершены`);
      setSelectedId(null);
      await state.reload();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sec-panel">
      <div className="sec-toolbar">
        <button className="btn" onClick={() => state.reload()} disabled={state.loading || busy}>
          Обновить
        </button>
        <button
          className="btn"
          onClick={() => selected && setConfirmTerminate(selected)}
          disabled={!canTerminate || busy}
          title={selected?.is_current ? "Нельзя завершить текущую сессию" : undefined}
        >
          Завершить сессию
        </button>
        <button
          className="btn"
          onClick={handleTerminateAll}
          disabled={!selected || busy}
        >
          Завершить все сессии пользователя
        </button>
        <span className="spacer" />
        <span className="sec-stats">
          Всего: {state.data.length}
          {" · "}Debug: {state.data.filter((s) => s.debug).length}
        </span>
      </div>

      <div className="sec-table">
        <div className="sec-thead sessions">
          <div>Session ID</div>
          <div>Пользователь</div>
          <div>Роль</div>
          <div>Источник</div>
          <div className="center">Debug</div>
          <div>Последняя активность</div>
        </div>

        <div className="sec-tbody">
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
          {!state.loading && !state.error && state.data.length === 0 && (
            <div className="sec-hint">Нет активных сессий</div>
          )}

          {state.data.map((s) => {
            const isSelected = s.session_id === selectedId;
            const isCurrent = s.session_id === currentSessionId || s.is_current;
            return (
              <div
                key={s.session_id}
                className={"sec-row sessions" + (isSelected ? " is-selected" : "")}
                onClick={() => setSelectedId(s.session_id)}
              >
                <div className="cell mono" title={s.session_id}>
                  {shortSessionId(s.session_id)}
                  {isCurrent && <span className="you-badge">you</span>}
                </div>
                <div className="cell">{s.user_name}</div>
                <div className="cell role">{s.role}</div>
                <div className="cell">
                  <span className="source-icon" title={s.source}>
                    {sourceIcon(s.source)}
                  </span>{" "}
                  {s.source}
                </div>
                <div className="cell center">
                  {s.debug ? (
                    <span className="debug-badge" title="Debug-сессия не чистится автоматически">
                      🔵
                    </span>
                  ) : (
                    "—"
                  )}
                </div>
                <div className="cell muted">{formatRelative(s.last_used)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {confirmTerminate && (
        <div className="modal-backdrop" onClick={() => setConfirmTerminate(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Завершить сессию?</h3>
            <p>
              Сессия <span className="mono">{shortSessionId(confirmTerminate.session_id)}</span>{" "}
              пользователя <b>{confirmTerminate.user_name}</b> будет немедленно завершена.
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setConfirmTerminate(null)}>
                Отмена
              </button>
              <button className="btn danger" onClick={handleTerminate} disabled={busy}>
                Завершить
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="sec-toast">{toast}</div>}
    </div>
  );
}
