import type { SecurityApi } from "./api";
import type {
  ActiveSession,
  RoleRecord,
  UserRecord,
} from "./types";
import { isReservedRole, validateRoleName } from "./types";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const SESSIONS_SEED: Array<
  Omit<ActiveSession, "last_used" | "created_at"> & {
    offsetMs: number;
    createdAtMs: number;
  }
> = [
  {
    session_id: "a3f2b1c8-4d5e-4f7a-9b2c-1e3d4f5a6b7c",
    user_name: "admin",
    role: "admin",
    debug: false,
    source: "Admin",
    is_current: true,
    offsetMs: 30_000,
    createdAtMs: 3600_000,
  },
  {
    session_id: "9b81c2d7-3e4f-5a6b-7c8d-9e0f1a2b3c4d",
    user_name: "operator",
    role: "user",
    debug: false,
    source: "HTTP",
    is_current: false,
    offsetMs: 120_000,
    createdAtMs: 7200_000,
  },
  {
    session_id: "4c10d3e5-6a7b-8c9d-0e1f-2a3b4c5d6e7f",
    user_name: "integration",
    role: "user",
    debug: true,
    source: "Manual",
    is_current: false,
    offsetMs: 900_000,
    createdAtMs: 3_600_000 * 24,
  },
  {
    session_id: "7e2da8b1-9c0d-1e2f-3a4b-5c6d7e8f9a0b",
    user_name: "auditor",
    role: "viewer",
    debug: false,
    source: "HTTP",
    is_current: false,
    offsetMs: 300_000,
    createdAtMs: 18_000_000,
  },
];

const USERS_SEED: UserRecord[] = [
  { username: "admin", role: "admin" },
  { username: "operator", role: "user" },
  { username: "integration", role: "user" },
  { username: "auditor", role: "viewer" },
];

const ROLES_SEED: RoleRecord[] = [
  {
    name: "admin",
    privilege: "admin",
    allowed_resources: ["*"],
    max_connections: 10,
    uses: 0,
    users: 1,
  },
  {
    name: "viewer",
    privilege: "viewer",
    allowed_resources: ["*:read"],
    max_connections: 2,
    uses: 0,
    users: 1,
  },
  {
    name: "user",
    privilege: null,
    allowed_resources: [
      "config:read",
      "metrics:read",
      "connectors:read",
      "connectors:test",
      "plugins:read",
      "cron:read",
      "admin:run",
      "admin:process",
      "session:manage",
      "audit:read",
    ],
    max_connections: 5,
    uses: 100,
    users: 2,
  },
];

interface MockState {
  sessions: ActiveSession[];
  users: UserRecord[];
  roles: RoleRecord[];
}

function buildSessions(): ActiveSession[] {
  const now = Date.now();
  return SESSIONS_SEED.map((s) => ({
    session_id: s.session_id,
    user_name: s.user_name,
    role: s.role,
    debug: s.debug,
    source: s.source,
    is_current: s.is_current,
    created_at: new Date(now - s.createdAtMs).toISOString(),
    last_used: new Date(now - s.offsetMs).toISOString(),
  }));
}

function recomputeRoleUserCounts(state: MockState) {
  const counts = new Map<string, number>();
  for (const u of state.users) {
    counts.set(u.role, (counts.get(u.role) ?? 0) + 1);
  }
  for (const r of state.roles) {
    r.users = counts.get(r.name) ?? 0;
  }
}

