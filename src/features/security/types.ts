export type SessionSource = "Admin" | "HTTP" | "Cron" | "Manual" | "Internal";

export interface ActiveSession {
  session_id: string;
  user_id: number;
  user_name: string;
  role: string;
  debug: boolean;
  source: SessionSource;
  created_at: string;
  last_used: string;
  is_current: boolean;
}

export interface UserRecord {
  id: number;
  username: string;
  role: string;
}

export interface RoleRecord {
  name: string;
  privilege: "Admin" | "Viewer" | null;
  allowed_resources: string[];
}

export interface RoleInput {
  name: string;
  allowed_resources: string[];
}

export interface UserCreateInput {
  username: string;
  password: string;
  role: string;
}

export interface UserUpdateInput {
  username?: string;
  role?: string;
}

export type Privilege = "Admin" | "Viewer" | null;

/** Полный каталог скупов: ресурс → список действий. */
export const RESOURCE_ACTIONS: Record<string, string[]> = {
  config: ["read", "write", "reload", "sync"],
  metrics: ["read", "write", "reload", "sync"],
  connectors: ["read", "write", "test", "manage", "reload"],
  plugins: ["read", "write"],
  cron: ["read", "write"],
  admin: ["run", "process"],
  session: ["manage"],
  audit: ["read"],
};

/** Порядок ресурсов в матрице. */
export const RESOURCE_ORDER: string[] = [
  "config",
  "metrics",
  "connectors",
  "plugins",
  "cron",
  "admin",
  "session",
  "audit",
];

/** Союз всех действий (для колонок матрицы). */
export const ALL_ACTIONS: string[] = [
  "read",
  "write",
  "test",
  "manage",
  "reload",
  "run",
  "process",
  "sync",
];

export function hasScope(resources: string[], resource: string, action: string): boolean {
  if (resources.includes("*")) return true;
  if (resources.includes("*:read") && action === "read") return true;
  return resources.includes(`${resource}:${action}`);
}

export function groupUsersByRole(users: UserRecord[]): {
  admin: UserRecord[];
  user: UserRecord[];
  viewer: UserRecord[];
  other: UserRecord[];
} {
  return {
    admin: users.filter((u) => u.role === "admin"),
    user: users.filter((u) => u.role === "user"),
    viewer: users.filter((u) => u.role === "viewer"),
    other: users.filter((u) => !["admin", "user", "viewer"].includes(u.role)),
  };
}

export function sourceIcon(s: SessionSource): string {
  switch (s) {
    case "Admin":
      return "🔑";
    case "HTTP":
      return "🌐";
    case "Cron":
      return "⏰";
    case "Manual":
      return "👆";
    case "Internal":
      return "⚙";
  }
}

export function shortSessionId(id: string): string {
  return id.length > 12 ? id.slice(0, 8) + "…" + id.slice(-4) : id;
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60) return `${sec} сек назад`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const d = Math.floor(hr / 24);
  return `${d} дн назад`;
}

export function formatRemaining(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "истёк";
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const d = Math.floor(hr / 24);
  if (d > 0) return `${d} д ${hr % 24} ч`;
  if (hr > 0) return `${hr} ч ${min % 60} мин`;
  if (min > 0) return `${min} мин`;
  return `${sec} сек`;
}

export interface RoleCreateInput {
  name: string;
  allowed_resources: string[];
}

export const RESERVED_ROLE_NAMES = ["admin", "viewer", "user"] as const;
export const ROLE_NAME_RE = /^[a-z][a-z0-9_-]{0,63}$/;

export function isReservedRole(name: string): boolean {
  return (RESERVED_ROLE_NAMES as readonly string[]).includes(name);
}

export function validateRoleName(name: string): string | null {
  if (!name) return "Имя обязательно";
  if (!ROLE_NAME_RE.test(name)) {
    return "Имя: строчные латинские буквы, цифры, _ и -, начинается с буквы, до 64 символов";
  }
  if (isReservedRole(name)) return "Это имя зарезервировано";
  return null;
}

