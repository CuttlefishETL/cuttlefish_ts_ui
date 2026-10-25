import { useEffect, useState } from "react";
import { stubDap, type DebugState } from "../../scriptStub";

export function DebugToolbar() {
  const [state, setState] = useState<DebugState>(stubDap.getState());

  useEffect(() => {
    return stubDap.subscribe(setState);
  }, []);

  const { status } = state;
  const running = status === "running";
  const paused = status === "paused";
  const active = running || paused;

  return (
    <div className="scripts-toolbar">
      <button
        type="button"
        className="toolbar-btn"
        onClick={() => stubDap.run()}
        disabled={active}
        title="Запустить скрипт"
      >
        ▶ Запуск
      </button>
      <button
        type="button"
        className="toolbar-btn danger"
        onClick={() => stubDap.stop()}
        disabled={!active}
        title="Остановить"
      >
        ■ Стоп
      </button>
      <button
        type="button"
        className="toolbar-btn"
        onClick={() => stubDap.pause()}
        disabled={!running}
        title="Пауза"
      >
        ⏸ Пауза
      </button>
      <button
        type="button"
        className="toolbar-btn"
        onClick={() => stubDap.continue()}
        disabled={!paused}
        title="Продолжить"
      >
        ⏵ Продолжить
      </button>

      <span className="scripts-toolbar-divider" />

      <button
        type="button"
        className="toolbar-btn"
        onClick={() => stubDap.stepOver()}
        disabled={!paused}
        title="Шаг с обходом (F10)"
      >
        ⤵ Шаг
      </button>
      <button
        type="button"
        className="toolbar-btn"
        onClick={() => stubDap.stepIn()}
        disabled={!paused}
        title="Шаг с входом (F11)"
      >
        ⤓ Вход
      </button>
      <button
        type="button"
        className="toolbar-btn"
        onClick={() => stubDap.stepOut()}
        disabled={!paused}
        title="Шаг с выходом (Shift+F11)"
      >
        ⤒ Выход
      </button>
      <button
        type="button"
        className="toolbar-btn"
        onClick={() => stubDap.restart()}
        disabled={!active}
        title="Перезапустить"
      >
        ⟳ Перезапуск
      </button>

      <span className="scripts-toolbar-status">
        {status === "idle" && "Не запущено"}
        {status === "running" && "Выполняется"}
        {status === "paused" && "Пауза"}
      </span>
    </div>
  );
}