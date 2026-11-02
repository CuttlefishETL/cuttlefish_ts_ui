import { useEffect, useState, type ReactNode } from "react";

interface TabViewProps {
  active: boolean;
  /**
   * Тонкая обёртка без рамки и без внутренних отступов.
   * Нужна для табов, у которых содержимое само оформлено карточками
   * (например, Scripts: дерево и редактор уже с рамками).
   */
  tight?: boolean;
  children: ReactNode;
}

export function TabView({ active, tight, children }: TabViewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (active && !mounted) setMounted(true);
  }, [active, mounted]);

  if (!mounted) return null;

  return (
    <div
      className={"tab-view" + (tight ? " tab-view--tight" : "")}
      style={{ display: active ? "flex" : "none" }}
    >
      {children}
    </div>
  );
}