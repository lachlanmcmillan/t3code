import type { DiffFoldOverride, FileDiffFoldChoices } from "./pullRequestDiff.logic";

/**
 * Where a pull request's Code tab was left. The right panel mounts only its active surface, so
 * switching panel tabs unmounts this view. Diff pages stay in the query cache, not here.
 */
export interface RememberedPullRequestCodeView {
  readonly foldChoices: FileDiffFoldChoices;
  readonly foldOverride: DiffFoldOverride;
  /** The file at the top of the viewport, the distance into it, and the pages loaded to reach it. */
  readonly scroll: {
    readonly fileKey: string;
    readonly offset: number;
    readonly pages: number;
  } | null;
}

const MAX_REMEMBERED_VIEWS = 50;
const rememberedViews = new Map<string, RememberedPullRequestCodeView>();

export function readPullRequestCodeView(scopeKey: string) {
  return rememberedViews.get(scopeKey);
}

export function rememberPullRequestCodeView(
  scopeKey: string,
  view: Partial<RememberedPullRequestCodeView>,
) {
  const previous = rememberedViews.get(scopeKey);
  rememberedViews.delete(scopeKey);
  rememberedViews.set(scopeKey, {
    foldChoices: previous?.foldChoices ?? new Map(),
    foldOverride: previous?.foldOverride ?? null,
    scroll: previous?.scroll ?? null,
    ...view,
  });
  if (rememberedViews.size > MAX_REMEMBERED_VIEWS) {
    const oldest = rememberedViews.keys().next().value;
    if (oldest !== undefined) rememberedViews.delete(oldest);
  }
}
