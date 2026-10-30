/**
 * Отключает системное контекстное меню WebView по правой кнопке мыши.
 *
 * Исключения (там меню остаётся нативным):
 *   - <input>
 *   - <textarea>
 *   - [contenteditable]
 *   - [data-allow-context-menu] — явный opt-in для любых элементов.
 *
 * Кастомные контекстные меню (например, в ConnectorsWidget) не затрагиваются:
 * они вызывают e.preventDefault() и e.stopPropagation() в своём обработчике
 * раньше, чем событие дойдёт до document, поэтому глобальный обработчик его
 * не получает вовсе.
 *
 * Возвращает функцию-отписку (не обязательно вызывать — приложение живёт
 * всё время работы вкладки; но полезно для тестов).
 */
export function installContextMenuGuard(): () => void {
  const handler = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;

    if (!target) {
      e.preventDefault();
      return;
    }

    const allow = target.closest(
      [
        "input",
        "textarea",
        '[contenteditable="true"]',
        '[contenteditable=""]',
        "[contenteditable]",
        "[data-allow-context-menu]",
      ].join(","),
    );

    if (allow) {
      return;
    }

    e.preventDefault();
  };

  document.addEventListener("contextmenu", handler);
  return () => document.removeEventListener("contextmenu", handler);
}
