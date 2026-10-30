import { useCallback, useEffect, useRef, useState } from "react";
import type { SecurityApi } from "./api";
import type { ActiveSession, RoleRecord, UserRecord } from "./types";

interface SectionState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export interface UseSecurityResult {
  sessions: SectionState<ActiveSession>;
  users: SectionState<UserRecord>;
  roles: SectionState<RoleRecord>;
}

export function useSecurity(api: SecurityApi): UseSecurityResult {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const reloadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const data = await api.listSessions();
      setSessions(data);
    } catch (e) {
      setSessionsError((e as Error).message);
    } finally {
      setSessionsLoading(false);
    }
  }, [api]);

  const reloadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (e) {
      setUsersError((e as Error).message);
    } finally {
      setUsersLoading(false);
    }
  }, [api]);

  const reloadRoles = useCallback(async () => {
    setRolesLoading(true);
    setRolesError(null);
    try {
      const data = await api.listRoles();
      setRoles(data);
    } catch (e) {
      setRolesError((e as Error).message);
    } finally {
      setRolesLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void reloadSessions();
    void reloadUsers();
    void reloadRoles();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  return {
    sessions: {
      data: sessions,
      loading: sessionsLoading,
      error: sessionsError,
      reload: reloadSessions,
    },
    users: {
      data: users,
      loading: usersLoading,
      error: usersError,
      reload: reloadUsers,
    },
    roles: {
      data: roles,
      loading: rolesLoading,
      error: rolesError,
      reload: reloadRoles,
    },
  };
}
