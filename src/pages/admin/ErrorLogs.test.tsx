import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorLogs from "./ErrorLogs";

const mock = vi.hoisted(() => ({ select: vi.fn(), result: { data: [] as unknown[], error: null as unknown } }));
vi.mock("@/hooks/useRealtimeSubscription", () => ({ useRealtimeSubscription: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ select: mock.select }),
} }));
beforeEach(() => {
  localStorage.clear();
  mock.result = { data: [], error: null };
  mock.select.mockReset().mockImplementation(() => ({ order: () => ({ limit: async () => mock.result }) }));
});
afterEach(cleanup);
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ErrorLogs /></QueryClientProvider>);
}

describe("administrator error history", () => {
  it("shows the recorded error using the actual store name column", async () => {
    mock.result.data = [{ id: "1", message: "Payment API failed", lojas: { nome: "Store" }, created_at: "2026-10-18T12:00:00Z", metadata: { type: "query_error" } }];
    show();
    expect(await screen.findByText("Payment API failed")).toBeInTheDocument();
    expect(screen.getByText("Store")).toBeInTheDocument();
    expect(mock.select).toHaveBeenCalledWith("*, lojas(nome)");
    expect(screen.getByText("Detalhes técnicos")).toBeInTheDocument();
  });
  it("shows a query failure rather than claiming no errors were recorded", async () => {
    mock.result.error = new Error("Access denied"); show();
    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
    expect(screen.queryByText("Nenhum erro registrado.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
  it("shows the empty state only after a successful empty response", async () => {
    show();
    await waitFor(() => expect(screen.getByText("Nenhum erro registrado.")).toBeInTheDocument());
  });
});
