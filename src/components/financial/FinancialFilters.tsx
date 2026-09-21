import { FilterPeriod } from "@/hooks/useFinancialData";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { format, startOfMonth, endOfMonth, setMonth, setYear } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  period: FilterPeriod;
  setPeriod: (p: FilterPeriod) => void;
  selectedMonth: number;
  setSelectedMonth: (m: number) => void;
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  monthNames: string[];
  yearsList: number[];
  customRange: { from: Date; to: Date };
  setCustomRange: (range: { from: Date; to: Date }) => void;
}

export default function FinancialFilters({
  period,
  setPeriod,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  monthNames,
  yearsList,
  customRange,
  setCustomRange,
}: Props) {
  const baseBtn =
    "px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200";
  const activeBtn =
    "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105";
  const idleBtn =
    "bg-card text-muted-foreground border border-border/50 hover:bg-muted hover:border-primary/30";

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex gap-2 flex-wrap items-center w-full lg:w-auto">
      <button
        onClick={() => setPeriod("today")}
        className={`${baseBtn} ${period === "today" ? activeBtn : idleBtn}`}
      >
        Hoje
      </button>

      <div className="relative">
        <select
          value={period === "custom" ? "custom" : String(selectedMonth)}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "custom") return;
            const m = Number(val);
            setSelectedMonth(m);
            setPeriod("filter");
            if (m >= 0) {
              const base = setYear(setMonth(new Date(), m), selectedYear);
              setCustomRange({ from: startOfMonth(base), to: endOfMonth(base) });
            }
          }}
          className="appearance-none pl-2 pr-6 py-2 rounded-xl text-xs font-medium bg-card text-foreground border border-border/50 hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
        >
          <option value={-1}>Mês: Todos</option>
          {monthNames.map((name, idx) => (
            <option key={idx} value={idx}>
              {name}
            </option>
          ))}
          {period === "custom" && (
            <option value="custom">Personalizado</option>
          )}
        </select>
        <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      </div>

      {(() => {
        const showDates = !(period === "filter" && selectedMonth === -1);
        return (
          <div className="flex gap-2 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs gap-1.5 bg-white text-foreground hover:text-foreground border-border/50 hover:bg-white hover:border-primary/30">
                  <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                  {showDates ? format(customRange.from, "dd/MM/yy") : "--/--/--"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customRange.from}
                  onSelect={(date) => {
                    if (date) {
                      setCustomRange({ ...customRange, from: date });
                      setPeriod("custom");
                    }
                  }}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <span className="text-muted-foreground text-xs">à</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs gap-1.5 bg-white text-foreground hover:text-foreground border-border/50 hover:bg-white hover:border-primary/30">
                  <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                  {showDates ? format(customRange.to, "dd/MM/yy") : "--/--/--"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customRange.to}
                  onSelect={(date) => {
                    if (date) {
                      setCustomRange({ ...customRange, to: date });
                      setPeriod("custom");
                    }
                  }}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        );
      })()}
    </div>
  );
}

