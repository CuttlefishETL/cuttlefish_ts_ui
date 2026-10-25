import { gutter, GutterMarker } from "@codemirror/view";

const breakpointMarker = new (class extends GutterMarker {
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "cm-breakpoint-dot";
    dot.textContent = "●";
    return dot;
  }
})();

export function breakpointGutter(
  breakpoints: Set<number>,
  onToggle: (line: number) => void
) {
  return gutter({
    class: "cm-breakpoint-gutter",
    lineMarker: (view, line) => {
      const lineNo = view.state.doc.lineAt(line.from).number;
      return breakpoints.has(lineNo) ? breakpointMarker : null;
    },
    initialSpacer: () => breakpointMarker,
    domEventHandlers: {
      mousedown: (view, line) => {
        const lineNo = view.state.doc.lineAt(line.from).number;
        onToggle(lineNo);
        return true;
      },
    },
  });
}