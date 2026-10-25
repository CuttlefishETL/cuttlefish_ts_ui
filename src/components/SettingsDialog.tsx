import { useEffect, useState } from "react";
import {
  MAX_HEALTH_INTERVAL,
  MIN_HEALTH_INTERVAL,
  type AppSettings,
} from "../appSettings";

interface SettingsDialogProps {
  open: boolean;
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
}

export function SettingsDialog({
  open,
  settings,
  onSave,
  onClose,
}: SettingsDialogProps) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setError("");
    }
  }, [open, settings]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(draft.healthPollIntervalSec);
    if (
      !Number.isFinite(n) ||
      n < MIN_HEALTH_INTERVAL ||
      n > MAX_HEALTH_INTERVAL
    ) {
      setError(
        `Период опроса должен быть от ${MIN_HEALTH_INTERVAL} до ${MAX_HEALTH_INTERVAL} секунд`
      );
      return;
    }
    onSave({ ...draft, healthPollIntervalSec: Math.floor(n) });
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal app-settings-modal"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>Настройка программы</h3>

        <div className="app-settings-body">
          <label className="app-settings-checkbox">
            <input
              type="checkbox"
              checked={draft.autoSendScriptOnRun}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  autoSendScriptOnRun: e.target.checked,
                })
              }
            />
            <span>
              Автоматически отправлять скрипт на сервер при запуске
            </span>
          </label>

          <div className="field">
            <label htmlFor="health-interval">
              Период опроса health серверов (сек)
            </label>
            <input
              id="health-interval"
              type="number"
              min={MIN_HEALTH_INTERVAL}
              max={MAX_HEALTH_INTERVAL}
              step={1}
              value={draft.healthPollIntervalSec}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  healthPollIntervalSec: Number(e.target.value) || 0,
                })
              }
            />
          </div>

          {error && <div className="check-result err">{error}</div>}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn primary">
            Сохранить
          </button>
        </div>
      </form>
    </div>
  );
}