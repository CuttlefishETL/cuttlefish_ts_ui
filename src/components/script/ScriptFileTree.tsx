import { useState } from "react";
import type { ScriptFileNode } from "../../scriptStub";
import type { BreakpointMap } from "./breakpointField";

interface ScriptFileTreeProps {
  nodes: ScriptFileNode[];
  activePath: string | null;
  breakpointsByFile: Record<string, BreakpointMap>;
  onOpen: (path: string) => void;
}

export function ScriptFileTree({
  nodes,
  activePath,
  breakpointsByFile,
  onOpen,
}: ScriptFileTreeProps) {
  return (
    <div className="scripts-tree">
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          activePath={activePath}
          breakpointsByFile={breakpointsByFile}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

function countBreakpoints(
  node: ScriptFileNode,
  breakpointsByFile: Record<string, BreakpointMap>
): number {
  if (node.type === "file") {
    return breakpointsByFile[node.path]?.size ?? 0;
  }
  return (node.children ?? []).reduce(
    (sum, child) => sum + countBreakpoints(child, breakpointsByFile),
    0
  );
}

function TreeNode({
  node,
  depth,
  activePath,
  breakpointsByFile,
  onOpen,
}: {
  node: ScriptFileNode;
  depth: number;
  activePath: string | null;
  breakpointsByFile: Record<string, BreakpointMap>;
  onOpen: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const bpCount = countBreakpoints(node, breakpointsByFile);

  if (node.type === "folder") {
    return (
      <div>
        <div
          className="tree-folder"
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="tree-chevron">{open ? "▾" : "▸"}</span>
          <span className="tree-name">{node.name}</span>
          {bpCount > 0 && (
            <span className="tree-bp-count" title="Точек останова">
              {bpCount}
            </span>
          )}
        </div>
        {open &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              breakpointsByFile={breakpointsByFile}
              onOpen={onOpen}
            />
          ))}
      </div>
    );
  }

  return (
    <div
      className={`tree-file ${activePath === node.path ? "active" : ""}`}
      style={{ paddingLeft: 8 + depth * 12 + 14 }}
      onClick={() => onOpen(node.path)}
    >
      <span className="tree-name">{node.name}</span>
      {bpCount > 0 && (
        <span className="tree-bp-count" title="Точек останова">
          {bpCount}
        </span>
      )}
    </div>
  );
}