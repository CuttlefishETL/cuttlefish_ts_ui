import type { AxiosError } from "axios";
import { createApiClient } from "../../api/http";
import type {
  ActiveSession,
  RoleCreateInput,
  RoleInput,
  RoleRecord,
  SessionSource,
  UserCreateInput,
  UserRecord,
  UserUpdateInput,
} from "./types";

// =============================================================================
// ИНТЕРФЕЙС
// =============================================================================

export interface SecurityApi {
  listSessions(signal?: AbortSignal): Promise<ActiveSession[]>;
  deleteSession(sessionId: string): Promise<void>;
  deleteUserSessions(username: string): Promise<void>;

  listUsers(signal?: AbortSignal): Promise<UserRecord[]>;
  createUser(input: UserCreateInput): Promise<UserRecord>;
  updateUser(oldUsername: string, input: UserUpdateInput): Promise<UserRecord>;
  changePassword(username: string, password: string): Promise<void>;
  deleteUser(username: string): Promise<void>;

  listRoles(signal?: AbortSignal): Promise<RoleRecord[]>;
  createRole(input: RoleCreateInput): Promise<RoleRecord>;
  updateRole(name: string, input: RoleInput): Promise<RoleRecord>;
  deleteRole(name: string): Promise<void>;
}

// =============================================================================
// УТИЛИТЫ
// =============================================================================

const ADMIN = "/admin";

/** Ошибка с сохранённым HTTP-статусом — нужен, чтобы отличать 404. */
type ApiError = Error & { status?: number };

function normalizeError(err: unknown): ApiError {
  const ax = err as AxiosError<{ error?: string }>;
  if (ax?.isAxiosError) {
    const e: ApiError = new Error(
      ax.response?.data?.error ?? ax.message,
    );
    e.status = ax.response?.status;
    return e;
  }
  return err instanceof Error ? err : new Error(String(err));
}

function isNotFound(e: unknown): boolean {
  return (e as ApiError)?.status === 404;
}

function normalizePrivilege(v: unknown): "admin" | "viewer" | null {
  if (typeof v !== "string") return null;
  const l = v.toLowerCase();
  if (l === "admin") return "admin";
  if (l === "viewer") return "viewer";
  return null;
}

function normalizeRole(raw: unknown): RoleRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== "string") return null;
  return {
    name: o.name,
    allowed_resources: Array.isArray(o.allowed_resources)
      ? (o.allowed_resources as unknown[]).filter(
          (x): x is string => typeof x === "string",
        )
      : [],
    max_connections:
      typeof o.max_connections === "number" ? o.max_connections : 0,
    uses: typeof o.uses === "number" ? o.uses : 0,
    users: typeof o.users === "number" ? o.users : 0,
    privilege: normalizePrivilege(o.privilege),
  };
}

function normalizeUser(raw: unknown): UserRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.username !== "string") return null;
  return {
    username: o.username,
    role: typeof o.role === "string" ? o.role : "",
  };
}

function unwrapUsers(data: unknown): UserRecord[] {
  if (Array.isArray(data)) {
    return data
      .map(normalizeUser)
      .filter((x): x is UserRecord => x !== null);
  }
  if (data && typeof data === "object") {
    const list = (data as Record<string, unknown>).users;
    if (Array.isArray(list)) {
      return list
        .map(normalizeUser)
        .filter((x): x is UserRecord => x !== null);
    }
  }
  return [];
}

function unwrapRoles(data: unknown): RoleRecord[] {
  if (Array.isArray(data)) {
    return data
      .map(normalizeRole)
      .filter((x): x is RoleRecord => x !== null);
  }
  if (data && typeof data === "object") {
    const list = (data as Record<string, unknown>).roles;
    if (Array.isArray(list)) {
      return list
        .map(normalizeRole)
        .filter((x): x is RoleRecord => x !== null);
    }
  }
  return [];
}

function toSessionSource(v: unknown): SessionSource {
  if (typeof v !== "string") return "Internal";
  switch (v) {
    case "Admin":
    case "HTTP":
    case "Cron":
    case "Manual":
    case "Internal":
      return v;
    default:
      return "Internal";
  }
}

/**
 * Толерантен к форме ответа: `session_id` или `id`, `user_name` или
 * `username`; отсутствие `created_at`/`last_used`/`source`/`debug`/`is_current`
 * заполняется разумными дефолтами.
 */
function normalizeSession(raw: unknown): ActiveSession | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const sessionId =
    typeof o.session_id === "string"
      ? o.session_id
      : typeof o.id === "string"
        ? (o.id as string)
        : null;
  if (!sessionId) return null;

  const userName =
    typeof o.user_name === "string"
      ? o.user_name
      : typeof o.username === "string"
        ? (o.username as string)
        : "";

  const nowIso = new Date().toISOString();

  return {
    session_id: sessionId,
    user_name: userName,
    role: typeof o.role === "string" ? o.role : "",
    debug: o.debug === true,
    source: toSessionSource(o.source),
    created_at: typeof o.created_at === "string" ? o.created_at : nowIso,
    last_used: typeof o.last_used === "string" ? o.last_used : nowIso,
    is_current: o.is_current === true,
  };
}

