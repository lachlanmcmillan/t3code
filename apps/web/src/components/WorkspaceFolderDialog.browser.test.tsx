import { EnvironmentId } from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";

import { act, render } from "../../test/render";

const state = vi.hoisted(() => ({
  statusPending: false,
  statusError: null as string | null,
}));

vi.mock("../state/filesystem", () => ({
  filesystemEnvironment: {
    browse: ({ input }: { input: { partialPath: string } }) => ({
      kind: "browse",
      path: input.partialPath.replace(/\/$/, ""),
    }),
  },
}));
vi.mock("../state/vcs", () => ({
  vcsEnvironment: {
    status: ({ input }: { input: { cwd: string } }) => ({ kind: "status", path: input.cwd }),
  },
}));
vi.mock("../state/query", () => ({
  useEnvironmentQuery: (query: { kind: string; path: string } | null) => ({
    isSuccess:
      query !== null &&
      !(query.kind === "status" && (state.statusPending || state.statusError !== null)),
    isPending: query?.kind === "status" && state.statusPending,
    error: query?.kind === "status" ? state.statusError : null,
    data:
      query?.kind === "browse"
        ? {
            parentPath: query.path,
            entries:
              query.path === "/repo"
                ? [{ name: ".worktrees", fullPath: "/repo/.worktrees" }]
                : query.path === "/repo/.worktrees"
                  ? [{ name: "fix-login", fullPath: "/repo/.worktrees/fix-login" }]
                  : [],
          }
        : {
            isRepo: query?.path !== "/repo/.worktrees",
            refName: query?.path === "/repo/.worktrees/fix-login" ? "fix-login" : "main",
          },
  }),
}));

import { WorkspaceFolderDialog } from "./WorkspaceFolderDialog";

it("browses to an existing worktree and only selects it after its repository status succeeds", async () => {
  state.statusPending = false;
  state.statusError = null;
  const onSelect = vi.fn();
  const button = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (element) => element.textContent === label,
    )!;
  const dialog = () => (
    <WorkspaceFolderDialog
      environmentId={EnvironmentId.make("remote")}
      initialPath="/repo"
      onClose={vi.fn()}
      onSelect={onSelect}
    />
  );
  // The dialog under test renders no links.
  await using screen = await render(dialog(), { router: false });

  await act(() => button(".worktrees").click());
  expect(button("Use folder").disabled).toBe(true);
  expect(document.body.textContent).toContain("Choose a folder in a source control repository.");

  state.statusPending = true;
  await act(() => button("fix-login").click());
  expect(button("Use folder").disabled).toBe(true);

  state.statusPending = false;
  state.statusError = "Connection lost";
  await screen.rerender(dialog());
  expect(button("Use folder").disabled).toBe(true);
  expect(document.querySelector('[role="alert"]')?.textContent).toBe("Connection lost");

  state.statusError = null;
  await screen.rerender(dialog());
  expect(button("Use folder").disabled).toBe(false);
  expect(document.body.textContent).toContain("Branch: fix-login");
  await act(() => button("Use folder").click());
  expect(onSelect).toHaveBeenCalledWith("/repo/.worktrees/fix-login", "fix-login");
});
