// @effect-diagnostics nodeBuiltinImport:off
import * as NodeChildProcess from "node:child_process";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { it as effectIt } from "@effect/vitest";
import { describe, expect, it } from "vite-plus/test";
import {
  ProjectId,
  ProviderInstanceId,
  RunId,
  RuntimeRequestId,
  ThreadId,
  type OrchestrationV2ThreadShell,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";
import * as StorageCleanup from "./storageCleanup.ts";
import * as ServerConfig from "./config.ts";
import * as Settings from "./serverSettings.ts";
import * as SqlitePersistence from "./persistence/Sqlite.ts";
import * as ProjectStore from "./orchestration-v2/ProjectStore.ts";
import * as ProjectionStore from "./orchestration-v2/ProjectionStore.ts";
import * as Orchestrator from "./orchestration-v2/Orchestrator.ts";
import * as GitVcsDriver from "./vcs/GitVcsDriver.ts";
import * as VcsProcess from "./vcs/VcsProcess.ts";
import * as GitManager from "./git/GitManager.ts";
import * as TerminalManager from "./terminal/Manager.ts";
import {
  storageCleanupActivityAt,
  storageCleanupPullRequestMerged,
  storageCleanupThreadIdle,
} from "./storageCleanup.ts";

const NOW_MS = Date.parse("2026-06-10T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1_000;

for (const scenario of [
  "relative",
  "absolute",
  "linked-parent",
  "linked-worktree",
  "outside",
  "dirty",
] as const) {
  effectIt.effect(`project worktree cleanup: ${scenario}`, () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const now = yield* Clock.currentTimeMillis;
      const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "t3-project-cleanup-" });
      const root = yield* fs.realPath(temporary);
      const repository = path.join(root, "repository");
      const baseDir = path.join(root, "t3-home");
      yield* fs.makeDirectory(repository);
      const runGit = (args: string[]) =>
        Effect.sync(() =>
          NodeChildProcess.execFileSync("git", args, { cwd: repository, stdio: "pipe" }),
        );
      yield* runGit(["init", "--initial-branch=main"]);
      yield* runGit([
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.com",
        "commit",
        "--allow-empty",
        "-m",
        "Initial",
      ]);
      const configuredBase =
        scenario === "absolute" ? path.join(root, "custom-worktrees") : ".worktrees";
      const projectBase = path.resolve(repository, configuredBase);
      if (scenario === "linked-parent") {
        const realBase = path.join(root, "real-worktrees");
        yield* fs.makeDirectory(realBase);
        yield* fs.symlink(realBase, projectBase);
      }
      const actualWorktree =
        scenario === "outside" || scenario === "linked-worktree"
          ? path.join(root, "external-worktree")
          : path.join(projectBase, "feature-demo");
      yield* runGit(["worktree", "add", "-b", "feature/demo", actualWorktree, "main"]);
      const recordedPath =
        scenario === "linked-worktree" ? path.join(projectBase, "feature-demo") : actualWorktree;
      if (scenario === "linked-worktree") {
        yield* fs.makeDirectory(projectBase);
        yield* fs.symlink(actualWorktree, recordedPath);
      }
      if (scenario === "dirty")
        yield* fs.writeFileString(path.join(actualWorktree, "uncommitted.txt"), "keep");
      const thread = shell({
        branch: "feature/demo",
        worktreePath: recordedPath,
        createdAt: DateTime.makeUnsafe(now - 10 * DAY_MS),
        updatedAt: DateTime.makeUnsafe(now - 10 * DAY_MS),
      });
      const sweepStarted = yield* Deferred.make<void>();
      const testLayer = Layer.mergeAll(
        Layer.mock(ProjectionStore.ProjectionStoreV2)({
          getShellSnapshot: (options) =>
            Deferred.succeed(sweepStarted, undefined).pipe(
              Effect.as({
                schemaVersion: 2,
                snapshotSequence: 0,
                threads: options?.location === "archive" ? [] : [thread],
                archivedThreads: [],
              }),
            ),
        }),
        Layer.mock(ProjectStore.ProjectStoreV2)({
          listShells: () =>
            Effect.succeed([
              {
                id: thread.projectId,
                title: "Project",
                workspaceRoot: repository,
                defaultModelSelection: null,
                scripts: [],
                createdAt: "2026-06-01T00:00:00.000Z",
                updatedAt: "2026-06-01T00:00:00.000Z",
              },
            ]),
        }),
        Layer.mock(Orchestrator.OrchestratorV2)({ streamDomainEvents: Stream.never }),
        Layer.mock(TerminalManager.TerminalManager)({
          subscribeMetadata: () => Effect.succeed(() => {}),
        }),
        Layer.mock(GitManager.GitManager)({ invalidateStatus: () => Effect.void }),
        Settings.ServerSettingsService.layerTest({
          projectSettingsOverrides: {
            [thread.projectId]: { worktreeBaseDirectory: configuredBase },
          },
          storageCleanup: { worktreeAfterDays: 1 },
        }),
        SqlitePersistence.layerMemory,
        GitVcsDriver.layer.pipe(
          Layer.provide(VcsProcess.layer),
          Layer.provide(ServerConfig.layerTest(repository, baseDir)),
        ),
        ServerConfig.layerTest(repository, baseDir),
      ).pipe(Layer.provideMerge(NodeServices.layer));
      const context = yield* Layer.build(testLayer);
      const cleanup = yield* StorageCleanup.make.pipe(Effect.provideContext(context));
      yield* cleanup.start();
      yield* Deferred.await(sweepStarted);
      yield* cleanup.drain;
      const removed = ["relative", "absolute", "linked-parent"].includes(scenario);
      expect(yield* fs.exists(actualWorktree)).toBe(!removed);
      expect(yield* fs.exists(repository)).toBe(true);
    }).pipe(Effect.provide(NodeServices.layer)),
  );
}