export function createMockSecurityApi(): SecurityApi {
  const state: MockState = {
    sessions: buildSessions(),
    users: USERS_SEED.map((u) => ({ ...u })),
    roles: ROLES_SEED.map((r) => ({
      ...r,
      allowed_resources: [...r.allowed_resources],
    })),
  };
  recomputeRoleUserCounts(state);

  return {
    // ---------- SESSIONS ----------
    async listSessions() {
      await delay(180);
      state.sessions = state.sessions.map((s) => ({
        ...s,
        last_used: new Date(
          new Date(s.created_at).getTime() +
            Math.min(
              Date.now() - new Date(s.created_at).getTime() - 1000,
              Math.random() * 60_000,
            ),
        ).toISOString(),
      }));
      return state.sessions.map((s) => ({ ...s }));
    },

    async deleteSession(sessionId: string) {
      await delay(250);
      const idx = state.sessions.findIndex(
        (s) => s.session_id === sessionId,
      );
      if (idx < 0) throw new Error("Сессия не найдена");
      if (state.sessions[idx].is_current) {
        throw new Error("Нельзя завершить собственную сессию");
      }
      state.sessions.splice(idx, 1);
    },

    async deleteUserSessions(username: string) {
      await delay(250);
      const before = state.sessions.length;
      state.sessions = state.sessions.filter(
        (s) => s.user_name !== username || s.is_current,
      );
      if (state.sessions.length === before) {
        throw new Error("Нет сессий для завершения");
      }
    },

    // ---------- USERS ----------
    async listUsers() {
      await delay(180);
      return state.users.map((u) => ({ ...u }));
    },

    async createUser(input) {
      await delay(280);
      if (!input.username.trim()) throw new Error("Имя обязательно");
      if (state.users.some((u) => u.username === input.username)) {
        throw new Error("Пользователь с таким именем уже существует");
      }
      if (!input.password) throw new Error("Пароль обязателен");
      if (!state.roles.some((r) => r.name === input.role)) {
        throw new Error("Роль не существует");
      }
      const u: UserRecord = {
        username: input.username.trim(),
        role: input.role,
      };
      state.users.push(u);
      recomputeRoleUserCounts(state);
      return { ...u };
    },

    async updateUser(oldUsername, input) {
      await delay(250);
      const user = state.users.find((u) => u.username === oldUsername);
      if (!user) throw new Error("Пользователь не найден");
      if (
        user.username === "admin" &&
        input.role &&
        input.role !== "admin"
      ) {
        throw new Error("Нельзя изменить роль пользователя admin");
      }
      if (
        input.username &&
        input.username !== user.username &&
        state.users.some((u) => u.username === input.username)
      ) {
        throw new Error("Пользователь с таким именем уже существует");
      }
      if (input.role && !state.roles.some((r) => r.name === input.role)) {
        throw new Error("Роль не существует");
      }
      if (input.username) user.username = input.username.trim();
      if (input.role) user.role = input.role;
      recomputeRoleUserCounts(state);
      return { ...user };
    },

    async changePassword(username, password) {
      await delay(250);
      if (!state.users.some((u) => u.username === username)) {
        throw new Error("Пользователь не найден");
      }
      if (!password) throw new Error("Пароль обязателен");
      // в моке пароль не хранится
    },

    async deleteUser(username) {
      await delay(250);
      const idx = state.users.findIndex((u) => u.username === username);
      if (idx < 0) throw new Error("Пользователь не найден");
      if (state.users[idx].username === "admin") {
        throw new Error("Нельзя удалить пользователя admin");
      }
      if (state.sessions.some((s) => s.user_name === username)) {
        throw new Error("Нельзя удалить пользователя с активными сессиями");
      }
      state.users.splice(idx, 1);
      recomputeRoleUserCounts(state);
    },

    // ---------- ROLES ----------
    async listRoles() {
      await delay(180);
      return state.roles.map((r) => ({
        ...r,
        allowed_resources: [...r.allowed_resources],
      }));
    },

    async createRole(input) {
      await delay(280);
      const err = validateRoleName(input.name);
      if (err) throw new Error(err);
      if (state.roles.some((r) => r.name === input.name)) {
        throw new Error("Роль с таким именем уже существует");
      }
      const role: RoleRecord = {
        name: input.name,
        privilege: null,
        allowed_resources: [...input.allowed_resources],
        max_connections: 0,
        uses: 0,
        users: 0,
      };
      state.roles.push(role);
      recomputeRoleUserCounts(state);
      return { ...role, allowed_resources: [...role.allowed_resources] };
    },

    async updateRole(name, input) {
      await delay(280);
      const role = state.roles.find((r) => r.name === name);
      if (!role) throw new Error("Роль не найдена");
      if (role.privilege !== null) {
        throw new Error("Встроенную роль нельзя изменить");
      }
      role.allowed_resources = [...input.allowed_resources];
      return { ...role, allowed_resources: [...role.allowed_resources] };
    },

    async deleteRole(name) {
      await delay(250);
      const idx = state.roles.findIndex((r) => r.name === name);
      if (idx < 0) throw new Error("Роль не найдена");
      const role = state.roles[idx];
      if (role.privilege !== null) {
        throw new Error("Встроенную роль нельзя удалить");
      }
      if (isReservedRole(name)) {
        throw new Error(`Роль «${name}» зарезервирована`);
      }
      if (role.users > 0) {
        throw new Error(
          `Роль используется ${role.users} пользовател${
            role.users === 1 ? "ем" : "ями"
          }. Сначала измените их роль.`,
        );
      }
      state.roles.splice(idx, 1);
    },
  };
}