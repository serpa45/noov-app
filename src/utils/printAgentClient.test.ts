import { afterEach, beforeEach, expect, it, vi } from "vitest";
const report = vi.hoisted(() => vi.fn());
vi.mock("@/utils/errorLogger", () => ({ reportAppError: report }));
import { printOrderViaAgent } from "./printAgentClient";
const fetchMock = vi.fn();
beforeEach(() => { vi.clearAllMocks(); fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("does not fall back and duplicate a job after a timeout during POST", async () => {
  fetchMock.mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(new Error("timeout"));
  const result = await printOrderViaAgent({ id: "42" });
  expect(result.ok).toBe(false); expect(result.offline).toBe(false);
  expect(result.error).toContain("confirmar"); expect(report).toHaveBeenCalled();
});
it("distinguishes agent unavailable before sending any job", async () => {
  fetchMock.mockRejectedValueOnce(new Error("refused"));
  const result = await printOrderViaAgent({ id: "42" });
  expect(result.offline).toBe(true); expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("passes the automatic flag for agent deduplication", async () => {
  fetchMock.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
  expect((await printOrderViaAgent({ id: "42" }, undefined, true)).ok).toBe(true);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).automatic).toBe(true);
});
it("reports explicit agent failures instead of success", async () => {
  fetchMock.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: false, error: "USB offline" }) });
  expect((await printOrderViaAgent({ id: "42" })).error).toBe("USB offline");
  expect(report).toHaveBeenCalled();
});

it("retries only preflight when the agent is temporarily unavailable", async () => {
  vi.useFakeTimers();
  fetchMock.mockRejectedValueOnce(new Error("starting"))
    .mockResolvedValueOnce({ ok: true })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
  const result = printOrderViaAgent({ id: "42" }, undefined, true);
  await vi.advanceTimersByTimeAsync(5000);
  expect((await result).ok).toBe(true);
  expect(fetchMock.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1);
});