function at(offsetMs: number): DateTime.Utc {
  return DateTime.makeUnsafe(NOW_MS + offsetMs);
}

function shell(overrides: Partial<OrchestrationV2ThreadShell> = {}): OrchestrationV2ThreadShell {
  return {
    id: ThreadId.make("thread-1"),
    projectId: ProjectId.make("project-1"),
    title: "Thread",
    providerInstanceId: ProviderInstanceId.make("codex"),
    modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
    runtimeMode: "full-access",
    interactionMode: "default",
    worktreePath: null,
    activeProviderThreadId: null,
    lineage: {
      rootThreadId: ThreadId.make("thread-1"),
      parentThreadId: null,
      relationshipToParent: null,
    },
    forkedFrom: null,
    createdBy: "user",
    creationSource: "web",
    activeRunId: null,
    latestVisibleMessage: null,
    hasActionableProposedPlan: false,
    itemCount: 0,
    visibleItemCount: 0,
    lastVisitedAt: null,
    deletedAt: null,
    branch: null,
    linkedPullRequest: null,
    status: "idle",
    activityRunStatus: null,
    pendingRuntimeRequest: null,
    pendingBackgroundTasks: [],
    latestRunId: null,
    latestRunRequestedAt: null,
    latestRunStartedAt: null,
    latestRunCompletedAt: null,
    latestUserMessageAt: null,
    createdAt: at(-30 * DAY_MS),
    updatedAt: at(-10 * DAY_MS),
    archivedAt: null,
    settledOverride: null,
    settledAt: null,
    snoozedUntil: null,
    snoozedAt: null,
    pinnedAt: null,
    ...overrides,
  };
}

