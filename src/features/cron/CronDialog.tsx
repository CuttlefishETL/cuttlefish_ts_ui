import { useState } from "react";
import type { CodeTreeNode, CronEntry } from "./types";
import { isValidSchedule } from "./types";
import { ScriptPickerDialog } from "./ScriptPickerDialog";

interface Props {
  initialValue: CronEntry | null;
  /** Режим «создание» — даже если initialValue задан (для Copy). */
  isNew: boolean;
  scripts: CodeTreeNode[];
  onSubmit: (entry: CronEntry, originalName: string | null) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

export function CronDialog({
  initialValue,
  isNew,
  scripts,
  onSubmit,
  onCancel,
  saving,
}: Props) {
  const [name, setName] = useState(initialValue?.name ?? "");
  const [schedule, setSchedule] = useState(initialValue?.schedule ?? "0 0 0 * * *");
  const [script, setScript] = useState(initialValue?.script ?? "");
  const [uid, setUid] = useState(initialValue?.uid ?? "");
  const [section, setSection] = useState(initialValue?.section ?? "");
  const [enabled, setEnabled] = useState(initialValue?.enabled ?? true);
  const [description, setDescription] = useState(initialValue?.description ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!name.trim()) return setLocalError("Имя обязательно");
    if (name.length > 128) return setLocalError("Имя не должно превышать 128 символов");
    if (!schedule.trim()) return setLocalError("Расписание обязательно");
    if (!isValidSchedule(schedule))
      return setLocalError("Расписание должно содержать 6 полей");
    if (!script.trim()) return setLocalError("Скрипт обязателен");
    if (!uid.trim()) return setLocalError("Владелец обязателен");
    if (!section.trim()) return setLocalError("Секция обязательна");
    if (section.length > 128)
      return setLocalError("Секция не должна превышать 128 символов");
    if (description.length > 512)
      return setLocalError("Описание не должно превышать 512 символов");

    const entry: CronEntry = {
      name: name.trim(),
      schedule: schedule.trim(),
      script: script.trim(),
      uid: uid.trim(),
      section: section.trim(),
      enabled,
      description: description.trim() || undefined,
    };

    const originalName = isNew ? null : initialValue?.name ?? null;
    await onSubmit(entry, originalName);
  };

  return (
    <>
      <div className="modal-backdrop" onClick={saving ? undefined : onCancel}>
        <div
          className="modal cron-dialog"
          onClick={(e) => e.stopPropagation()}
        >
          <h3>{isNew ? "Новая задача" : `Задача «${initialValue?.name}»`}</h3>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>
                Имя <span className="req">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                maxLength={128}
                autoFocus
              />
            </div>

            <div className="field">
              <label>
                Расписание <span className="req">*</span>
              </label>
              <input
                type="text"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                disabled={saving}
                placeholder="сек мин час день мес день_нед"
                className="mono"
              />
              <span className="field-hint">
                Пример: «0 0 6 * * *» — каждый день в 06:00
              </span>
            </div>

            <div className="field">
              <label>
                Скрипт <span className="req">*</span>
              </label>
              <div className="field-with-button">
                <input
                  type="text"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  disabled={saving}
                  placeholder="report.lua"
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPickerOpen(true)}
                  disabled={saving}
                >
                  …
                </button>
              </div>
            </div>

            <div className="field">
              <label>
                Владелец <span className="req">*</span>
              </label>
              <input
                type="text"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="field">
              <label>
                Секция <span className="req">*</span>
              </label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                disabled={saving}
                maxLength={128}
                placeholder="stats, maintenance, …"
              />
            </div>

            <div className="checkbox-field">
              <input
                id="cron-enabled"
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                disabled={saving}
              />
              <label htmlFor="cron-enabled">Включена</label>
            </div>

            <div className="field">
              <label>Описание</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
                maxLength={512}
                rows={3}
              />
              <span className="field-hint">{description.length} / 512</span>
            </div>

            {localError && <div className="cron-error">{localError}</div>}

            <div className="modal-actions">
              <button className="btn primary" type="submit" disabled={saving}>
                Сохранить
              </button>
              <button
                className="btn"
                type="button"
                onClick={onCancel}
                disabled={saving}
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      </div>

      {pickerOpen && (
        <ScriptPickerDialog
          tree={scripts}
          onSelect={(path) => {
            setScript(path);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}