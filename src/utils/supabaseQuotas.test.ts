import { describe, expect, it } from "vitest";
import { parseQuotaNumber, quotaMetrics, quotaStatus, validateQuotaSnapshot, type QuotaSnapshot } from "./supabaseQuotas";
const now = new Date("2026-11-13T12:00:00Z");
const base: QuotaSnapshot = { version: 1, projectRef: "project", plan: "pro", cycleStart: "2026-11-02", cycleEnd: "2026-12-01", readAt: now.toISOString(), values: {}, limits: {} };
const egress = quotaMetrics.find(m => m.id === "egress")!;
describe("Pro quota monitoring", () => {
  it("keeps cached and uncached egress as independent 250 GB references", () => {
    const reading = { ...base, values: { cached_egress: 260, egress: 10 } };
    expect(quotaStatus(egress, reading, now).state).toBe("Dentro da referência");
    expect(quotaStatus(quotaMetrics[1], reading, now).state).toBe("Franquia atingida");
    expect(egress.limit).toBe(250); expect(quotaMetrics[1].limit).toBe(250);
  });
  it("does not treat missing measurements as zero or healthy", () => {
    expect(quotaStatus(egress, null, now)).toMatchObject({ value: undefined, percent: null, state: "Sem leitura" });
    expect(quotaStatus(egress, base, now).state).toBe("Sem leitura");
    expect(quotaStatus(egress, { ...base, values: { egress: 0 } }, now).state).toBe("Dentro da referência");
  });
  it.each([[200, "Atenção"], [225, "Crítico"], [250, "Franquia atingida"], [300, "Franquia atingida"]])("flags %s GB as %s", (value, state) => {
    expect(quotaStatus(egress, { ...base, values: { egress: value as number } }, now).state).toBe(state);
  });
  it("marks old readings and cycles instead of silently resetting consumption", () => {
    const reading = { ...base, values: { egress: 10 }, readAt: "2026-11-11T10:00:00Z" };
    expect(quotaStatus(egress, reading, now).state).toBe("Leitura antiga");
    expect(quotaStatus(egress, reading, new Date("2026-12-02T12:00:00Z"))).toMatchObject({ value: 10, percent: null, state: "Outro ciclo" });
  });
  it("supports explicitly configured quotas and distinguishes provisioned resources", () => {
    expect(quotaStatus(egress, { ...base, values: { egress: 200 }, limits: { egress: 500 } }, now).percent).toBe(40);
    const disk = quotaMetrics.find(m => m.id === "disk")!;
    expect(quotaStatus(disk, { ...base, values: { disk: 8 } }, now).state).toBe("Configuração na referência");
    expect(quotaStatus(disk, { ...base, values: { disk: 9 } }, now).state).toBe("Acima da referência");
  });
  it("does not invent a fixed allowance for variable quotas", () => {
    const metric = quotaMetrics.find(m => m.id === "logs_query")!;
    expect(quotaStatus(metric, { ...base, values: { logs_query: 100 } }, now)).toMatchObject({ limit: null, percent: null, state: "Sem franquia fixa" });
  });
  it("parses Brazilian decimals and rejects negative, non-finite or ambiguous values", () => {
    expect(parseQuotaNumber("250,25")).toBe(250.25); expect(parseQuotaNumber("0")).toBe(0); expect(parseQuotaNumber(" ")).toBeUndefined();
    for (const bad of ["-1", "NaN", "Infinity", "1.000,50", "1e8"]) expect(() => parseQuotaNumber(bad)).toThrow();
  });
  it("rejects cross-project imports, invalid dates, fractions of people and future readings", () => {
    for (const value of [{ ...base, projectRef: "other" }, { ...base, cycleEnd: "2026-02-30" }, { ...base, cycleStart: "2027-01-01" },
      { ...base, values: { mau: 2.5 } }, { ...base, values: { egress: -1 } }, { ...base, limits: { egress: 0 } },
      { ...base, readAt: "2027-01-01T00:00:00Z" }, { ...base, values: [] }]) {
      expect(() => validateQuotaSnapshot(value, "project", now)).toThrow();
    }
    expect(validateQuotaSnapshot({ ...base, values: { egress: 25, arbitrary: "ignored" } }, "project", now).values).toEqual({ egress: 25 });
  });
});
