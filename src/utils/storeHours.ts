// Utilitário para verificar se a loja está aberta com base em horario_funcionamento
// Estrutura esperada:
// { segunda: { aberto: bool, inicio: "HH:MM", fim: "HH:MM" }, ... }
// terca, quarta, quinta, sexta, sabado, domingo

const DAYS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

export interface StoreOpenResult {
  open: boolean;
  message: string;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isStoreOpen(horario: any, now: Date = new Date()): StoreOpenResult {
  if (!horario || typeof horario !== "object") {
    return { open: true, message: "" }; // sem configuração => não bloqueia
  }

  const todayName = DAYS[now.getDay()];
  const yesterdayName = DAYS[(now.getDay() + 6) % 7];
  const today = horario[todayName];
  const yesterday = horario[yesterdayName];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Caso 1: ontem fechou após meia-noite e ainda estamos dentro do expediente de ontem
  if (yesterday?.aberto && yesterday?.inicio && yesterday?.fim) {
    const yIni = toMinutes(yesterday.inicio);
    const yFim = toMinutes(yesterday.fim);
    // fim <= inicio => virou o dia (ex.: 18:00 - 02:00)
    if (yFim <= yIni && nowMin < yFim) {
      return { open: true, message: "" };
    }
  }

  if (!today?.aberto) {
    return {
      open: false,
      message: `O estabelecimento está fechado hoje (${todayName}). Não é possível enviar pedidos.`,
    };
  }

  if (!today.inicio || !today.fim) {
    return { open: true, message: "" };
  }

  const ini = toMinutes(today.inicio);
  const fim = toMinutes(today.fim);

  // horário cruza meia-noite
  if (fim <= ini) {
    if (nowMin >= ini || nowMin < fim) return { open: true, message: "" };
  } else {
    if (nowMin >= ini && nowMin < fim) return { open: true, message: "" };
  }

  return {
    open: false,
    message: `O estabelecimento está fora do horário de funcionamento (${today.inicio} às ${today.fim}). Não é possível enviar pedidos.`,
  };
}
