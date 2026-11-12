import type { RightPanelSurface } from "../rightPanelStore";

/**
 * Project actions reuse only an idle drawer terminal (the active one first). Right-panel ids
 * are excluded even when drawer state lists them: reusing one renders a single PTY in both
 * surfaces, and closing the drawer copy kills the panel shell.
 */
export function findReusableProjectScriptTerminal(input: {
  readonly drawerTerminalIds: ReadonlyArray<string>;
  readonly activeTerminalId: string;
  readonly panelTerminalIds: ReadonlySet<string>;
  readonly runningTerminalIds: ReadonlyArray<string>;
}): string | null {
  const idleDrawerTerminalIds = input.drawerTerminalIds.filter(
    (terminalId) =>
      !input.panelTerminalIds.has(terminalId) && !input.runningTerminalIds.includes(terminalId),
  );
  if (idleDrawerTerminalIds.includes(input.activeTerminalId)) return input.activeTerminalId;
  return idleDrawerTerminalIds[0] ?? null;
}

/**
 * Panel actions reuse an idle single-terminal panel surface (the active one first), so a rerun
 * lands in the same tab instead of piling up new ones.
 */
export function findReusablePanelScriptTerminal(input: {
  readonly surfaces: ReadonlyArray<RightPanelSurface>;
  readonly activeSurfaceId: string | null;
  readonly runningTerminalIds: ReadonlyArray<string>;
}): string | null {
  const idle = input.surfaces.filter(
    (surface) =>
      surface.kind === "terminal" &&
      surface.terminalIds.length === 1 &&
      // A surface left with one terminal after a split keeps another id; openTerminal would duplicate it.
      surface.id === `terminal:${surface.activeTerminalId}` &&
      !input.runningTerminalIds.includes(surface.activeTerminalId),
  );
  const match = idle.find((surface) => surface.id === input.activeSurfaceId) ?? idle[0];
  return match?.kind === "terminal" ? match.activeTerminalId : null;
}
