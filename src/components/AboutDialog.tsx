import { useEffect } from "react";

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal about-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3>Cuttlefish-UI</h3>
        <div className="about-content">
          <div className="about-row">
            <span className="about-key">Версия:</span>
            <span>1.0.0</span>
          </div>
          <div className="about-row">
            <span className="about-key">Описание:</span>
            <span>Управление конфигурацией серверов</span>
          </div>
          <div className="about-row">
            <span className="about-key">Технологии:</span>
            <span>Tauri 2, React, TypeScript</span>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn primary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}