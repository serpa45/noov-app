import { connect } from "node:net";

/**
 * Impressoras de rede (Ethernet/Wi-Fi) aceitam ESC/POS cru na porta 9100
 * (RAW / JetDirect). Nao exige driver nem software adicional na maquina.
 */
export function printViaNetwork(host: string, port: number, data: Uint8Array, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    let settled = false;

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      err ? reject(err) : resolve();
    };

    socket.setTimeout(timeoutMs);
    socket.on("timeout", () => finish(new Error(`Tempo esgotado ao falar com ${host}:${port}`)));
    socket.on("error", (err) => finish(err instanceof Error ? err : new Error(String(err))));
    socket.on("connect", () => {
      socket.write(Buffer.from(data), (err) => {
        if (err) return finish(err);
        // `end` garante que o buffer foi drenado antes de fechar a conexao.
        socket.end(() => finish());
      });
    });
  });
}
