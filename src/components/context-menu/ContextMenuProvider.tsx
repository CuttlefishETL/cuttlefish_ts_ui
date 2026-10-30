import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { ContextMenuHandle, MenuItem } from "./types";
import "./ContextMenu.css";

const ContextMenuCtx = createContext<ContextMenuHandle | null>(null);

export function useContextMenu(): ContextMenuHandle {
  const ctx = useContext(ContextMenuCtx);
  if (!ctx) {
    throw new Error(
      "useContextMenu must be used inside <ContextMenuProvider>",
    );
  }
  return ctx;
}

interface MenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

export function ContextMenuProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setMenu(null), []);

  const open = useCallback(
    (e: React.MouseEvent | MouseEvent, items: MenuItem[]) => {
      e.preventDefault();
      e.stopPropagation();
      const visible = items.filter(
        (it) => it.kind === "sep" || !it.hidden,
      );
      if (visible.length === 0) return;
      setMenu({ x: e.clientX, y: e.clientY, items: visible });
    },
    [],
  );

  // Позиционирование: не вылезать за границы окна + фокус для клавиатуры
  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    const x = Math.min(menu.x, Math.max(8, maxX));
    const y = Math.min(menu.y, Math.max(8, maxY));
    if (x !== menu.x || y !== menu.y) {
      setMenu((m) => (m ? { ...m, x, y } : m));
    }
    el.focus();
  }, [menu]);

  // Закрытие: клик вне, Escape, скролл, resize, потеря фокуса окна
  useEffect(() => {
    if (!menu) return;

    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    const onScrollOrResize = () => setMenu(null);
    const onBlur = () => setMenu(null);

    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("blur", onBlur);
    };
  }, [menu]);

  const handle: ContextMenuHandle = {
    openContextMenu: open,
    closeContextMenu: close,
    isOpen: menu !== null,
  };

  return (
    <ContextMenuCtx.Provider value={handle}>
      {children}
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            className="context-menu"
            style={{ left: menu.x, top: menu.y }}
            onContextMenu={(e) => e.preventDefault()}
            tabIndex={-1}
            role="menu"
          >
            {menu.items.map((item, idx) => {
              if (item.kind === "sep") {
                return (
                  <div
                    key={idx}
                    className="context-menu-sep"
                    role="separator"
                  />
                );
              }
              return (
                <button
                  key={idx}
                  type="button"
                  role="menuitem"
                  className={
                    "context-menu-item" + (item.danger ? " danger" : "")
                  }
                  disabled={item.disabled}
                  onClick={() => {
                    setMenu(null);
                    item.onClick();
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </ContextMenuCtx.Provider>
  );
}
