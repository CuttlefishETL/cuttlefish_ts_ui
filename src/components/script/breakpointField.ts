import { StateField, StateEffect } from "@codemirror/state";
import { gutter, GutterMarker, EditorView, keymap } from "@codemirror/view";

export const toggleBreakpointEffect = StateEffect.define<number>();
export const setBreakpointsEffect = StateEffect.define<number[]>();

export const breakpointField = StateField.define<Set<number>>({
  create: () => new Set(),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setBreakpointsEffect)) {
        return new Set(effect.value);
      }
      if (effect.is(toggleBreakpointEffect)) {
        const next = new Set(value);
        if (next.has(effect.value)) next.delete(effect.value);
        else next.add(effect.value);
        return next;
      }
    }
    return value;
  },
});

const breakpointMarker = new (class extends GutterMarker {
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "cm-breakpoint-dot";
    dot.textContent = "●";
    return dot;
  }
})();

export const breakpointGutter = gutter({
  class: "cm-breakpoint-gutter",
  lineMarker: (view, line) => {
    const lineNo = view.state.doc.lineAt(line.from).number;
    return view.state.field(breakpointField).has(lineNo)
      ? breakpointMarker
      : null;
  },
  initialSpacer: () => breakpointMarker,
  domEventHandlers: {
    mousedown: (view, line) => {
      const lineNo = view.state.doc.lineAt(line.from).number;
      view.dispatch({ effects: toggleBreakpointEffect.of(lineNo) });
      return true;
    },
  },
});

export const breakpointKeymap = keymap.of([
  {
    key: "F9",
    run: (view) => {
      const pos = view.state.selection.main.head;
      const lineNo = view.state.doc.lineAt(pos).number;
      view.dispatch({ effects: toggleBreakpointEffect.of(lineNo) });
      return true;
    },
  },
]);

export const breakpointTheme = EditorView.baseTheme({
  ".cm-breakpoint-dot": {
    color: "#d02020",
    fontSize: "12px",
    lineHeight: "1",
  },
});

export function getBreakpoints(view: EditorView): Set<number> {
  return view.state.field(breakpointField);
}

export function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}