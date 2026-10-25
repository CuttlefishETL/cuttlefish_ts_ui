import { useEffect, useRef, useState } from "react";
import { baseNameOf } from "../pathUtils";

interface Props {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onCheckAll: () => void;
  onAbout: () => void;
  onAuth: () => void;
  onSettings: () => void;
  recentFiles: string[];
  onOpenRecent: (path: string) => void;
  statusText: string;
}

export function MenuBar(props: Props) {
  const [open, setOpen] = useState<"file" | "tools" | "help" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const close = () => setOpen(null);

  return (
    <div className="menubar" ref={ref}>
      <div className="menubar-group">
        <button onClick={() => setOpen(open === "file" ? null : "file")}>Файл</button>
        {open === "file" && (
          <div className="menu-dropdown">
            <button onClick={() => { props.onNew(); close(); }}>Новый</button>
            <button onClick={() => { props.onOpen(); close(); }}>Открыть…</button>
            <button onClick={() => { props.onSave(); close(); }}>Сохранить</button>
            <button onClick={() => { props.onSaveAs(); close(); }}>Сохранить как…</button>
            {props.recentFiles.length > 0 && (
              <>
                <div className="menu-separator" />
                {props.recentFiles.map((p) => (
                  <button
                    key={p}
                    onClick={() => { props.onOpenRecent(p); close(); }}
                    title={p}
                  >
                    {baseNameOf(p)}
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        <button onClick={() => setOpen(open === "tools" ? null : "tools")}>Инструменты</button>
        {open === "tools" && (
          <div className="menu-dropdown">
            <button onClick={() => { props.onCheckAll(); close(); }}>Проверить все</button>
            <button onClick={() => { props.onSettings(); close(); }}>Настройки…</button>
            <button onClick={() => { props.onAuth(); close(); }}>Аутентификация…</button>
          </div>
        )}

        <button onClick={() => setOpen(open === "help" ? null : "help")}>Справка</button>
        {open === "help" && (
          <div className="menu-dropdown">
            <button onClick={() => { props.onAbout(); close(); }}>О программе</button>
          </div>
        )}
      </div>
      <div className="menubar-status">{props.statusText}</div>
    </div>
  );
}