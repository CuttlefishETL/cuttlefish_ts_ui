import type { AxiosError } from "axios";
import { createApiClient } from "../../api/http";
import type {
  ConfigDataType,
  ConfigParam,
  ConfigSections,
  ParamMeta,
} from "./types";

const PREFIX = "/api";

function normalizeError(err: unknown): Error {
  const ax = err as AxiosError<{ error?: string }>;
  if (ax?.isAxiosError) {
    return new Error(ax.response?.data?.error ?? ax.message);
  }
  return err instanceof Error ? err : new Error(String(err));
}

function normalizeDataType(v: unknown): ConfigDataType {
  if (typeof v !== "string") return "string";
  const l = v.toLowerCase();
  if (
    l === "string" ||
    l === "number" ||
    l === "boolean" ||
    l === "choice" ||
    l === "date" ||
    l === "duration" ||
    l === "json"
  ) {
    return l;
  }
  // неизвестный тип — не падаем, рендерим как строку
  return "string";
}

function normalizeMeta(raw: unknown): ParamMeta {
  const fallback: ParamMeta = {
    type: "string",
    required: false,
    order: 0,
    read_only: false,
    restart_required: false,
  };
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  return {
    description: typeof o.description === "string" ? o.description : null,
    // Основное поле — `type` (сервер шлёт именно его).
    // `data_type` — на случай будущих изменений контракта.
    type: normalizeDataType(o.type ?? o.data_type),
    required: o.required === true,
    default: o.default,
    choices: Array.isArray(o.choices) ? o.choices : null,
    min: typeof o.min === "number" ? o.min : null,
    max: typeof o.max === "number" ? o.max : null,
    pattern: typeof o.pattern === "string" ? o.pattern : null,
    format: typeof o.format === "string" ? o.format : null,
    order: typeof o.order === "number" ? o.order : 0,
    section: typeof o.section === "string" ? o.section : null,
    read_only: o.read_only === true,
    restart_required: o.restart_required === true,
  };
}

function normalizeParam(raw: unknown): ConfigParam | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const path = typeof o.path === "string" ? o.path : "";
  if (!path) return null;
  return {
    path,
    meta: normalizeMeta(o.meta),
    value: o.value,
    pending_restart: o.pending_restart === true,
  };
}

export function createConfigApi(baseUrl: string) {
  const client = createApiClient(baseUrl);

  return {
    async getSections(signal?: AbortSignal): Promise<ConfigSections> {
      try {
        const res = await client.get<unknown>(`${PREFIX}/metadata/sections`, {
          signal,
        });
        const raw = res.data;
        const out: ConfigSections = {};
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          for (const [section, list] of Object.entries(
            raw as Record<string, unknown>,
          )) {
            if (!Array.isArray(list)) continue;
            out[section] = list
              .map(normalizeParam)
              .filter((x): x is ConfigParam => x !== null)
              .sort((a, b) => a.meta.order - b.meta.order);
          }
        }
        return out;
      } catch (e) {
        throw normalizeError(e);
      }
    },

    async updateParam(
      path: string,
      value: unknown,
    ): Promise<{
      success: boolean;
      message?: string;
      restart_required: boolean;
      pending_restart: boolean;
      warning?: string;
    }> {
      try {
        const res = await client.put<{
          success: boolean;
          message?: string;
          restart_required: boolean;
          pending_restart: boolean;
          warning?: string;
        }>(`${PREFIX}/config/${encodeURIComponent(path)}`, value);
        return res.data;
      } catch (e) {
        throw normalizeError(e);
      }
    },

    async reload(): Promise<void> {
      try {
        await client.post(`${PREFIX}/reload`);
      } catch (e) {
        throw normalizeError(e);
      }
    },
  };
}

export type ConfigApi = ReturnType<typeof createConfigApi>;