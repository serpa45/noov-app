import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SupabaseQuotaMonitor } from "./SupabaseQuotaMonitor";
const mock = vi.hoisted(() => ({ request: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/utils/supabaseQuotaReadings", () => ({ requestQuotaReading: mock.request }));
vi.mock("sonner", () => ({ toast: { success: mock.success, error: mock.error } }));
beforeEach(() => { vi.clearAllMocks(); mock.request.mockReset().mockResolvedValue({ snapshot: null }); });
afterEach(cleanup);
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><SupabaseQuotaMonitor /></QueryClientProvider>);
}
async function openForm() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Registrar consumo" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Registrar consumo" }));
}
function fillCycle() {
  const now = new Date();
  fireEvent.change(screen.getByLabelText("Primeiro dia do ciclo"), { target: { value: now.toISOString().slice(0, 7) + "-01" } });
  fireEvent.change(screen.getByLabelText("Último dia do ciclo"), { target: { value: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10) } });
}
it("shows separate cached egress and honest missing readings instead of zero meters", async () => {
  show();
  expect(screen.getByText("Saída de dados em cache")).toBeInTheDocument();
  expect(screen.getByText("Saída de dados sem cache")).toBeInTheDocument();
  expect(screen.getByText(/Consumo de cobrança não coletado automaticamente/)).toBeInTheDocument();
  expect(screen.getAllByText("Sem leitura").length).toBeGreaterThan(1);
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  await waitFor(() => expect(mock.request).toHaveBeenCalled());
});
it("persists explicit zero and Brazilian decimals as a shared manual reading", async () => {
  mock.request.mockImplementation(async (_project, snapshot) => ({ snapshot: snapshot || null }));
  show(); await openForm(); fillCycle();
  fireEvent.change(screen.getByLabelText("Consumo: Saída de dados em cache"), { target: { value: "225,5" } });
  fireEvent.change(screen.getByLabelText("Consumo: Saída de dados sem cache"), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar leitura compartilhada" }));
  await waitFor(() => expect(mock.success).toHaveBeenCalled());
  const saved = mock.request.mock.calls.find(call => call[1])![1];
  expect(saved.values).toEqual({ cached_egress: 225.5, egress: 0 });
  expect(saved.plan).toBe("pro"); expect(screen.getByText("Crítico")).toBeInTheDocument();
  expect(screen.getByText("225,5 GB")).toBeInTheDocument();
});
it("does not claim persistence after a server failure", async () => {
  mock.request.mockImplementation(async (_project, snapshot) => { if (snapshot) throw new Error("Storage unavailable"); return { snapshot: null }; });
  show(); await openForm(); fillCycle();
  fireEvent.change(screen.getByLabelText("Consumo: Saída de dados em cache"), { target: { value: "240" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar leitura compartilhada" }));
  await waitFor(() => expect(mock.error).toHaveBeenCalledWith("Storage unavailable"));
  expect(mock.success).not.toHaveBeenCalled(); expect(screen.getByRole("dialog")).toBeInTheDocument();
});
it("shows load failure explicitly and prevents overwriting an unread shared record", async () => {
  mock.request.mockRejectedValue(new Error("Unavailable")); show();
  expect(await screen.findByRole("alert")).toHaveTextContent("Unavailable");
  expect(screen.getByRole("button", { name: "Registrar consumo" })).toBeDisabled();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});
it("clears consumption inputs when switching the billing cycle", async () => {
  show(); await openForm(); fillCycle();
  fireEvent.change(screen.getByLabelText("Consumo: Saída de dados em cache"), { target: { value: "230" } });
  fireEvent.change(screen.getByLabelText("Primeiro dia do ciclo"), { target: { value: "2026-01-01" } });
  expect(screen.getByLabelText("Consumo: Saída de dados em cache")).toHaveValue("");
});
