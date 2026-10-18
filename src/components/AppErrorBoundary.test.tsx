import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AppErrorBoundary from "./AppErrorBoundary";

const mock = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@/utils/errorLogger", () => ({ logStoreError: mock.log }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("records React render failures and gives the user a recovery action", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  function BrokenPage(): never { throw new Error("Render failed"); }
  render(<AppErrorBoundary><BrokenPage /></AppErrorBoundary>);
  expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível exibir esta página.");
  expect(screen.getByRole("button", { name: "Recarregar" })).toBeInTheDocument();
  expect(mock.log).toHaveBeenCalledWith(expect.objectContaining({
    message: "Render failed", metadata: expect.objectContaining({ type: "react_error" }),
  }));
});
