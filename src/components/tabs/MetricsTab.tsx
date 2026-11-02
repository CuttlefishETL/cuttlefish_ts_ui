import { useMemo, useState } from "react";
import type { Server } from "../../types";
import { buildBaseUrl } from "../../checkConnection";
import { createMetricsApi } from "../../features/metrics/api";
import { useMetrics } from "../../features/metrics/useMetrics";
import type { MetricItem } from "../../features/metrics/types";
import type { MetricCheckState } from "../../types";

function TriCheckbox({
  state,
  onChange,
  label,
  disabled,
}: {
  state: MetricCheckState;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  const isPartial = state === "indeterminate";
  const isChecked = state === "checked" || isPartial;

  return (
    <input
      type="checkbox"
      className={`metrics-check${isPartial ? " metrics-check--partial" : ""}`}
      checked={isChecked}
      onChange={onChange}
      aria-label={label}
      aria-checked={isPartial ? "mixed" : undefined}
      disabled={disabled}
    />
  );
}

interface Props {
  server: Server;
}

export function MetricsTab({ server }: Props) {
  const baseUrl = useMemo(() => {
    try {
      return buildBaseUrl(server.url, server.port);
    } catch {
      return "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.url, server.port]);

  const api = useMemo(
    () => (baseUrl ? createMetricsApi(baseUrl) : null),
    [baseUrl],
  );
  const {
    sections,
    stats,
    enabledPaths,
    loading,
    error,
    busyKeys,
    reloading,
    reload,
    reloadFromFile,
    toggleMetric,
    toggleSection,
  } = useMetrics(api);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const sectionNames = useMemo(
    () => Object.keys(sections).sort(),
    [sections],
  );

  const totalSections = sectionNames.length;

  const isExpanded = (sec: string) =>
    expanded.has(sec) || !collapsed.has(sec);

  const toggleExpanded = (sec: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(sec)) next.delete(sec);
      else next.add(sec);
      setExpanded((p) => {
        const np = new Set(p);
        np.add(sec);
        return np;
      });
      return next;
    });
  };

  const computeSectionState = (sec: string): MetricCheckState => {
    const list = sections[sec] ?? [];
    if (list.length === 0) return "unchecked";
    const on = list.filter((m) => m.enabled).length;
    if (on === 0) return "unchecked";
    if (on === list.length) return "checked";
    return "indeterminate";
  };

  const handleToggleSection = (sec: string) => {
    const state = computeSectionState(sec);
    const next = state !== "checked";
    void toggleSection(sec, next);
  };

  const handleToggleMetric = (m: MetricItem) => {
    void toggleMetric(m.path, !m.enabled);
  };

  const handleEnableAll = () => {
    for (const sec of sectionNames) {
      if (computeSectionState(sec) !== "checked") {
        void toggleSection(sec, true);
      }
    }
  };

  const handleDisableAll = () => {
    for (const sec of sectionNames) {
      if (computeSectionState(sec) !== "unchecked") {
        void toggleSection(sec, false);
      }
    }
  };

  const allEnabled =
    sectionNames.length > 0 &&
    sectionNames.every((s) => computeSectionState(s) === "checked");
  const noneEnabled = sectionNames.every(
    (s) => computeSectionState(s) === "unchecked",
  );

  if (!baseUrl) {
    return (
      <div className="metrics-tab">
        <div className="metrics-hint">
          Не удалось определить адрес сервера (проверьте URL и порт).
        </div>
      </div>
    );
  }

  return (
    <div className="metrics-tab">
      <div className="metrics-toolbar">
        <button
          type="button"
          className="btn"
          onClick={handleEnableAll}
          disabled={allEnabled || loading || sectionNames.length === 0}
        >
          Включить все
        </button>
        <button
          type="button"
          className="btn"
          onClick={handleDisableAll}
          disabled={noneEnabled || loading || sectionNames.length === 0}
        >
          Выключить все
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => void reloadFromFile()}
          disabled={loading || reloading}
          title="POST /api/metrics/reload — перечитать состояние из файла"
        >
          {reloading ? "Перезагрузка…" : "Перезагрузить"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => void reload()}
          disabled={loading}
        >
          Обновить
        </button>

        <span className="metrics-toolbar-spacer" />
        {stats && (
          <span className="metrics-stats">
            Всего: {stats.total} · Вкл: {stats.enabled} · Выкл:{" "}
            {stats.disabled}
          </span>
        )}
      </div>

      {loading && sectionNames.length === 0 && (
        <div className="metrics-hint">Загрузка метрик…</div>
      )}
      {!loading && error && sectionNames.length === 0 && (
        <div className="metrics-hint">
          {error}{" "}
          <button className="btn" onClick={() => void reload()}>
            Повторить
          </button>
        </div>
      )}
      {!loading && !error && sectionNames.length === 0 && (
        <div className="metrics-hint">Метрики не найдены</div>
      )}

      {!loading && error && sectionNames.length > 0 && (
        <div className="metrics-error-banner">{error}</div>
      )}

      {sectionNames.length > 0 && (
        <>
          <div className="metrics-header">
            <span className="metrics-header-name">Наименование</span>
            <span className="metrics-header-check">Использование</span>
          </div>
          <ul className="metrics-tree">
            {sectionNames.map((sec) => {
              const list = sections[sec] ?? [];
              const open = isExpanded(sec);
              const state = computeSectionState(sec);
              const sectionBusy = busyKeys.has(`section:${sec}`);
              return (
                <li key={sec} className="metrics-node">
                  <div className="metrics-row metrics-row--section">
                    <button
                      type="button"
                      className={`metrics-chevron${open ? " is-open" : ""}`}
                      onClick={() => toggleExpanded(sec)}
                      aria-label={open ? "Свернуть" : "Развернуть"}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        aria-hidden="true"
                      >
                        <path
                          d="M3 1 L7 5 L3 9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <span className="metrics-name metrics-name--section" title={sec}>
                      {sec}
                      <span className="metrics-count">{list.length}</span>
                    </span>
                    <span className="metrics-check-cell">
                      <TriCheckbox
                        state={state}
                        onChange={() => handleToggleSection(sec)}
                        label={`section ${sec}`}
                        disabled={sectionBusy}
                      />
                    </span>
                  </div>
                  {open && list.length > 0 && (
                    <ul className="metrics-subtree">
                      {list.map((m) => {
                        const busy = busyKeys.has(m.path);
                        return (
                          <li key={m.path} className="metrics-node">
                            <div
                              className="metrics-row"
                              style={{ paddingLeft: 8 + 32 }}
                              title={m.path}
                            >
                              <span
                                className="metrics-chevron metrics-chevron--placeholder"
                                aria-hidden="true"
                              />
                              <span className="metrics-name">
                                {m.path}
                                {m.metadata?.description && (
                                  <span className="metrics-description">
                                    {" "}
                                    — {m.metadata.description}
                                  </span>
                                )}
                              </span>
                              <span className="metrics-check-cell">
                                <TriCheckbox
                                  state={m.enabled ? "checked" : "unchecked"}
                                  onChange={() => handleToggleMetric(m)}
                                  label={m.path}
                                  disabled={busy}
                                />
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {enabledPaths.size === 0 && sectionNames.length > 0 && !loading && (
        <div className="metrics-footnote">
          Все метрики выключены — на сервере не собирается телеметрия.
        </div>
      )}
      {totalSections === 0 && !loading && !error && (
        <div className="metrics-footnote">Секций с метриками нет.</div>
      )}
    </div>
  );
}