import { JSX, useState } from "react";
import { Splitter } from "./Splitter";
import {
  STUB_MESSAGES,
  STUB_STACK_FRAMES,
  STUB_VARIABLES,
  type OutputKind,
  type Variable,
} from "../../scriptStub";

const MESSAGE_COLOR: Record<OutputKind, string> = {
  log: "#333",
  info: "#396cd8",
  warn: "#c08000",
  error: "#b02020",
};

export function DebugPanels() {
  const [stackWidth, setStackWidth] = useState(200);
  const [messagesWidth, setMessagesWidth] = useState(280);

  return (
    <div className="debug-panels">
      <div className="debug-panel" style={{ width: stackWidth }}>
        <div className="debug-panel-header">Стек вызовов</div>
        <div className="debug-panel-body">
          {STUB_STACK_FRAMES.length === 0 && (
            <div className="debug-empty">Нет данных</div>
          )}
          {STUB_STACK_FRAMES.map((f, i) => (
            <div
              key={f.id}
              className={`stack-frame ${i === 0 ? "current" : ""}`}
              title={`${f.file}:${f.line}`}
            >
              <span className="stack-frame-name">{f.name}</span>
              <span className="stack-frame-loc">
                {f.file.split("/").pop()}:{f.line}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Splitter
        direction="vertical"
        onDelta={(d) =>
          setStackWidth((w) => Math.max(120, Math.min(500, w + d)))
        }
      />

      <div className="debug-panel" style={{ width: messagesWidth }}>
        <div className="debug-panel-header">Сообщения</div>
        <div className="debug-panel-body">
          {STUB_MESSAGES.length === 0 && (
            <div className="debug-empty">Нет сообщений</div>
          )}
          {STUB_MESSAGES.map((m) => (
            <div key={m.id} className="message-row">
              <span className="message-time">{m.time}</span>
              <span
                className="message-text"
                style={{ color: MESSAGE_COLOR[m.kind] }}
              >
                {m.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Splitter
        direction="vertical"
        onDelta={(d) =>
          setMessagesWidth((w) => Math.max(120, Math.min(600, w + d)))
        }
      />

      <div className="debug-panel" style={{ flex: 1 }}>
        <div className="debug-panel-header">Переменные</div>
        <div className="debug-panel-body">
          {STUB_VARIABLES.length === 0 && (
            <div className="debug-empty">Нет переменных</div>
          )}
          {renderVariables(STUB_VARIABLES)}
        </div>
      </div>
    </div>
  );
}

function renderVariables(vars: Variable[], depth = 0): JSX.Element[] {
  return vars.flatMap((v) => {
    const rows: JSX.Element[] = [
      <div
        key={`${depth}-${v.name}`}
        className="var-row"
        style={{ paddingLeft: depth * 12 }}
      >
        <span className="var-name">{v.name}</span>
        <span className="var-value">{v.value}</span>
        <span className="var-type">{v.type}</span>
      </div>,
    ];
    if (v.children && v.children.length > 0) {
      rows.push(...renderVariables(v.children, depth + 1));
    }
    return rows;
  });
}