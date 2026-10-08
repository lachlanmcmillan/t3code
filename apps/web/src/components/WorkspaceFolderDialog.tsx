import type { EnvironmentId } from "@t3tools/contracts";
import {
  ensureBrowseDirectoryPath,
  getBrowseParentPath,
} from "@t3tools/client-runtime/state/projects";
import { FolderIcon } from "lucide-react";
import { useState } from "react";

import { filesystemEnvironment } from "../state/filesystem";
import { useEnvironmentQuery } from "../state/query";
import { vcsEnvironment } from "../state/vcs";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";

export function WorkspaceFolderDialog({
  environmentId,
  initialPath,
  onClose,
  onSelect,
}: {
  environmentId: EnvironmentId;
  initialPath: string;
  onClose: () => void;
  onSelect: (path: string, branch: string | null) => void;
}) {
  const [path, setPath] = useState(initialPath);
  const [browsePath, setBrowsePath] = useState(initialPath);
  const browse = useEnvironmentQuery(
    filesystemEnvironment.browse({
      environmentId,
      input: { partialPath: ensureBrowseDirectoryPath(browsePath), cwd: initialPath },
    }),
  );
  const resolvedPath =
    browse.isSuccess && !browse.isPending && !browse.error ? browse.data?.parentPath : null;
  const status = useEnvironmentQuery(
    resolvedPath
      ? vcsEnvironment.status({
          environmentId,
          input: { cwd: resolvedPath },
        })
      : null,
  );
  const parentPath = getBrowseParentPath(ensureBrowseDirectoryPath(resolvedPath ?? browsePath));
  const navigate = (nextPath: string) => {
    setPath(nextPath);
    setBrowsePath(nextPath);
  };
  const canSelect = Boolean(
    resolvedPath &&
    path === browsePath &&
    status.isSuccess &&
    !status.isPending &&
    !status.error &&
    status.data?.isRepo,
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Select workspace folder</DialogTitle>
          <DialogDescription>
            Choose an existing checkout or worktree on this environment.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (path.trim()) navigate(path.trim());
            }}
          >
            <Input
              aria-label="Folder path"
              value={path}
              onChange={(event) => setPath(event.target.value)}
            />
            <Button type="submit" variant="outline" disabled={!path.trim()}>
              Browse
            </Button>
          </form>
          <div className="mt-3 flex flex-col gap-1">
            {parentPath ? (
              <div>
                <Button variant="ghost" size="sm" onClick={() => navigate(parentPath)}>
                  Parent folder
                </Button>
              </div>
            ) : null}
            {browse.isPending ? (
              <p className="text-sm text-muted-foreground">Loading folders…</p>
            ) : null}
            {browse.error ? (
              <p role="alert" className="text-sm text-destructive">
                {browse.error}
              </p>
            ) : null}
            {resolvedPath
              ? browse.data?.entries.map((entry) => (
                  <div key={entry.fullPath} className="min-w-0">
                    <Button variant="ghost" size="sm" onClick={() => navigate(entry.fullPath)}>
                      <FolderIcon />
                      <span className="truncate">{entry.name}</span>
                    </Button>
                  </div>
                ))
              : null}
          </div>
          {status.error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {status.error}
            </p>
          ) : null}
          {status.isSuccess && !status.data?.isRepo ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Choose a folder in a source control repository.
            </p>
          ) : null}
          {status.data?.refName ? (
            <p className="mt-3 text-sm text-muted-foreground">Branch: {status.data.refName}</p>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!canSelect}
            onClick={() => {
              if (canSelect && resolvedPath) onSelect(resolvedPath, status.data?.refName ?? null);
            }}
          >
            Use folder
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
