import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ insert: mock.insert }) } }));
beforeEach(() => { vi.resetModules(); mock.insert.mockReset().mockResolvedValue({ error: null }); });

describe("application error capture", () => {
  it("stores diagnostic details and removes URL credentials", async () => {
    const logger = await import("./errorLogger");
    await logger.logStoreError({ message: "Request failed ?token=sensitive", stack: "Bearer secret_value",
      metadata: { type: "query_error", authorization: "secret", source: "orders" } });
    const row = mock.insert.mock.calls[0][0];
    expect(row.message).not.toContain("sensitive");
    expect(row.stack).not.toContain("secret_value");
    expect(row.metadata).toEqual({ type: "query_error", source: "orders" });
    expect(row.url).not.toContain("?");
  });
  it("records circular promise reasons without serializing arbitrary objects", async () => {
    const logger = await import("./errorLogger");
    const reason: Record<string, unknown> = { message: "Unhandled request" }; reason.self = reason;
    logger.reportAppError(reason, "promise_rejection");
    expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({ message: "Unhandled request", metadata: { type: "promise_rejection" } }));
  });
  it("captures window errors before any store is loaded and removes its listeners", async () => {
    const logger = await import("./errorLogger");
    const stop = logger.setupGlobalErrorLogging();
    window.dispatchEvent(new ErrorEvent("error", { message: "Startup failed", error: new Error("Startup failed") }));
    expect(mock.insert).toHaveBeenCalledTimes(1);
    stop();
    window.dispatchEvent(new ErrorEvent("error", { message: "After cleanup" }));
    expect(mock.insert).toHaveBeenCalledTimes(1);
  });
  it("deduplicates repeated failures and attaches the current store", async () => {
    const logger = await import("./errorLogger");
    const clearContext = logger.setErrorLoggingContext({ storeId: "store" });
    await logger.logStoreError({ message: "Repeated failure" });
    await logger.logStoreError({ message: "Repeated failure" });
    expect(mock.insert).toHaveBeenCalledTimes(1);
    expect(mock.insert.mock.calls[0][0].store_id).toBe("store");
    clearContext();
    await logger.logStoreError({ message: "Different page failure" });
    expect(mock.insert.mock.calls[1][0].store_id).toBeUndefined();
  });
});
