import { StateField, StateEffect } from "@codemirror/state";
import { gutter, GutterMarker, EditorView, keymap } from "@codemirror/view";

export type BreakpointMap = Map<number, boolean>;

export const toggleBreakpointEffect = StateEffect.define<number>();
export const setBreakpointsEffect = StateEffect.define<[number, boolean][]>();

export const breakpointField = StateField.define<BreakpointMap>({
  create: () => new Map(),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setBreakpointsEffect)) {
        return new Map(effect.value);
      }
      if (effect.is(toggleBreakpointEffect)) {
        const next = new Map(value);
        if (next.has(effect.value)) next.delete(effect.value);
        else next.set(effect.value, true);
        return next;
      }
    }
    return value;
  },
});

class EnabledMarker extends GutterMarker {
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "cm-breakpoint-dot";
    dot.textContent = "●";
    return dot;
  }
}
class DisabledMarker extends GutterMarker {
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "cm-breakpoint-dot disabled";
    dot.textContent = "○";
    return dot;
  }
}
const enabledMarker = new EnabledMarker();
const disabledMarker = new DisabledMarker();

export const breakpointGutter = gutter({
  class: "cm-breakpoint-gutter",
  lineMarker: (view, line) => {
    const lineNo = view.state.doc.lineAt(line.from).number;
    const bp = view.state.field(breakpointField);
    if (!bp.has(lineNo)) return null;
    return bp.get(lineNo) ? enabledMarker : disabledMarker;
  },
  initialSpacer: () => enabledMarker,
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
  ".cm-breakpoint-dot.disabled": {
    color: "#d02020",
    opacity: "0.5",
  },
});

export function getBreakpoints(view: EditorView): BreakpointMap {
  return view.state.field(breakpointField);
}

export function mapsEqual(a: BreakpointMap, b: BreakpointMap): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (!b.has(k) || b.get(k) !== v) return false;
  }
  return true;
}