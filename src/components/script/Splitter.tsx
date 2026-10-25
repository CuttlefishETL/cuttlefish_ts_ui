import { useEffect, useRef, useState } from "react";

interface SplitterProps {
  direction: "vertical" | "horizontal";
  onDelta: (delta: number) => void;
}

/**
 * direction="vertical"   — вертикальная полоса (тянет по горизонтали)
 * direction="horizontal" — горизонтальная полоса (тянет по вертикали)
 */
export function Splitter({ direction, onDelta }: SplitterProps) {
  const [dragging, setDragging] = useState(false);
  const startRef = useRef(0);
  const onDeltaRef = useRef(onDelta);
  onDeltaRef.current = onDelta;

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      const cur = direction === "vertical" ? e.clientX : e.clientY;
      const delta = cur - startRef.current;
      if (delta === 0) return;
      startRef.current = cur;
      onDeltaRef.current(delta);
    };
    const onUp = () => setDragging(false);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);

    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor =
      direction === "vertical" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [dragging, direction]);

  const className =
    direction === "vertical"
      ? `splitter-v ${dragging ? "active" : ""}`
      : `splitter-h ${dragging ? "active" : ""}`;

  return (
    <div
      className={className}
      role="separator"
      aria-orientation={direction}
      onMouseDown={(e) => {
        e.preventDefault();
        startRef.current =
          direction === "vertical" ? e.clientX : e.clientY;
        setDragging(true);
      }}
    />
  );
}