import type { ReactNode } from "react";

export interface MenuAction {
  kind?: "item";
  label: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

export interface MenuSeparator {
  kind: "sep";
}

export type MenuItem = MenuAction | MenuSeparator;

export interface ContextMenuHandle {
  openContextMenu: (
    e: React.MouseEvent | MouseEvent,
    items: MenuItem[],
  ) => void;
  closeContextMenu: () => void;
  isOpen: boolean;
}

/** Хелперы для декларативного описания меню. */
export function act(
  label: ReactNode,
  onClick: () => void,
  opts?: Omit<MenuAction, "label" | "onClick" | "kind">,
): MenuAction {
  return { kind: "item", label, onClick, ...opts };
}

export function sep(): MenuSeparator {
  return { kind: "sep" };
}
