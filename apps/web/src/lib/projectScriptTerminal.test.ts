import { describe, expect, it } from "vite-plus/test";

import type { RightPanelSurface } from "../rightPanelStore";
import {
  findReusablePanelScriptTerminal,
  findReusableProjectScriptTerminal,
} from "./projectScriptTerminal";

describe("findReusableProjectScriptTerminal", () => {
  it.each([
    {
      name: "never reuses a right-panel terminal, even when stale in drawer state",
      drawerTerminalIds: ["term-1"],
      activeTerminalId: "term-1",
      panelTerminalIds: ["term-1"],
      runningTerminalIds: [],
      expected: null,
    },
    {
      name: "reuses the active idle drawer terminal",
      drawerTerminalIds: ["term-1", "term-2"],
      activeTerminalId: "term-2",
      panelTerminalIds: [],
      runningTerminalIds: [],
      expected: "term-2",
    },
    {
      name: "falls back to another idle drawer terminal when the active one is busy",
      drawerTerminalIds: ["term-1", "term-2"],
      activeTerminalId: "term-1",
      panelTerminalIds: [],
      runningTerminalIds: ["term-1"],
      expected: "term-2",
    },
    {
      name: "finds nothing when every drawer terminal is busy",
      drawerTerminalIds: ["term-1"],
      activeTerminalId: "term-1",
      panelTerminalIds: [],
      runningTerminalIds: ["term-1"],
      expected: null,
    },
  ])("$name", ({ panelTerminalIds, expected, ...input }) => {
    expect(
      findReusableProjectScriptTerminal({ ...input, panelTerminalIds: new Set(panelTerminalIds) }),
    ).toBe(expected);
  });
});

const terminalSurface = (id: `terminal:${string}`, terminalIds: string[]): RightPanelSurface => ({
  id,
  kind: "terminal",
  resourceId: terminalIds[0]!,
  terminalIds,
  activeTerminalId: terminalIds[0]!,
});

describe("findReusablePanelScriptTerminal", () => {
  it.each([
    {
      name: "prefers the active idle panel terminal",
      surfaces: [terminalSurface("terminal:a", ["a"]), terminalSurface("terminal:b", ["b"])],
      activeSurfaceId: "terminal:b",
      runningTerminalIds: [],
      expected: "b",
    },
    {
      name: "skips running, split, and renamed surfaces",
      surfaces: [
        terminalSurface("terminal:a", ["a"]),
        terminalSurface("terminal:b", ["b", "c"]),
        terminalSurface("terminal:d", ["e"]),
        terminalSurface("terminal:f", ["f"]),
      ],
      activeSurfaceId: "terminal:a",
      runningTerminalIds: ["a"],
      expected: "f",
    },
    {
      name: "finds nothing when every panel terminal is busy",
      surfaces: [terminalSurface("terminal:a", ["a"])],
      activeSurfaceId: null,
      runningTerminalIds: ["a"],
      expected: null,
    },
  ])("$name", ({ expected, ...input }) => {
    expect(findReusablePanelScriptTerminal(input)).toBe(expected);
  });
});
