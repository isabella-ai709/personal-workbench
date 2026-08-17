import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";

import { WorkbenchError } from "../../shared/errors";

export function canonicalPath(path: string): string {
  const resolved = resolve(path);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function stablePathId(path: string): string {
  return createHash("sha256").update(canonicalPath(path)).digest("hex");
}

export function isPathInside(root: string, candidate: string): boolean {
  const pathFromRoot = relative(canonicalPath(root), canonicalPath(candidate));
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

export function assertPathInside(root: string, candidate: string, label: string): void {
  if (!isPathInside(root, candidate)) {
    throw new WorkbenchError("FORBIDDEN", `${label} is outside its trusted directory`, 403);
  }
}
