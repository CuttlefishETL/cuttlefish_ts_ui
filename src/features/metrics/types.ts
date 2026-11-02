import type { MetricCheckState, MetricGroup, MetricNode } from "../../types";

export type { MetricCheckState, MetricGroup, MetricNode };

/**
 * Один элемент из `Vec<MetricWithState>` в ответе
 * `GET /api/metrics` и `GET /api/metrics/sections`.
 *
 * Сервер (`metrics::store::MetricWithState`) отдаёт минимум
 * `path` + `enabled`; остальное зависит от версии — поля опциональны,
 * `normalize` приводит ответ к стабильному виду.
 */
export interface MetricItem {
  path: string;
  /** Краткое имя (последний сегмент пути), если сервер его отдаёт. */
  name?: string;
  section: string;
  enabled: boolean;
  metadata?: {
    description?: string | null;
    type?: string | null;
    section?: string | null;
    labels?: string[] | null;
    buckets?: number[] | null;
    default_enabled?: boolean | null;
  };
}

/** Ответ `GET /api/metrics`. */
export interface MetricsAllResponse {
  sections: Record<string, MetricItem[]>;
  total: number;
  version: number | string;
}

/** Ответ `GET /api/metrics/sections`. */
export interface MetricsSectionsResponse {
  sections: Record<string, MetricItem[]>;
  stats: {
    total: number;
    enabled: number;
    disabled: number;
  };
  version: number | string;
}

/** Ответ `GET /api/metrics/stats`. */
export interface MetricsStatsResponse {
  total: number;
  enabled: number;
  disabled: number;
  by_section: Record<string, { total: number; enabled: number; disabled: number }>;
  version: number | string;
}