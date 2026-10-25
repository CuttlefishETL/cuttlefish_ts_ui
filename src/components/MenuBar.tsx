import { useEffect, useRef, useState } from "react";
import { baseNameOf } from "../pathUtils";

interface MenuBarProps {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenRecent: (path: string) => void;
  onExit: () => void;
  onAbout: () => void;
  onSettings: () => void;
  recentFiles: string[];
  currentFilePath: string | null;
  dirty: boolean;
}

type Entry =
  | {
      type: "item";
      label: string;
      action: () => void;
      shortcut?: string;
      dirtyMark?: boolean;
      title?: string;
    }
  | { type: "separator" }
  | { type: "section"; label: string };

export function MenuBar({
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onOpenRecent,
  onExit,
  onAbout,
  onSettings,
  recentFiles,
  currentFilePath,
  dirty,
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  const run = (action: () => void) => {
    setOpenMenu(null);
    action();
  };

  const fileEntries: Entry[] = [
    { type: "item", label: "Новый", action: onNew, shortcut: "Ctrl+N" },
    { type: "item", label: "Открыть…", action: onOpen, shortcut: "Ctrl+O" },
    {
      type: "item",
      label: "Сохранить",
      action: onSave,
      shortcut: "Ctrl+S",
      dirtyMark: dirty,
    },
    {
      type: "item",
      label: "Сохранить как…",
      action: onSaveAs,
      shortcut: "Ctrl+Shift+S",
    },
  ];

  if (recentFiles.length > 0) {
    fileEntries.push({ type: "separator" });
    fileEntries.push({ type: "section", label: "Последние файлы" });
    recentFiles.forEach((path) => {
      fileEntries.push({
        type: "item",
        label: baseNameOf(path),
        action: () => onOpenRecent(path),
        title: path,
      });
    });
  }

  fileEntries.push({ type: "separator" });
  fileEntries.push({
    type: "item",
    label: "Выйти",
    action: onExit,
    shortcut: "Ctrl+Q",
  });

  return (
    <div className="menu-bar" ref={rootRef}>
      <div className="menu-root">
        <button
          type="button"
          className={`menu-item ${openMenu === "file" ? "open" : ""}`}
          onClick={() =>
            setOpenMenu((prev) => (prev === "file" ? null : "file"))
          }
          onMouseEnter={() => {
            if (openMenu) setOpenMenu("file");
          }}
        >
          Файл
        </button>

        {openMenu === "file" && (
          <div className="menu-dropdown">
            {fileEntries.map((entry, i) => {
              if (entry.type === "separator") {
                return (
                  <div key={`sep-${i}`} className="menu-dropdown-separator" />
                );
              }
              if (entry.type === "section") {
                return (
                  <div key={`sec-${i}`} className="menu-dropdown-section">
                    {entry.label}
                  </div>
                );
              }
              return (
                <button
                  type="button"
                  key={`item-${i}-${entry.label}`}
                  className="menu-dropdown-item"
                  title={entry.title}
                  onClick={() => run(entry.action)}
                >
                  <span className="menu-dropdown-label">
                    {entry.label}
                    {entry.dirtyMark ? " •" : ""}
                  </span>
                  {entry.shortcut && (
                    <span className="menu-dropdown-shortcut">
                      {entry.shortcut}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="menu-root">
        <button type="button" className="menu-item" onClick={onSettings}>
          Настройка
        </button>
      </div>

      <div className="menu-root">
        <button type="button" className="menu-item" onClick={onAbout}>
          Справка
        </button>
      </div>

      <div className="menu-file-name" title={currentFilePath ?? undefined}>
        {baseNameOf(currentFilePath)}
      </div>
    </div>
  );
}