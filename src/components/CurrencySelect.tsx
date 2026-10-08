import { useState } from "react";
import { CURRENCIES, getCurrency } from "@/lib/currency";
import { BottomSheet } from "./Sheet";

/** Searchable currency picker. `compact` renders a small chip (for inline use next to amounts). */
export function CurrencySelect({ value, onChange, compact, label }: { value: string; onChange: (c: string) => void; compact?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const c = getCurrency(value);
  const list = CURRENCIES.filter((x) => `${x.code} ${x.name} ${x.region} ${x.symbol}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={compact ? "glass-l shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold" : "field flex items-center justify-between text-left"}
        aria-label={label ?? "Currency"}
      >
        <span>{compact ? `${c.symbol} ${c.code}` : `${c.code} — ${c.name}`}</span>
        <span className="ml-1 text-mist">▾</span>
      </button>
      <BottomSheet open={open} onOpenChange={setOpen} title={label ?? "Choose currency"}>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code or country" className="field mb-3" />
        <div className="max-h-[55vh] divide-y divide-foreground/10 overflow-y-auto">
          {list.map((x) => (
            <button
              key={x.code}
              type="button"
              onClick={() => {
                onChange(x.code);
                setOpen(false);
                setQ("");
              }}
              className={`flex w-full items-center gap-3 px-1 py-3 text-left ${x.code === value ? "text-primary" : ""}`}
            >
              <span className="grid size-9 place-items-center rounded-[10px] bg-foreground/5 text-[13px] font-semibold">{x.symbol}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">{x.code} · {x.name}</span>
                <span className="block text-[11px] text-mist">{x.region}</span>
              </span>
              {x.code === value && <span>✓</span>}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
