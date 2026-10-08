import { assert, it } from "@effect/vitest";
import { EventId, ProjectId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as SqlitePersistence from "../persistence/Sqlite.ts";
import * as ProjectionStore from "./ProjectionStore.ts";

for (const [name, layer] of [
  ["SQL", ProjectionStore.layer.pipe(Layer.provide(SqlitePersistence.layerMemory))],
  ["memory", ProjectionStore.layerMemory],
] as const) {
  it.layer(layer)(`recorded worktree paths (${name})`, (it) => {
    it.effect(
      "includes archived worktrees, deduplicates shared paths, and omits deleted/local threads",
      () =>
        Effect.gen(function* () {
          const store = yield* ProjectionStore.ProjectionStoreV2;
          const now = DateTime.makeUnsafe("2026-10-01T00:00:00.000Z");
          const providerInstanceId = ProviderInstanceId.make("codex");
          for (const [id, worktreePath, archived, deleted] of [
            ["active", "/worktrees/active", false, false],
            ["shared", "/worktrees/active", false, false],
            ["archived", "/worktrees/archived", true, false],
            ["deleted", "/worktrees/deleted", false, true],
            ["local", null, false, false],
          ] as const) {
            const threadId = ThreadId.make(id);
            yield* store.apply({
              id: EventId.make(`event:${id}`),
              type: "thread.created",
              threadId,
              occurredAt: now,
              payload: {
                createdBy: "user",
                creationSource: "web",
                id: threadId,
                projectId: ProjectId.make("project"),
                title: id,
                providerInstanceId,
                modelSelection: { instanceId: providerInstanceId, model: "gpt-5" },
                runtimeMode: "full-access",
                interactionMode: "default",
                branch: "feature/demo",
                worktreePath,
                activeProviderThreadId: null,
                lineage: {
                  rootThreadId: threadId,
                  parentThreadId: null,
                  relationshipToParent: null,
                },
                forkedFrom: null,
                createdAt: now,
                updatedAt: now,
                archivedAt: archived ? now : null,
                settledOverride: null,
                settledAt: null,
                lastVisitedAt: null,
                deletedAt: deleted ? now : null,
              },
            });
          }
          assert.deepEqual((yield* store.getWorktreePaths()).toSorted(), [
            "/worktrees/active",
            "/worktrees/archived",
          ]);
        }),
    );
  });
}
