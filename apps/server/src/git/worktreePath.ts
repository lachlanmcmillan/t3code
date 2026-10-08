import type * as Path from "effect/Path";

import { expandHomePathWith } from "../pathExpansion.ts";

/** Empty inherits the server-wide location; configured folders contain one child per branch. */
export function configuredWorktreePath(
  repositoryCwd: string,
  branch: string,
  baseDirectory: string,
  path: Path.Path,
): string | null {
  const configured = baseDirectory.trim();
  if (configured === "") return null;
  return path.join(
    path.resolve(repositoryCwd, expandHomePathWith(configured, path)),
    branch.replaceAll("/", "-"),
  );
}
