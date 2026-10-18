import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SystemMetrics from "./SystemMetrics";

const mock = vi.hoisted(() => ({ fail: false }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/utils/errorLogger", () => ({ errorMessage: (error: Error) => error.message }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; },
  removeChannel: vi.fn(),
} }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "supabase-system-usage") return {
      isLoading: false, isError: mock.fail, error: mock.fail ? new Error("Metrics unavailable") : null, refetch: vi.fn(),
      data: mock.fail ? undefined : {
        generated_at: "2026-10-18T12:00:00Z",
        database: { size_bytes: 1024, size_pretty: "1 KB", tables: 7, rows: 15, columns: 30, top_tables: [] },
        storage: { total_bytes: 0, file_count: 0, by_bucket: [], by_loja: [] },
        counts: { auth_users: 2, lojas: 1, lojas_ativas: 1, produtos: 3, pedidos: 4, pedidos_hoje: 1, clientes: 2 },
        activity: [],
      },
    };
    if (queryKey[0] === "admin-system-metrics") return {
      isLoading: false, isError: false,
      data: mock.fail ? undefined : {
        storage: { totalUsageMB: 0, totalLimitMB: 1024, lojistas: [] },
        counts: { lojistas: 1, activeLojas: [] },
        database: { tables: 7, rows: 15, columns: 30, sizeBytes: 1024, sizePretty: "1 KB" },
      },
    };
    return { data: [], isLoading: false };
  },
}));
beforeEach(() => {
  mock.fail = false; localStorage.clear();
  vi.stubGlobal("ResizeObserver", class {
    observe() {} unobserve() {} disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Supabase system metrics", () => {
  it("shows collection failure instead of an endless spinner or fictional credits", () => {
    mock.fail = true; render(<SystemMetrics />);
    expect(screen.getByRole("alert")).toHaveTextContent("Metrics unavailable");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.queryByText("Carregando métricas do sistema...")).not.toBeInTheDocument();
  });
  it("renders the Supabase statistics without Lovable credits or invented performance", () => {
    render(<SystemMetrics />);
    expect(screen.getByText("Sincronizado com Supabase")).toBeInTheDocument();
    expect(screen.queryByText(/Sincronizado com Lovable/i)).not.toBeInTheDocument();
    expect(screen.queryByText("42ms")).not.toBeInTheDocument();
    expect(screen.queryByText("24/100")).not.toBeInTheDocument();
    expect(screen.getByText("Estatísticas do Banco de Dados")).toBeInTheDocument();
  });
});
