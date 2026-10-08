# T3 Code

## Fork changes

This fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code) adds the following
behavior on top of upstream:

- **Per-project worktree locations.** In **Settings → Project → New threads → Project
  worktree location**, choose a base folder for each project. Relative paths such as
  `.worktrees` start at the project checkout; absolute paths and `~/…` are also supported.
  New worktrees get a branch-named subfolder, with `/` in branch names replaced by `-`.
  Leaving the setting empty inherits the environment's worktree location. The setting is
  available on web, desktop, and mobile and applies to new threads, manual creation, pull
  request worktrees, MCP tools, and scheduled tasks. Review diffs and automatic cleanup
  support these folders; existing worktrees stay where they are.
- **Select an existing workspace folder.** Before starting a thread on web or desktop,
  choose **Workspace → Select folder…** to browse to an existing checkout or worktree.
  Both the full and compact workspace menus, and the thread details panel, support this.
  Browsing happens on the selected environment, including remote servers. The picker
  checks that the folder belongs to a source control repository and uses its current branch.
  Choosing the project checkout again clears the selected worktree.
- **Temporary branches without a namespace.** New temporary worktree branches use
  `worktree-<8 hex>` instead of `t3/<8 hex>` or `t3code/<8 hex>`. Legacy temporary branch
  names remain recognized so existing threads can still receive generated branch names.
- **Optional default expansion for thinking and tools.** Enable **Expand thinking by
  default** and **Expand tool output by default** in **Settings → General** on web and
  desktop, or **Settings → Thread behavior** on mobile. These device preferences open
  thinking traces and tool commands/output automatically. Both are off by default, and
  individual items can still be collapsed.
- **Expansion preferences after completed turns.** Default expansion also applies to
  completed turns and their grouped work. Finishing a turn does not hide the thinking or
  tool output enabled by those preferences; groups and individual items can still be
  collapsed and reopened.

### Earlier fork changes now provided by upstream

- **Generated branch names without a prefix.** Our original patch is now covered by
  **Settings → Source control → Worktree branch naming → Static prefix**. Clear
  **Branch prefix** to generate names without `t3/`. This requires configuring the
  setting; upstream's default still adds the prefix.
- **Full output for expanded tool calls.** Upstream now loads the full saved command and
  output when a tool call is expanded, replacing our original patch.

The installation links below install upstream builds. To use these fork changes, build
this checkout; see [Desktop artifacts](docs/operations/development.md#desktop-artifacts).

---

T3 Code is an "agent harness control surface". It enables control of the agents on your machine with a best-in-class mobile app ([iOS](https://apps.apple.com/us/app/t3-code-remote-claude-more/id6787819824), [Android](https://play.google.com/store/apps/details?id=com.t3tools.t3code)), [web app](https://app.t3.codes) and [Electron-based desktop app](https://t3.codes).

Works with your subscriptions on Claude Code, Codex, Cursor, Grok Build, OpenCode, and Google Antigravity. If they're set up on your computer, T3 Code can control them.

## "Wait, what are you selling me?"

Nothing. We built T3 Code because we wanted the best possible development experience with agents. We were inspired by existing solutions like the Codex desktop app, Conductor, Claude Desktop and Cursor Glass, but none met our bar.

We wanted something performant, remote-ready, and truly open. If we ever go the wrong direction, we want you to have everything you need to fork and build the editor that you want.

## Installation

> [!WARNING]
> T3 Code currently supports Codex, Claude, Cursor, Grok Build, OpenCode, and Antigravity. Install and authenticate at least one provider before use:
>
> - Codex: install [Codex CLI](https://developers.openai.com/codex/cli) and run `codex login`
> - Claude: install [Claude Code](https://claude.com/product/claude-code) and run `claude auth login`
> - Cursor: install [Cursor CLI](https://cursor.com/cli) and run `agent login`
> - Grok Build: install [Grok Build CLI](https://x.ai/cli) and run `grok login`
> - OpenCode: install [OpenCode](https://opencode.ai) and run `opencode auth login`
> - Antigravity: enable it in Settings, then use **Install Antigravity** and **Sign in with Google**. No CLI is required.

### Command line

```bash
curl -fsSL https://t3.codes/install.sh | sh
```

On Windows, in PowerShell:

```powershell
irm https://t3.codes/install.ps1 | iex
```

Then run `t3` to start the server and open the local web app. `t3 service install` keeps it running in the background, `t3 update` moves to a newer release, and `t3 --help` has the full reference.

To try it once without installing, run `npx t3@latest` instead.

### Desktop app

Install the latest version of the desktop app from [GitHub Releases](https://github.com/pingdotgg/t3code/releases), or from your favorite package registry:

#### Windows (`winget`)

```bash
winget install T3Tools.T3Code
```

#### macOS (Homebrew)

```bash
brew install --cask t3-code
```

#### Debian, Ubuntu (`.deb`)

Download the `.deb` from [GitHub Releases](https://github.com/pingdotgg/t3code/releases), then:

```bash
sudo apt install ./T3-Code-*.deb
```

#### Arch Linux (AUR)

Stable:

```bash
yay -S t3code-bin
```

Nightly:

```bash
yay -S t3code-nightly-bin
```

The AUR packaging is maintained in this repository under [`packaging/aur`](./packaging/aur).

## Some notes

We are very very early in this project. Expect bugs.

We are (mostly) not accepting contributions yet. Small fixes may be considered. Big features will not be.

## Documentation

Full docs live in [docs/](./docs). There's no docs site yet.

- [Install and first run](./docs/user/install.md)
- [Permission modes](./docs/user/permission-modes.md)
- [Keyboard shortcuts](./docs/user/keybindings.md)
- [Project settings](./docs/user/project-settings.md)
- [Appearance preferences](./docs/user/appearance.md)
- [Remote access from a phone or another machine](./docs/user/remote-access.md)
- [Connect Claude Code, Codex, ChatGPT and other agents over MCP](./docs/user/outside-agents.md)
- [Keeping app and server in sync](./docs/user/updating.md)
- [Source control integrations](./docs/user/source-control.md)
- Multiple accounts: [Codex](./docs/user/providers-codex.md) · [Claude](./docs/user/providers-claude.md)
- [Run T3 Code as a background service](./docs/user/background-service.md)

Building from source? Start at [docs/internals/overview.md](./docs/internals/overview.md).

## If you REALLY want to contribute still.... read this first

### Install `vp`

T3 Code uses Vite+ so you'll need to install the global `vp` command-line tool.

#### macOS / Linux

```bash
curl -fsSL https://vite.plus | bash
```

#### Windows

```bash
irm https://vite.plus/ps1 | iex
```

Checkout their getting started guide for more information: https://viteplus.dev/guide/

### Install dependencies

```bash
vp i
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before reporting a bug or opening a PR.

Have a feature request? Start an [Ideas discussion](https://github.com/pingdotgg/t3code/discussions/categories/ideas).

Need support? Join the [Discord](https://discord.gg/jn4EGJjrvv).
