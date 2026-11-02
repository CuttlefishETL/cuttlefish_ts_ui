import type { AxiosError } from "axios";
import { createApiClient } from "../../api/http";
import type {
  MetricItem,
  MetricsAllResponse,
  MetricsSectionsResponse,
  MetricsStatsResponse,
} from "./types";

const METRICS = "/api/metrics";

function normalizeError(err: unknown): Error {
  const ax = err as AxiosError<{ error?: string; message?: string }>;
  if (ax?.isAxiosError) {
    const data = ax.response?.data;
    const msg = data?.error ?? data?.message;
    return new Error(msg ?? ax.message);
  }
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Приводит «сырой» элемент от сервера к `MetricItem`.
 * Сервер может отдавать `MetricWithState` в двух формах:
 *  - плоско: { path, enabled, section, ... }
 *  - вложенно: { path, enabled, metadata: { section, description, ... } }
 * Обе формы покрываем.
 */
function normalizeMetric(raw: unknown, fallbackSection: string): MetricItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const path =
    typeof o.path === "string"
      ? o.path
      : typeof o.name === "string"
        ? (o.name as string)
        : "";
  if (!path) return null;

  const meta =
    o.metadata && typeof o.metadata === "object"
      ? (o.metadata as Record<string, unknown>)
      : undefined;

  const sectionFromMeta =
    meta && typeof meta.section === "string" ? (meta.section as string) : "";
  const sectionFromRoot =
    typeof o.section === "string" ? (o.section as string) : "";
  const section = sectionFromRoot || sectionFromMeta || fallbackSection;

  const enabled =
    typeof o.enabled === "boolean"
      ? (o.enabled as boolean)
      : typeof o.state === "string"
        ? o.state === "enabled"
        : true;

  const item: MetricItem = {
    path,
    name:
      typeof o.name === "string"
        ? (o.name as string)
        : path.split(".").pop() ?? path,
    section,
    enabled,
    metadata: meta
      ? {
          description:
            typeof meta.description === "string" ? meta.description : undefined,
          type: typeof meta.type === "string" ? (meta.type as string) : undefined,
          section: sectionFromMeta || undefined,
          labels: Array.isArray(meta.labels)
            ? (meta.labels as string[])
            : undefined,
          buckets: Array.isArray(meta.buckets)
            ? (meta.buckets as number[])
            : undefined,
          default_enabled:
            typeof meta.default_enabled === "boolean"
              ? (meta.default_enabled as boolean)
              : undefined,
        }
      : undefined,
  };
  return item;
}

function unwrapSections(
  rawSections: unknown,
): Record<string, MetricItem[]> {
  const out: Record<string, MetricItem[]> = {};
  if (!rawSections || typeof rawSections !== "object") return out;

  for (const [section, list] of Object.entries(
    rawSections as Record<string, unknown>,
  )) {
    if (!Array.isArray(list)) continue;
    const items = list
      .map((x) => normalizeMetric(x, section))
      .filter((x): x is MetricItem => x !== null)
      .sort((a, b) => a.path.localeCompare(b.path));
    out[section] = items;
  }
  return out;
}

export function createMetricsApi(baseUrl: string) {
  const client = createApiClient(baseUrl);

  const call = async <T>(p: Promise<{ data: T }>): Promise<T> => {
    try {
      return (await p).data;
    } catch (e) {
      throw normalizeError(e);
    }
  };

  return {
    async getAll(signal?: AbortSignal): Promise<MetricsAllResponse> {
      const data = await call<{
        sections?: unknown;
        total?: number;
        version?: number | string;
      }>(client.get(METRICS, { signal }));

      const sections = unwrapSections(data.sections);
      const total =
        typeof data.total === "number"
          ? data.total
          : Object.values(sections).reduce((s, list) => s + list.length, 0);

      return {
        sections,
        total,
        version: data.version ?? "",
      };
    },

    async getSections(signal?: AbortSignal): Promise<MetricsSectionsResponse> {
      const data = await call<{
        sections?: unknown;
        stats?: { total?: number; enabled?: number; disabled?: number };
        version?: number | string;
      }>(client.get(`${METRICS}/sections`, { signal }));

      const sections = unwrapSections(data.sections);
      const stats = {
        total:
          data.stats?.total ??
          Object.values(sections).reduce((s, list) => s + list.length, 0),
        enabled:
          data.stats?.enabled ??
          Object.values(sections).reduce(
            (s, list) => s + list.filter((m) => m.enabled).length,
            0,
          ),
        disabled: data.stats?.disabled ?? 0,
      };
      if (!data.stats?.disabled) {
        stats.disabled = stats.total - stats.enabled;
      }

      return { sections, stats, version: data.version ?? "" };
    },

    async getStats(signal?: AbortSignal): Promise<MetricsStatsResponse> {
      const data = await call<MetricsStatsResponse & { version?: number | string }>(
        client.get(`${METRICS}/stats`, { signal }),
      );
      return {
        total: data.total ?? 0,
        enabled: data.enabled ?? 0,
        disabled: data.disabled ?? 0,
        by_section: data.by_section ?? {},
        version: data.version ?? "",
      };
    },

    async setMetric(path: string, enabled: boolean): Promise<void> {
      await call<unknown>(
        client.put(`${METRICS}/${encodeURIComponent(path)}`, { enabled }),
      );
    },

    async setSection(section: string, enabled: boolean): Promise<number> {
      const data = await call<{ changed?: number }>(
        client.put(
          `${METRICS}/section/${encodeURIComponent(section)}`,
          { enabled },
        ),
      );
      return typeof data?.changed === "number" ? data.changed : 0;
    },

    async reload(): Promise<void> {
      await call<unknown>(client.post(`${METRICS}/reload`));
    },
  };
}

export type MetricsApi = ReturnType<typeof createMetricsApi>;