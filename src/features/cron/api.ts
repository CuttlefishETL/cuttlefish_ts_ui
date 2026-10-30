import type { CodeTreeNode, CronEntry } from "./types";

const TOKEN_KEY = "cuttlefish.token";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function sectionsKey(baseUrl: string): string {
  return `cuttlefish.cron.sections.${baseUrl}`;
}

export function createCronApi(baseUrl: string) {
  const json = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const msg = (data as { error?: string })?.error ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data as T;
  };

  return {
    list(signal?: AbortSignal) {
      return json<CronEntry[]>("/admin/cron", { signal });
    },
    create(input: CronEntry) {
      return json<CronEntry>("/admin/cron", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    update(oldName: string, input: CronEntry) {
      return json<CronEntry>(`/admin/cron/${encodeURIComponent(oldName)}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
    },
    remove(name: string) {
      return json<void>(`/admin/cron/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
    },
    listScripts(signal?: AbortSignal) {
      return json<CodeTreeNode[]>("/admin/code/all", { signal });
    },
    async listSections(): Promise<string[]> {
      const raw = localStorage.getItem(sectionsKey(baseUrl));
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed)
          ? parsed.filter((x) => typeof x === "string")
          : [];
      } catch {
        return [];
      }
    },
    async saveSections(paths: string[]): Promise<void> {
      localStorage.setItem(sectionsKey(baseUrl), JSON.stringify(paths));
    },
  };
}

export type CronApi = ReturnType<typeof createCronApi>;