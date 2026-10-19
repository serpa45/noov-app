import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  states: new Map<string, string>(), send: vi.fn(), build: vi.fn(), log: vi.fn(),
}));
vi.mock("../../print-agent/src/state", () => ({
  alreadyPrinted: (key: string) => mocks.states.get(key) === "printed",
  hasPrintState: (key: string) => mocks.states.has(key),
  printState: (key: string) => mocks.states.get(key),
  markPrinted: (key: string) => mocks.states.set(key, "printed"),
  markPrintState: (key: string, state: string) => mocks.states.set(key, state),
}));
vi.mock("../../print-agent/src/transports/index", () => ({ sendBytes: mocks.send }));
vi.mock("../../print-agent/src/documents", () => ({ buildDocument: mocks.build, orderLabel: () => "42" }));
vi.mock("../../print-agent/src/logger", () => ({ log: { warn: mocks.log, debug: mocks.log, info: mocks.log, error: mocks.log } }));
import { printOrder } from "../../print-agent/src/printer";
import { startWatching } from "../../print-agent/src/watcher";
const printer = { name: "Main", enabled: true, transport: "spooler", address: "USB", documents: ["receipt"], copies: 1 };
const config = { printers: [printer], retry: { maxAttempts: 5, delayMs: 1 } } as any;
const order = { id: "order-42" } as any;
beforeEach(() => { vi.clearAllMocks(); mocks.states.clear(); mocks.send.mockResolvedValue(undefined); mocks.build.mockReturnValue(new Uint8Array([1])); });
describe("print agent delivery", () => {
  it("reports a transport failure without pretending success or blindly retrying", async () => {
    mocks.send.mockRejectedValue(new Error("USB disconnected"));
    const result = await printOrder(order, {}, config);
    expect(result.ok).toBe(false); expect(result.sent).toBe(0); expect(result.errors[0]).toContain("USB disconnected");
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.states.get("order-42:Main:receipt")).toBe("failed");
    await printOrder(order, {}, config);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
  it("deduplicates concurrent realtime and poll events", async () => {
    let release!: () => void;
    mocks.send.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    const a = printOrder(order, {}, config); const b = printOrder(order, {}, config);
    await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1)); release();
    const results = await Promise.all([a, b]);
    expect(mocks.send).toHaveBeenCalledTimes(1); expect(results.map(r => r.sent)).toEqual([1, 0]);
    expect(results[1].skipped).toBe(1);
  });
  it("allows an explicit manual reprint of an uncertain job", async () => {
    mocks.states.set("order-42:Main:receipt", "failed");
    const result = await printOrder(order, {}, config, { source: "manual", force: true });
    expect(result.ok).toBe(true); expect(mocks.send).toHaveBeenCalledTimes(1);
  });
  it("leaves document generation failures pending and recoverable", async () => {
    mocks.build.mockImplementationOnce(() => { throw new Error("bad document"); });
    expect((await printOrder(order, {}, config)).ok).toBe(false);
    expect(mocks.states.get("order-42:Main:receipt")).toBe("pending");
    expect((await printOrder(order, {}, config)).ok).toBe(true);
  });
  it("does not claim success when no printer handles the document", async () => {
    const result = await printOrder(order, {}, config, { source: "manual", only: ["kitchen"] });
    expect(result.ok).toBe(false); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("keeps partial copy failures uncertain to avoid duplicating the first copy", async () => {
    mocks.send.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("paper"));
    const cfg = { ...config, printers: [{ ...printer, copies: 2 }] };
    expect((await printOrder(order, {}, cfg)).ok).toBe(false);
    await printOrder(order, {}, cfg);
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });
});

it("does not erase a pending job when seeding history after restart", async () => {
  mocks.states.set("order-42:Main:receipt", "pending");
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({ data: [{ id: "order-42", status: "aceito" }, { id: "old", status: "aceito" }] }) };
  const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
  const session = { userId: "owner", loja: { id: "store" }, client: {
    from: () => query, channel: () => channel, removeChannel: vi.fn().mockResolvedValue(undefined),
  } } as any;
  const stop = await startWatching(session, { ...config, triggerStatus: ["aceito"], pollIntervalMs: 20000 } as any);
  await stop();
  expect(mocks.states.get("order-42:Main:receipt")).toBe("pending");
  expect(mocks.states.get("old:Main:receipt")).toBe("printed");
});
