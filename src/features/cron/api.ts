import type { AxiosError } from "axios";
import { createApiClient } from "../../api/http";
import type { CronEntry } from "./types";

const ADMIN_PREFIX = "/admin";
const CRON = `${ADMIN_PREFIX}/cron`;

function sectionsKey(baseUrl: string): string {
  return `cuttlefish.cron.sections.${baseUrl}`;
}

function normalizeError(err: unknown): Error {
  const ax = err as AxiosError<{ error?: string }>;
  if (ax?.isAxiosError) {
    const serverMsg = ax.response?.data?.error;
    return new Error(serverMsg ?? ax.message);
  }
  return err instanceof Error ? err : new Error(String(err));
}

function unwrapList(data: unknown): CronEntry[] {
  if (Array.isArray(data)) return data as CronEntry[];

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["cron_tasks", "tasks", "items", "data"]) {
      if (Array.isArray(obj[key])) return obj[key] as CronEntry[];
    }
    const values = Object.values(obj);
    if (
      values.length > 0 &&
      values.every(
        (v) =>
          v !== null &&
          typeof v === "object" &&
          "name" in (v as Record<string, unknown>) &&
          "schedule" in (v as Record<string, unknown>) &&
          "script" in (v as Record<string, unknown>),
      )
    ) {
      return values as CronEntry[];
    }
  }

  return [];
}

export function createCronApi(baseUrl: string) {
  const client = createApiClient(baseUrl);

  const call = async <T>(p: Promise<{ data: T }>): Promise<T> => {
    try {
      return (await p).data;
    } catch (e) {
      throw normalizeError(e);
    }
  };

  return {
    async list(signal?: AbortSignal): Promise<CronEntry[]> {
      const data = await call<unknown>(client.get(CRON, { signal }));
      return unwrapList(data);
    },

    create(input: CronEntry) {
      return call<CronEntry>(client.post(CRON, input));
    },

    update(oldName: string, input: CronEntry) {
      return call<CronEntry>(
        client.put(`${CRON}/${encodeURIComponent(oldName)}`, input),
      );
    },

    remove(name: string) {
      return call<{ success: boolean }>(
        client.delete(`${CRON}/${encodeURIComponent(name)}`),
      );
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