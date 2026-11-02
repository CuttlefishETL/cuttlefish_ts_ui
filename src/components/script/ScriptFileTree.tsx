import { useState } from "react";
import type { CodeTreeNode } from "../../features/code/types";
import type { BreakpointMap } from "./breakpointField";

interface ScriptFileTreeProps {
  nodes: CodeTreeNode[];
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
          key={node.path || node.name}
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
  node: CodeTreeNode,
  breakpointsByFile: Record<string, BreakpointMap>,
): number {
  if (node.type === "file") {
    return breakpointsByFile[node.path]?.size ?? 0;
  }
  const children: CodeTreeNode[] = node.children ?? [];
  return children.reduce<number>(
    (sum, child) => sum + countBreakpoints(child, breakpointsByFile),
    0,
  );
}

function TreeNode({
  node,
  depth,
  activePath,
  breakpointsByFile,
  onOpen,
}: {
  node: CodeTreeNode;
  depth: number;
  activePath: string | null;
  breakpointsByFile: Record<string, BreakpointMap>;
  onOpen: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const bpCount = countBreakpoints(node, breakpointsByFile);

  if (node.type === "folder") {
    const children: CodeTreeNode[] = node.children ?? [];
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
          children.map((child: CodeTreeNode) => (
            <TreeNode
              key={child.path || child.name}
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
      title={node.path}
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