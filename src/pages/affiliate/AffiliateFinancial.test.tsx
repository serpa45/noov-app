import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AffiliateFinancial from "./AffiliateFinancial";
import AdminWithdrawals from "../admin/AdminWithdrawals";

const state = vi.hoisted(() => ({
  mutate: vi.fn(), toast: vi.fn(),
  withdrawals: [] as { id: string; afiliado_id?: string; valor: number; status: string; created_at: string }[],
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "affiliate" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/hooks/useRealtimeSubscription", () => ({ useRealtimeSubscription: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    isLoading: false, isError: false,
    data: queryKey[0] === "afiliado-saques" || queryKey[0] === "admin-saques" ? state.withdrawals : [{
      id: "commission", valor_comissao: 26.22, status: "pendente", percentual: 35,
      afiliado_id: "affiliate", valor_pedido: 74.9, created_at: "2026-10-10T12:00:00Z",
    }],
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: state.mutate, isPending: false }),
}));

beforeEach(() => { state.withdrawals = []; vi.clearAllMocks(); });
afterEach(cleanup);

describe("affiliate withdrawal form", () => {
  it.each(["26,22", "26.22"])("submits the full balance entered as %s", (amount) => {
    render(<AffiliateFinancial />);
    fireEvent.click(screen.getByRole("button", { name: /Solicitar Saque/i }));
    const input = screen.getByRole("textbox", { name: "Valor do saque em reais" });
    expect(input).toHaveAttribute("inputmode", "decimal");
    fireEvent.change(input, { target: { value: amount } });
    fireEvent.click(screen.getAllByRole("button", { name: /Solicitar Saque/i }).slice(-1)[0]);
    expect(state.mutate).toHaveBeenCalledWith(26.22);
  });
  it("rejects amounts with more than two decimal places", () => {
    render(<AffiliateFinancial />);
    fireEvent.click(screen.getByRole("button", { name: /Solicitar Saque/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Valor do saque em reais" }), { target: { value: "26,222" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Solicitar Saque/i }).slice(-1)[0]);
    expect(state.mutate).not.toHaveBeenCalled();
    expect(state.toast).toHaveBeenCalled();
  });
  it("does not show pending commission payment after the withdrawal has been paid", () => {
    state.withdrawals = [{ id: "paid", valor: 26.22, status: "pago", created_at: "2026-10-15T12:00:00Z" }];
    render(<AffiliateFinancial />);
    expect(screen.getByText("Pago")).toBeInTheDocument();
    expect(screen.getByText("Registrada")).toBeInTheDocument();
    expect(screen.queryByText("Pendente")).not.toBeInTheDocument();
  });
  it("clears the administrator's pending totals for a paid withdrawal even when the commission has its old status", () => {
    state.withdrawals = [{ id: "paid", afiliado_id: "affiliate", valor: 26.22, status: "pago", created_at: "2026-10-15T12:00:00Z" }];
    render(<AdminWithdrawals />);
    expect(screen.getByText("Comissão Pendente").parentElement).toHaveTextContent(/0,00/);
    expect(screen.getByText("Total Pendente").parentElement).toHaveTextContent(/0,00/);
    expect(screen.getByText("Nenhum saque pendente.")).toBeInTheDocument();
  });
});
