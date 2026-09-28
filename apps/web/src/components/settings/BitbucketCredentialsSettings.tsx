import type { BitbucketSettings, EnvironmentId } from "@t3tools/contracts";
import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";

import { useEnvironmentSettings } from "../../hooks/useSettings";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Toggle, ToggleGroup } from "../ui/toggle-group";

type CredentialMethod = "access-token" | "api-token";

const METHODS: Record<
  CredentialMethod,
  {
    readonly label: string;
    readonly description: string;
    readonly link: string;
    readonly linkLabel: string;
  }
> = {
  "access-token": {
    label: "Access token",
    description:
      "A token created for one repository, project, or workspace in its Bitbucket settings. It can only reach what it was created for.",
    link: "https://support.atlassian.com/bitbucket-cloud/docs/access-tokens/",
    linkLabel: "About access tokens",
  },
  "api-token": {
    label: "Atlassian API token",
    description:
      "A token for your Atlassian account, used with your account email. It can reach every repository you can. Give it read and write access to repositories and pull requests, plus read:user:bitbucket.",
    link: "https://id.atlassian.com/manage-profile/security/api-tokens",
    linkLabel: "Create an API token",
  },
};

function savedMethod(saved: BitbucketSettings): CredentialMethod | null {
  if (saved.accessToken.length > 0) return "access-token";
  if (saved.email.length > 0 && saved.apiToken.length > 0) return "api-token";
  return null;
}

function savedCredentialLabel(saved: BitbucketSettings): string {
  const method = savedMethod(saved);
  if (method === "access-token") return "Using the saved access token.";
  if (method === "api-token") return `Using the saved API token for ${saved.email}.`;
  return "No credentials saved. The server's T3CODE_BITBUCKET_* variables are used if set.";
}

/**
 * Bitbucket credentials for one environment: an access token or an Atlassian
 * account email + API token, never both. Tokens are write-only: the server
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
  const [methodChoice, setMethodChoice] = useState<CredentialMethod | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [apiToken, setApiToken] = useState("");
  const [saving, setSaving] = useState(false);
  const current = savedMethod(saved);
  const method = methodChoice ?? current ?? "access-token";
  const methodIsSaved = current === method;
  const email = emailDraft ?? saved.email;
  const info = METHODS[method];

  // Saving one method clears the other, so a hidden credential never wins over the visible one.
  const patch: BitbucketSettings | null =
    method === "access-token"
      ? accessToken.trim()
        ? { accessToken: accessToken.trim(), email: "", apiToken: "" }
        : null
      : email.trim() && (apiToken.trim() || saved.apiToken.length > 0)
        ? {
            accessToken: "",
            email: email.trim(),
            // Omitting a token would clear it; resend the saved marker to keep it.
            apiToken: apiToken.trim() || saved.apiToken,
          }
        : null;
  const canSave =
    patch !== null &&
    (method === "access-token" ||
      !methodIsSaved ||
      apiToken.trim() !== "" ||
      email.trim() !== saved.email);

  const save = async (next: Partial<BitbucketSettings>) => {
    setSaving(true);
    try {
      const result = await updateSettings({
        environmentId,
        input: { patch: { bitbucket: next } },
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
        if (canSave && patch) void save(patch);
      }}
    >
      <p className="text-xs leading-relaxed text-muted-foreground">
        {savedCredentialLabel(saved)} Tokens are stored on this server and can't be viewed after
        saving.
      </p>
      <ToggleGroup
        aria-label="Bitbucket sign-in method"
        variant="segmented"
        value={[method]}
        onValueChange={(next) => {
          const value = next[0];
          if (value === "access-token" || value === "api-token") setMethodChoice(value);
        }}
      >
        <Toggle value="access-token">{METHODS["access-token"].label}</Toggle>
        <Toggle value="api-token">{METHODS["api-token"].label}</Toggle>
      </ToggleGroup>
      <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
        {info.description}{" "}
        <a
          href={info.link}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-0.5 text-foreground underline-offset-2 hover:underline"
        >
          {info.linkLabel}
          <ExternalLinkIcon aria-hidden className="size-3" />
        </a>
      </p>
      {method === "access-token" ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`bitbucket-access-token-${environmentId}`}>Access token</Label>
          <Input
            id={`bitbucket-access-token-${environmentId}`}
            type="password"
            autoComplete="off"
            size="sm"
            placeholder={methodIsSaved ? "Saved. Enter a new token to replace it" : "Not set"}
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
          />
        </div>
      ) : (
        <>
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
            <Input
              id={`bitbucket-api-token-${environmentId}`}
              type="password"
              autoComplete="off"
              size="sm"
              placeholder={
                saved.apiToken.length > 0 ? "Saved. Enter a new token to replace it" : "Not set"
              }
              value={apiToken}
              onChange={(event) => setApiToken(event.target.value)}
            />
          </div>
        </>
      )}
      {current !== null && !methodIsSaved ? (
        <p className="text-xs text-muted-foreground">
          Saving replaces the saved {METHODS[current].label.toLowerCase()}.
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {current !== null ? (
          <Button
            size="xs"
            variant="outline"
            disabled={saving}
            onClick={() => void save({ accessToken: "", email: "", apiToken: "" })}
          >
            Remove credentials
          </Button>
        ) : null}
        <Button type="submit" size="xs" disabled={!canSave || saving}>
          Save
        </Button>
      </div>
    </form>
  );
}
