import type { FinanceData, Txn } from "@/lib/finance";
import { prettyDate, rs } from "@/lib/finance";

export function TxnRow({ t, d, onDelete }: { t: Txn; d: FinanceData; onDelete?: () => void }) {
  const c = d.categories.find((x) => x.id === t.category_id);
  const acc = d.accounts.find((x) => x.id === t.account_id);
  const to = d.accounts.find((x) => x.id === t.to_account_id);
  const income = t.type === "income";
  const transfer = t.type === "transfer";
  const title = t.note || (transfer ? `${acc?.name ?? "Cash"} → ${to?.name ?? ""}` : c?.name ?? (income ? "Income" : "Expense"));
  const sub = [prettyDate(t.occurred_on), transfer ? "Transfer" : c?.name, acc && !transfer ? acc.name : null].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={`grid size-9 shrink-0 place-items-center rounded-[11px] text-[14px] ${income ? "bg-primary/15 text-primary" : "bg-foreground/5"}`}>
        {transfer ? "⇄" : c?.icon ?? (income ? "↙" : "↗")}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{title}</p>
        <p className="truncate text-[11px] text-mist">{sub}</p>
      </div>
      <p className={`num text-[13px] font-semibold ${income ? "text-primary" : transfer ? "text-mist" : "text-foreground"}`}>
        {income ? "+" : transfer ? "" : "−"}
        {rs(Number(t.amount)).replace("−", "")}
      </p>
      {onDelete && (
        <button onClick={onDelete} aria-label="Delete" className="text-[12px] text-mist hover:text-coral">✕</button>
      )}
    </div>
  );
}
