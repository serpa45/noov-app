import { Component, type ErrorInfo, type ReactNode } from "react";
import { logStoreError } from "@/utils/errorLogger";

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    void logStoreError({ message: error.message, stack: error.stack,
      metadata: { type: "react_error", componentStack: info.componentStack } });
  }
  render() {
    if (this.state.failed) return <main className="p-8" role="alert">
      <h1>Não foi possível exibir esta página.</h1>
      <p>Tente recarregar a página para continuar.</p>
      <button className="underline" onClick={() => window.location.reload()}>Recarregar</button>
    </main>;
    return this.props.children;
  }
}
