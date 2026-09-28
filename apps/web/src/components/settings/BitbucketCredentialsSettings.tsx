import type { BitbucketSettings, EnvironmentId } from "@t3tools/contracts";
import { useState } from "react";

import { useEnvironmentSettings } from "../../hooks/useSettings";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type BitbucketSettingsPatch = { -readonly [K in keyof BitbucketSettings]?: string };

function savedCredentialLabel(saved: BitbucketSettings): string {
  if (saved.accessToken.length > 0) return "Using the saved access token.";
  if (saved.email.length > 0 && saved.apiToken.length > 0) {
    return `Using the saved API token for ${saved.email}.`;
  }
  return "No credentials saved. The server's T3CODE_BITBUCKET_* variables are used if set.";
}

/**
 * Bitbucket credentials for one environment. Tokens are write-only: the server
 * keeps them in its secret store and only reports whether each one is set.
 */
export function BitbucketCredentialsSettings({
  environmentId,
  onSaved,
}: {
  readonly environmentId: EnvironmentId;
  readonly onSaved: () => void;
}) {
  const saved = useEnvironmentSettings(environmentId, (settings) => settings.bitbucket);
  const updateSettings = useAtomCommand(serverEnvironment.updateSettings, {
    label: "save Bitbucket credentials",
  });
  const [accessToken, setAccessToken] = useState("");
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [apiToken, setApiToken] = useState("");
  const [saving, setSaving] = useState(false);
  const email = emailDraft ?? saved.email;
  const hasAccessToken = saved.accessToken.length > 0;
  const hasApiToken = saved.apiToken.length > 0;

  const draft: BitbucketSettingsPatch = {};
  if (accessToken.trim()) draft.accessToken = accessToken.trim();
  if (apiToken.trim()) draft.apiToken = apiToken.trim();
  if (email.trim() !== saved.email) draft.email = email.trim();
  const canSave = Object.keys(draft).length > 0;

  const save = async (patch: BitbucketSettingsPatch) => {
    setSaving(true);
    try {
      const result = await updateSettings({
        environmentId,
        input: { patch: { bitbucket: patch } },
      });
      if (result._tag === "Success") {
        setAccessToken("");
        setApiToken("");
        setEmailDraft(null);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) void save(draft);
      }}
    >
      <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
        {savedCredentialLabel(saved)} Tokens are stored on this server and can't be viewed after
        saving. The access token is used when both are set.
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor={`bitbucket-access-token-${environmentId}`}>Access token</Label>
        <div className="flex items-center gap-2">
          <Input
            id={`bitbucket-access-token-${environmentId}`}
            type="password"
            autoComplete="off"
            size="sm"
            placeholder={hasAccessToken ? "Saved. Enter a new token to replace it" : "Not set"}
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
          />
          {hasAccessToken ? (
            <Button
              size="xs"
              variant="outline"
              disabled={saving}
              onClick={() => void save({ accessToken: "" })}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`bitbucket-email-${environmentId}`}>Atlassian account email</Label>
        <Input
          id={`bitbucket-email-${environmentId}`}
          type="email"
          autoComplete="off"
          size="sm"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmailDraft(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`bitbucket-api-token-${environmentId}`}>API token</Label>
        <div className="flex items-center gap-2">
          <Input
            id={`bitbucket-api-token-${environmentId}`}
            type="password"
            autoComplete="off"
            size="sm"
            placeholder={hasApiToken ? "Saved. Enter a new token to replace it" : "Not set"}
            value={apiToken}
            onChange={(event) => setApiToken(event.target.value)}
          />
          {hasApiToken || saved.email.length > 0 ? (
            <Button
              size="xs"
              variant="outline"
              disabled={saving}
              onClick={() => void save({ email: "", apiToken: "" })}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="xs" disabled={!canSave || saving}>
          Save
        </Button>
      </div>
    </form>
  );
}
