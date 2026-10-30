import { useState } from "react";
import type { SecurityApi } from "./api";
import { useSecurity } from "./useSecurity";
import { ActiveUsersTab } from "./ActiveUsersTab";
import { UsersTab } from "./UsersTab";
import { RolesTab } from "./RolesTab";
import { shortSessionId, formatRemaining } from "./types";
import "./security.css";

type SubTab = "sessions" | "users" | "roles";

interface Props {
  api: SecurityApi;
  currentSessionId: string | null;
  currentRole: string;
  tokenExpiresAt: string | null;
}

export function SecurityWidget({
  api,
  currentSessionId,
  currentRole,
  tokenExpiresAt,
}: Props) {
  const [activeTab, setActiveTab] = useState<SubTab>("sessions");
  const security = useSecurity(api);

  // read-only если роль viewer
  const readonly = currentRole === "viewer";

  return (
    <div className="security-tab">
      <div className="security-current">
        <span className="label">Текущая сессия:</span>
        <span className="role">{currentRole || "—"}</span>
        {currentSessionId && (
          <>
            <span className="sep">·</span>
            <span className="session-id" title={currentSessionId}>
              {shortSessionId(currentSessionId)}
            </span>
          </>
        )}
        {tokenExpiresAt && (
          <>
            <span className="sep">·</span>
            <span className="expiry">
              истекает через {formatRemaining(tokenExpiresAt)}
            </span>
          </>
        )}
        {readonly && <span className="readonly-badge">Режим просмотра</span>}
      </div>

      <div className="security-subtabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "sessions"}
          className={"security-subtab" + (activeTab === "sessions" ? " is-active" : "")}
          onClick={() => setActiveTab("sessions")}
        >
          Активные пользователи
          {security.sessions.data.length > 0 && (
            <span className="badge">{security.sessions.data.length}</span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "users"}
          className={"security-subtab" + (activeTab === "users" ? " is-active" : "")}
          onClick={() => setActiveTab("users")}
        >
          Пользователи
          {security.users.data.length > 0 && (
            <span className="badge">{security.users.data.length}</span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "roles"}
          className={"security-subtab" + (activeTab === "roles" ? " is-active" : "")}
          onClick={() => setActiveTab("roles")}
        >
          Роли
          {security.roles.data.length > 0 && (
            <span className="badge">{security.roles.data.length}</span>
          )}
        </button>
      </div>

      <div className="security-content">
        {activeTab === "sessions" && (
          <ActiveUsersTab
            api={api}
            state={security.sessions}
            readonly={readonly}
            currentSessionId={currentSessionId}
          />
        )}
        {activeTab === "users" && (
          <UsersTab
            api={api}
            state={security.users}
            roles={security.roles.data}
            readonly={readonly}
            currentSessionId={currentSessionId}
          />
        )}
        {activeTab === "roles" && (
        <RolesTab
            api={api}
            state={security.roles}
            users={security.users.data}
            readonly={readonly}
        />
        )}
      </div>
    </div>
  );
}
