import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorLogs from "./ErrorLogs";

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));
const mock = vi.hoisted(() => ({ select: vi.fn(), result: { data: [] as unknown[], error: null as unknown } }));
vi.mock("@/hooks/useRealtimeSubscription", () => ({ useRealtimeSubscription: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ select: mock.select }),
  auth: { getSession: async () => ({ data: { session: { access_token: "user-token" } }, error: null }) },
} }));
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  mock.result = { data: [], error: null };
  mock.select.mockReset().mockImplementation(() => ({ order: () => ({ limit: async () => mock.result }) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ErrorLogs /></QueryClientProvider>);
  return client;
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

it("refreshes both the list and sidebar after a confirmed deletion", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ deleted: 113 }) }));
  const client = show();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  await screen.findByText("Nenhum erro registrado.");
  fireEvent.click(screen.getByRole("button", { name: "Limpar Logs" }));
  await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining("113")));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin-error-logs"] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin-error-logs-count"] });
});
it("shows the permission error without a success notification", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Admin only" }) }));
  show(); await screen.findByText("Nenhum erro registrado.");
  fireEvent.click(screen.getByRole("button", { name: "Limpar Logs" }));
  await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Admin only"));
  expect(toastMock.success).not.toHaveBeenCalled();
});
it("prevents another click while the deletion is pending", async () => {
  let finish!: (value: unknown) => void;
  const fetchMock = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", fetchMock); show(); await screen.findByText("Nenhum erro registrado.");
  fireEvent.click(screen.getByRole("button", { name: "Limpar Logs" }));
  expect(screen.getByRole("button", { name: "Limpando..." })).toBeDisabled();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  finish({ ok: true, json: async () => ({ deleted: 0 }) });
  await waitFor(() => expect(screen.getByRole("button", { name: "Limpar Logs" })).toBeEnabled());
});
