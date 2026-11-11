import { useState } from "react";
import { ScriptPickerDialog } from "../code/ScriptPickerDialog";
import { loadCodeTree } from "../code/api";
import type { CodeTreeNode } from "../code/types";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  /** baseUrl сервера. Если пустая строка — кнопка недоступна. */
  baseUrl: string;
}

export function ScriptParamField({ value, onChange, disabled, baseUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<CodeTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canClick = !disabled && baseUrl !== "" && !loading;

  const openPicker = async () => {
    if (!canClick) return;
    setError(null);

    // Уже загружено — открываем сразу, без запроса.
    if (tree.length > 0) {
      setOpen(true);
      return;
    }

    setLoading(true);
    try {
      const result = await loadCodeTree(baseUrl);
      setTree(result);
      setOpen(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const reload = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await loadCodeTree(baseUrl, { force: true });
      setTree(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const title = error
    ? `Ошибка: ${error}. Нажмите, чтобы повторить`
    : loading
      ? "Загрузка списка скриптов…"
      : baseUrl === ""
        ? "Сервер недоступен"
        : "Выбрать скрипт";

  return (
    <div className="props-script-field">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Имя скрипта"
        spellCheck={false}
        autoComplete="off"
      />
      <button
        type="button"
        className="btn props-script-btn"
        onClick={openPicker}
        disabled={!canClick}
        title={title}
        aria-label="Выбрать скрипт"
      >
        {loading ? "…" : "📜"}
      </button>

      {open && (
        <ScriptPickerDialog
          tree={tree}
          initialSelected={value || null}
          loading={loading}
          errorMessage={error ?? undefined}
          onReload={reload}
          onSelect={(path) => {
            onChange(path);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}