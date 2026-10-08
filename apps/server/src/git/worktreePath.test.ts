// @effect-diagnostics nodeBuiltinImport:off
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import { expect } from "vite-plus/test";
import { it } from "@effect/vitest";

import { configuredWorktreePath } from "./worktreePath.ts";

it.layer(Path.layer)("configuredWorktreePath", (it) => {
  it.effect("inherits the server-wide location when the project folder is empty", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      expect(configuredWorktreePath("/projects/example", "feature/demo", " ", path)).toBeNull();
    }),
  );

  it.effect("resolves relative, absolute, and home folders on the server", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      expect(configuredWorktreePath("/projects/example", "feature/demo", ".worktrees", path)).toBe(
        NodePath.join("/projects/example/.worktrees", "feature-demo"),
      );
      expect(configuredWorktreePath("/projects/example", "feature/demo", "/worktrees", path)).toBe(
        NodePath.join("/worktrees", "feature-demo"),
      );
      expect(
        configuredWorktreePath("/projects/example", "feature/demo", "~/.worktrees", path),
      ).toBe(NodePath.join(NodeOS.homedir(), ".worktrees", "feature-demo"));
    }),
  );
});
