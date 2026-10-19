import type * as Path from "effect/Path";

import { expandHomePath } from "@t3tools/provider-core/server/pathExpansion";

/** Empty inherits the server-wide location; configured folders contain one child per branch. */
export function configuredWorktreePath(
  repositoryCwd: string,
  branch: string,
  baseDirectory: string,
  path: Path.Path,
  home: string,
): string | null {
  const configured = baseDirectory.trim();
  if (configured === "") return null;
  return path.join(
    path.resolve(repositoryCwd, expandHomePath(configured, home)),
    branch.replaceAll("/", "-"),
  );
}
