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
      "Scoped to one repository, project, or workspace. Create it in that item's Bitbucket settings.",
    link: "https://support.atlassian.com/bitbucket-cloud/docs/access-tokens/",
    linkLabel: "Learn more",
  },
  "api-token": {
    label: "API token",
    description:
      "Uses your Atlassian account, so it reaches every repository you can. Give it read and write access to repositories and pull requests, and read:user:bitbucket.",
    link: "https://id.atlassian.com/manage-profile/security/api-tokens",
    linkLabel: "Create an API token",
  },
};

/** Filler for a saved token's field. A password input renders it as dots; it is never sent. */
const SAVED_TOKEN_MASK = "saved-token-mask";

function savedMethod(saved: BitbucketSettings): CredentialMethod | null {
  if (saved.accessToken.length > 0) return "access-token";
  if (saved.email.length > 0 && saved.apiToken.length > 0) return "api-token";
  return null;
}

/**
 * A write-only token field. A saved token shows as a filled password field; typing replaces
 * it, and leaving the field empty restores the saved one. `draft` is null until edited.
 */
function TokenInput({
  id,
  isSaved,
  draft,
  onDraftChange,
}: {
  readonly id: string;
  readonly isSaved: boolean;
  readonly draft: string | null;
  readonly onDraftChange: (draft: string | null) => void;
}) {
  const masked = isSaved && draft === null;
  return (
    <Input
      id={id}
      type="password"
      autoComplete="off"
      size="sm"
      placeholder={isSaved ? undefined : "Not set"}
      value={masked ? SAVED_TOKEN_MASK : (draft ?? "")}
      onFocus={(event) => {
        if (masked) event.target.select();
      }}
      onChange={(event) => {
        const value = event.target.value;
        if (!masked) return onDraftChange(value);
        // Typing at the end of the mask, or deleting into it, starts a fresh token.
        if (value.startsWith(SAVED_TOKEN_MASK))
          return onDraftChange(value.slice(SAVED_TOKEN_MASK.length));
        onDraftChange(SAVED_TOKEN_MASK.startsWith(value) ? "" : value);
      }}
      onBlur={() => {
        if (isSaved && draft === "") onDraftChange(null);
      }}
    />
  );
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
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const current = savedMethod(saved);
  const method = methodChoice ?? current ?? "access-token";
  const methodIsSaved = current === method;
  const email = (emailDraft ?? saved.email).trim();
  const newAccessToken = accessToken?.trim() ?? "";
  const newApiToken = apiToken?.trim() ?? "";
  const info = METHODS[method];

  // Saving one method clears the other, so a hidden credential never wins over the visible one.
  const patch: BitbucketSettings | null =
    method === "access-token"
      ? newAccessToken
        ? { accessToken: newAccessToken, email: "", apiToken: "" }
        : null
      : email && (newApiToken || saved.apiToken)
        ? // Resending the saved token's redacted value keeps it.
          { accessToken: "", email, apiToken: newApiToken || saved.apiToken }
        : null;
  const canSave =
    patch !== null &&
    (method === "access-token" || !methodIsSaved || newApiToken !== "" || email !== saved.email);

  const save = async (next: BitbucketSettings) => {
    setSaving(true);
    try {
      const result = await updateSettings({
        environmentId,
        input: { patch: { bitbucket: next } },
      });
      if (result._tag === "Success") {
        setAccessToken(null);
        setApiToken(null);
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
          <TokenInput
            id={`bitbucket-access-token-${environmentId}`}
            isSaved={methodIsSaved}
            draft={accessToken}
            onDraftChange={setAccessToken}
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
              value={emailDraft ?? saved.email}
              onChange={(event) => setEmailDraft(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`bitbucket-api-token-${environmentId}`}>API token</Label>
            <TokenInput
              id={`bitbucket-api-token-${environmentId}`}
              isSaved={methodIsSaved}
              draft={apiToken}
              onDraftChange={setApiToken}
            />
          </div>
        </>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {current === null
            ? "Without a saved token, the server falls back to its T3CODE_BITBUCKET_* environment variables."
            : methodIsSaved
              ? null
              : `Saving replaces your ${METHODS[current].label.toLowerCase()}.`}
        </p>
        <div className="flex shrink-0 gap-2">
          {current !== null ? (
            <Button
              size="xs"
              variant="outline"
              disabled={saving}
              onClick={() => void save({ accessToken: "", email: "", apiToken: "" })}
            >
              Remove
            </Button>
          ) : null}
          <Button type="submit" size="xs" disabled={!canSave || saving}>
            Save
          </Button>
        </div>
      </div>
    </form>
  );
}