function unwrapSessions(data: unknown): ActiveSession[] {
  if (Array.isArray(data)) {
    return data
      .map(normalizeSession)
      .filter((x): x is ActiveSession => x !== null);
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["sessions", "items", "data"]) {
      if (Array.isArray(o[key])) {
        return (o[key] as unknown[])
          .map(normalizeSession)
          .filter((x): x is ActiveSession => x !== null);
      }
    }
  }
  return [];
}

// =============================================================================
// РЕАЛИЗАЦИЯ
// =============================================================================

export function createSecurityApi(baseUrl: string): SecurityApi {
  const client = createApiClient(baseUrl);

  const call = async <T>(p: Promise<{ data: T }>): Promise<T> => {
    try {
      return (await p).data;
    } catch (e) {
      throw normalizeError(e);
    }
  };

  return {
    // ---------- SESSIONS ----------
    async listSessions(signal?: AbortSignal): Promise<ActiveSession[]> {
      try {
        const data = await call<unknown>(
          client.get(`${ADMIN}/sessions`, { signal }),
        );
        return unwrapSessions(data);
      } catch (e) {
        // Эндпоинт ещё не реализован — тихо возвращаем пусто.
        if (isNotFound(e)) return [];
        // AbortError — пробрасываем, чтобы useSecurity не превращал
        // отмену в ошибку.
        if ((e as Error).name === "AbortError") throw e;
        throw e;
      }
    },

    async deleteSession(sessionId: string): Promise<void> {
      try {
        await call<unknown>(
          client.delete(
            `${ADMIN}/sessions/${encodeURIComponent(sessionId)}`,
          ),
        );
      } catch (e) {
        if (isNotFound(e)) {
          throw new Error(
            "Управление сессиями не реализовано на этом сервере",
          );
        }
        throw e;
      }
    },

    async deleteUserSessions(username: string): Promise<void> {
      try {
        await call<unknown>(
          client.delete(
            `${ADMIN}/sessions/user/${encodeURIComponent(username)}`,
          ),
        );
      } catch (e) {
        if (isNotFound(e)) {
          throw new Error(
            "Управление сессиями не реализовано на этом сервере",
          );
        }
        throw e;
      }
    },

    // ---------- USERS ----------
    async listUsers(signal?: AbortSignal): Promise<UserRecord[]> {
      const data = await call<unknown>(
        client.get(`${ADMIN}/users`, { signal }),
      );
      return unwrapUsers(data);
    },

    async createUser(input: UserCreateInput): Promise<UserRecord> {
      const data = await call<unknown>(
        client.post(`${ADMIN}/users`, {
          username: input.username,
          password: input.password,
          role: input.role,
        }),
      );
      const user = normalizeUser(data);
      if (!user) throw new Error("Сервер вернул некорректный ответ");
      return user;
    },

    async updateUser(
      oldUsername: string,
      input: UserUpdateInput,
    ): Promise<UserRecord> {
      // `UpdateUserReq` на сервере: `{ username?, role? }` — отсутствующие
      // поля означают «не менять».
      const body: Record<string, unknown> = {};
      if (input.username !== undefined) body.username = input.username;
      if (input.role !== undefined) body.role = input.role;

      const data = await call<unknown>(
        client.put(
          `${ADMIN}/users/${encodeURIComponent(oldUsername)}`,
          body,
        ),
      );
      const user = normalizeUser(data);
      if (!user) throw new Error("Сервер вернул некорректный ответ");
      return user;
    },

    async changePassword(
      username: string,
      password: string,
    ): Promise<void> {
      await call<unknown>(
        client.put(
          `${ADMIN}/users/${encodeURIComponent(username)}/password`,
          { password },
        ),
      );
    },

    async deleteUser(username: string): Promise<void> {
      await call<unknown>(
        client.delete(`${ADMIN}/users/${encodeURIComponent(username)}`),
      );
    },

    // ---------- ROLES ----------
    async listRoles(signal?: AbortSignal): Promise<RoleRecord[]> {
      const data = await call<unknown>(
        client.get(`${ADMIN}/roles`, { signal }),
      );
      return unwrapRoles(data);
    },

    async createRole(input: RoleCreateInput): Promise<RoleRecord> {
      const data = await call<unknown>(
        client.post(`${ADMIN}/roles`, {
          name: input.name,
          allowed_resources: input.allowed_resources,
        }),
      );
      const role = normalizeRole(data);
      if (!role) throw new Error("Сервер вернул некорректный ответ");
      return role;
    },

    async updateRole(
      name: string,
      input: RoleInput,
    ): Promise<RoleRecord> {
      // `UpdateRoleReq` НЕ содержит `name` — переименование запрещено.
      // Отправляем только `allowed_resources`; `max_connections` и `uses`
      // сервер оставит как есть (у них `#[serde(default)] Option<...>`).
      const data = await call<unknown>(
        client.put(
          `${ADMIN}/roles/${encodeURIComponent(name)}`,
          { allowed_resources: input.allowed_resources },
        ),
      );
      const role = normalizeRole(data);
      if (!role) throw new Error("Сервер вернул некорректный ответ");
      return role;
    },

    async deleteRole(name: string): Promise<void> {
      await call<unknown>(
        client.delete(`${ADMIN}/roles/${encodeURIComponent(name)}`),
      );
    },
  };
}