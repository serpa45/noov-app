import { useEffect, useState } from "react";

// Brasil x Japão — 29 de junho de 2026 às 14:00 (horário de Brasília, UTC-3)
const TARGET = new Date("2026-07-05T17:00:00-03:00").getTime();

function calc() {
  const diff = TARGET - Date.now();
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s };
}

export const EventCountdown = ({ className }: { className?: string } = {}) => {
  const [t, setT] = useState(calc);

  useEffect(() => {
    const id = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!t) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className={`text-white font-extrabold text-[11px] sm:text-xs leading-none whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${className ?? "absolute right-3 top-7 sm:top-8 z-20 pointer-events-none"}`}>
      {t.d}d {pad(t.h)}:{pad(t.m)}:{pad(t.s)}
    </div>
  );
};
