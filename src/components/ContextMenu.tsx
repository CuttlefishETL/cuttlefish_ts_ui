import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
}

export interface AnchorRect {
  left: number;
  top: number;
  bottom: number;
  right: number;
}

interface ContextMenuProps {
  anchor: AnchorRect;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ anchor, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: anchor.left,
    top: anchor.bottom + 2,
  });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const pad = 4;

    let left = anchor.left;
    let top = anchor.bottom + 2;

    // Если не влезает справа — сдвигаем влево
    if (left + rect.width + pad > window.innerWidth) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    // Если не влезает снизу — открываем над строкой
    if (top + rect.height + pad > window.innerHeight) {
      top = Math.max(pad, anchor.top - rect.height - 2);
    }

    setPos({ left, top });
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div ref={ref} className="context-menu" style={{ left: pos.left, top: pos.top }}>
      {items.map((item) => (
        <button
          type="button"
          key={item.label}
          className="context-menu-item"
          disabled={item.disabled}
          onClick={() => {
            onClose();
            item.action();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
}