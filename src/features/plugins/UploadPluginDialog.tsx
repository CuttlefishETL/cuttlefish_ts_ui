import { useState } from "react";

interface Props {
  onClose: () => void;
  onUpload: (file: File, onProgress: (p: number) => void) => Promise<void>;
}

export function UploadPluginDialog({ onClose, onUpload }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const start = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      await onUpload(file, setProgress);
    } catch (e) {
      setError((e as Error).message);
      setUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={uploading ? undefined : onClose}>
      <div className="modal plugins-upload-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Добавить плагин</h3>

        <div className="field">
          <label>Файл плагина</label>
          <input
            type="file"
            accept=".so,.dll,.dylib,.lua"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={uploading}
          />
        </div>

        {progress !== null && (
          <div className="plugins-progress">
            <div className="plugins-progress-bar" style={{ width: `${progress}%` }} />
            <span className="plugins-progress-label">{progress}%</span>
          </div>
        )}

        {error && <p className="plugins-error">{error}</p>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={uploading}>
            Отмена
          </button>
          <button className="btn primary" onClick={start} disabled={!file || uploading}>
            Загрузить
          </button>
        </div>
      </div>
    </div>
  );
}