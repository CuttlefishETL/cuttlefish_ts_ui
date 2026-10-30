import { useEffect, useRef, useState } from "react";

interface Props {
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => Promise<void> | void;
  onClose: () => void;
}

export function PromptDialog({
  title,
  label,
  initialValue = "",
  placeholder,
  validate,
  onSubmit,
  onClose,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    const err = validate
      ? validate(trimmed)
      : trimmed
        ? null
        : "Значение обязательно";
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(trimmed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <form onSubmit={submit}>
          <div className="field">
            <label>{label}</label>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              placeholder={placeholder}
              disabled={busy}
            />
            {error && <div className="field-error">{error}</div>}
          </div>
          <div className="modal-actions">
            <button className="btn primary" type="submit" disabled={busy}>
              OK
            </button>
            <button
              className="btn"
              type="button"
              onClick={onClose}
              disabled={busy}
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
