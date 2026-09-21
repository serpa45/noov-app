import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Delete, Calculator, X as XIcon } from "lucide-react";

interface NumericKeypadProps {
  value: string;
  onChange: (v: string) => void;
  total?: number;
}

const formatBR = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseBR = (s: string) => {
  if (!s) return 0;
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

export default function NumericKeypad({ value, onChange, total = 0 }: NumericKeypadProps) {
  const [showCalc, setShowCalc] = useState(false);
  const [people, setPeople] = useState("2");

  const press = (k: string) => {
    if (k === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (k === "clear") {
      onChange("");
      return;
    }
    if (k === ",") {
      if (value.includes(",")) return;
      onChange((value || "0") + ",");
      return;
    }
    onChange((value + k).replace(/^0+(\d)/, "$1"));
  };

  const splitApply = () => {
    const p = Math.max(1, parseInt(people) || 1);
    const v = total / p;
    onChange(formatBR(v));
    setShowCalc(false);
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "back"];

  return (
    <div className="space-y-2 w-full">
      {!showCalc ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setShowCalc(true)}
          >
            <Calculator className="w-4 h-4 mr-1.5" />
            Dividir por pessoa
          </Button>
        </div>
      ) : (
        <div className="bg-muted/40 border border-border rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total: R$ {formatBR(total)}</span>
            <button onClick={() => setShowCalc(false)} className="text-muted-foreground hover:text-foreground">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Pessoas:</label>
            <div className="flex items-center gap-1">
              <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setPeople(String(Math.max(1, (parseInt(people) || 1) - 1)))}>-</Button>
              <input
                inputMode="none"
                readOnly
                value={people}
                className="h-8 w-12 text-center rounded-md border border-input bg-background font-bold text-sm"
              />
              <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setPeople(String((parseInt(people) || 1) + 1))}>+</Button>
            </div>
            <div className="ml-auto text-sm font-bold text-primary">
              R$ {formatBR(total / Math.max(1, parseInt(people) || 1))}
            </div>
          </div>
          <Button type="button" className="w-full h-9" onClick={splitApply}>
            Aplicar valor por pessoa
          </Button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-x-0 gap-y-2 justify-items-center">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className={
              k === "back"
                ? "h-11 w-14 rounded-full bg-white border border-border text-foreground text-lg font-bold flex items-center justify-center shadow-sm active:scale-95 transition"
                : "h-11 w-14 rounded-full bg-gradient-to-b from-orange-400 to-orange-500 text-white text-lg font-bold flex items-center justify-center shadow-md active:scale-95 transition"
            }
          >
            {k === "back" ? <Delete className="w-5 h-5" /> : k}
          </button>
        ))}
      </div>
    </div>
  );
}
