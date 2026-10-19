import { beforeEach, expect, it, vi } from "vitest";
const files = vi.hoisted(() => ({ content: "{}", writes: [] as string[] }));
vi.mock("node:fs", () => { const fs = {
  existsSync: () => true, mkdirSync: vi.fn(),
  readFileSync: () => files.content,
  writeFileSync: (_: string, value: string) => { files.writes.push(value); },
  renameSync: vi.fn(),
}; return { ...fs, default: fs }; });
vi.mock("../../print-agent/src/config", () => ({ agentHome: () => "C:/test-agent" }));
vi.mock("../../print-agent/src/logger", () => ({ log: { debug: vi.fn(), warn: vi.fn() } }));
import { initState, alreadyPrinted, printState, markPrintState, hasPrintState } from "../../print-agent/src/state";
beforeEach(() => { files.writes = []; });
it("preserves old printed history and distinguishes interrupted sends and pending jobs", () => {
  files.content = JSON.stringify({ old: 1700000000000, interrupted: { status: "sending", at: 1 }, pending: { status: "pending", at: 2 } });
  initState();
  expect(alreadyPrinted("old")).toBe(true);
  expect(printState("interrupted")).toBe("failed");
  expect(printState("pending")).toBe("pending");
  expect(hasPrintState("pending")).toBe(true);
});
it("persists pending and uncertain jobs instead of treating them as printed", () => {
  files.content = "{}"; initState();
  markPrintState("new", "pending");
  expect(JSON.parse(files.writes.at(-1)!).new.status).toBe("pending");
  markPrintState("new", "failed");
  expect(alreadyPrinted("new")).toBe(false);
  expect(JSON.parse(files.writes.at(-1)!).new.status).toBe("failed");
});