describe("V2 storage cleanup eligibility", () => {
  const candidate = () => shell({ branch: "feature", worktreePath: "/worktrees/feature" });

  it("allows an idle worktree and rejects the project checkout", () => {
    expect(storageCleanupThreadIdle(candidate(), NOW_MS)).toBe(true);
    expect(storageCleanupThreadIdle(shell(), NOW_MS)).toBe(false);
  });

  it.each(["running", "starting", "preparing", "waiting", "queued"] as const)(
    "retains a worktree while its thread is %s",
    (status) => {
      expect(storageCleanupThreadIdle(candidateWithStatus(status), NOW_MS)).toBe(false);
    },
  );

  it.each(["idle", "completed", "interrupted", "failed", "cancelled", "rolled_back"] as const)(
    "allows cleanup once its thread is %s",
    (status) => {
      expect(storageCleanupThreadIdle(candidateWithStatus(status), NOW_MS)).toBe(true);
    },
  );

  it.each(["completed", "interrupted", "cancelled", "rolled_back"] as const)(
    "retains %s while background work is pending",
    (status) => {
      expect(
        storageCleanupThreadIdle(
          {
            ...candidateWithStatus(status),
            pendingBackgroundTasks: [{ taskId: "task-1", kind: "command" }],
          },
          NOW_MS,
        ),
      ).toBe(false);
    },
  );

  it.each(["completed", "interrupted", "cancelled", "rolled_back"] as const)(
    "retains %s while a runtime request is pending",
    (status) => {
      expect(
        storageCleanupThreadIdle(
          {
            ...candidateWithStatus(status),
            pendingRuntimeRequest: {
              id: RuntimeRequestId.make("request-1"),
              kind: "command",
              createdAt: at(0),
            },
          },
          NOW_MS,
        ),
      ).toBe(false);
    },
  );

  it("retains an active run even if the shell status is idle", () => {
    expect(
      storageCleanupThreadIdle({ ...candidate(), activeRunId: RunId.make("run") }, NOW_MS),
    ).toBe(false);
  });

  it("retains a queued prompt before the new run has been projected", () => {
    expect(
      storageCleanupThreadIdle({ ...candidate(), latestUserMessageAt: at(-1_000) }, NOW_MS),
    ).toBe(false);
  });

  it("uses V2 run activity instead of metadata refreshes for retention", () => {
    const thread = candidate();
    const runTime = at(-3 * DAY_MS);
    expect(
      storageCleanupActivityAt({ ...thread, latestRunCompletedAt: runTime, updatedAt: at(0) }),
    ).toBe(DateTime.toEpochMillis(runTime));
  });

  function candidateWithStatus(status: OrchestrationV2ThreadShell["status"]) {
    return { ...candidate(), status };
  }
});

describe("merged pull request cleanup", () => {
  const HEAD_SHA = "a".repeat(40);
  const integrated = {
    branch: "feature",
    defaultBranch: "main",
    headSha: HEAD_SHA,
    integrated: true,
  };
  const squashed = { ...integrated, integrated: false };
  const pullRequest = (
    overrides: Partial<NonNullable<Parameters<typeof storageCleanupPullRequestMerged>[0]>> = {},
  ) => ({
    state: "merged" as const,
    headRef: "feature",
    baseRef: "main",
    headSha: HEAD_SHA,
    ...overrides,
  });

  it("removes a worktree whose head reached the default branch through a merged pull request", () => {
    expect(storageCleanupPullRequestMerged(pullRequest({ headSha: null }), integrated)).toBe(true);
  });

  it("removes a squash-merged worktree when the pull request names its exact head", () => {
    expect(storageCleanupPullRequestMerged(pullRequest(), squashed)).toBe(true);
  });

  it.each([
    ["has a later commit than the merged head", { headSha: "c".repeat(40) }],
    ["was merged into a release branch", { baseRef: "release" }],
    ["was merged into its stack parent", { baseRef: "stack-parent" }],
    ["was merged without a reported head commit", { headSha: null }],
    ["belongs to a different branch", { headRef: "other" }],
    ["is still open", { state: "open" }],
    ["was closed without merging", { state: "closed" }],
  ] as const)("keeps a squash worktree whose pull request %s", (_name, overrides) => {
    expect(storageCleanupPullRequestMerged(pullRequest(overrides), squashed)).toBe(false);
  });

  it("keeps a worktree with no pull request, or one that is not merged", () => {
    expect(storageCleanupPullRequestMerged(null, squashed)).toBe(false);
    expect(storageCleanupPullRequestMerged(null, integrated)).toBe(false);
    expect(storageCleanupPullRequestMerged(pullRequest({ state: "open" }), integrated)).toBe(false);
  });
});
