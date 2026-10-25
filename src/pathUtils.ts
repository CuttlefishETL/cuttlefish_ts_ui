export function baseNameOf(path: string | null): string {
  if (!path) return "Без имени";
  const parts = path.split(/[\\/]/);
  const last = parts[parts.length - 1] ?? "";
  const dot = last.lastIndexOf(".");
  return dot > 0 ? last.slice(0, dot) : last || "Без имени";
}