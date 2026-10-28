import { useMemo, useState } from "react";
import type {
  MetricCheckState,
  MetricGroup,
  MetricNode,
} from "../../types";
import { METRIC_NAMES, DEFAULT_ENABLED_METRICS } from "../../data";
import {
  collectGroupIds,
  collectLeafIds,
  computeGroupState,
  isMetricGroup,
  parseMetrics,
  toggleGroupLeaves,
} from "../../metricsUtils";

function TriCheckbox({
  state,
  onChange,
  label,
}: {
  state: MetricCheckState;
  onChange: () => void;
  label: string;
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
    />
  );
}

export function MetricsTab() {
  const tree = useMemo(() => parseMetrics(METRIC_NAMES), []);
  const allLeafIds = useMemo(
    () => tree.flatMap(collectLeafIds),
    [tree],
  );

  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(DEFAULT_ENABLED_METRICS),
  );
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(collectGroupIds(tree)),
  );

  const allEnabled =
    allLeafIds.length > 0 && allLeafIds.every((id) => enabled.has(id));
  const noneEnabled = allLeafIds.every((id) => !enabled.has(id));

  const enableAll = () => {
    setEnabled(new Set(allLeafIds));
  };

  const disableAll = () => {
    setEnabled(new Set());
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLeaf = (id: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (group: MetricGroup) => {
    const { ids, turnOn } = toggleGroupLeaves(group, enabled);
    setEnabled((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (turnOn) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const renderNodes = (
    nodes: MetricNode[],
    depth: number,
  ): React.ReactNode =>
    nodes.map((node) => {
      if (isMetricGroup(node)) {
        const isOpen = expanded.has(node.id);
        const state = computeGroupState(node, enabled);
        return (
          <li key={node.id} className="metrics-node">
            <div
              className="metrics-row"
              style={{ paddingLeft: 8 + depth * 16 }}
            >
              <button
                type="button"
                className={`metrics-chevron${isOpen ? " is-open" : ""}`}
                onClick={() => toggleExpanded(node.id)}
                aria-label={isOpen ? "Свернуть" : "Развернуть"}
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
              <span className="metrics-name" title={node.id}>
                {node.name}
              </span>
              <span className="metrics-check-cell">
                <TriCheckbox
                  state={state}
                  onChange={() => toggleGroup(node)}
                  label={node.id}
                />
              </span>
            </div>
            {isOpen && node.children.length > 0 && (
              <ul className="metrics-subtree">
                {renderNodes(node.children, depth + 1)}
              </ul>
            )}
          </li>
        );
      }

      const checked = enabled.has(node.id);
      return (
        <li key={node.id} className="metrics-node">
          <div
            className="metrics-row"
            style={{ paddingLeft: 8 + depth * 16 }}
          >
            <span
              className="metrics-chevron metrics-chevron--placeholder"
              aria-hidden="true"
            />
            <span className="metrics-name" title={node.id}>
              {node.name}
            </span>
            <span className="metrics-check-cell">
              <TriCheckbox
                state={checked ? "checked" : "unchecked"}
                onChange={() => toggleLeaf(node.id)}
                label={node.id}
              />
            </span>
          </div>
        </li>
      );
    });

  return (
    <div className="metrics-tab">
      <div className="metrics-toolbar">
        <button
          type="button"
          className="btn"
          onClick={enableAll}
          disabled={allEnabled || allLeafIds.length === 0}
        >
          Включить все
        </button>
        <button
          type="button"
          className="btn"
          onClick={disableAll}
          disabled={noneEnabled}
        >
          Выключить все
        </button>
      </div>

      <div className="metrics-header">
        <span className="metrics-header-name">Наименование</span>
        <span className="metrics-header-check">Использование</span>
      </div>
      <ul className="metrics-tree">{renderNodes(tree, 0)}</ul>
    </div>
  );
}