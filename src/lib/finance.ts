import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Category = Tables<"categories">;
export type Account = Tables<"accounts">;
export type Txn = Tables<"transactions">;
export type Bill = Tables<"bills">;
export type Investment = Tables<"investments">;

export type FinanceData = {
  categories: Category[];
  accounts: Account[];
  transactions: Txn[];
  bills: Bill[];
  investments: Investment[];
};

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const financeQuery = queryOptions({
  queryKey: ["finance"],
  queryFn: async (): Promise<FinanceData> => {
    const [categories, accounts, transactions, bills, investments] = await Promise.all([
      must<Category[]>(supabase.from("categories").select("*").order("name")),
      must<Account[]>(supabase.from("accounts").select("*").order("created_at")),
      must<Txn[]>(
        supabase.from("transactions").select("*").order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(5000),
      ),
      must<Bill[]>(supabase.from("bills").select("*").order("due_day")),
      must<Investment[]>(supabase.from("investments").select("*").order("created_at")),
    ]);
    return { categories, accounts, transactions, bills, investments };
  },
});

export function useFinance() {
  return useSuspenseQuery(financeQuery).data;
}

export function useRefreshFinance() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["finance"] });
}

// ---------- formatting ----------
const nf = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
export function rs(n: number, opts: { sign?: boolean } = {}) {
  const abs = nf.format(Math.abs(Math.round(n)));
  const s = n < 0 ? "−" : opts.sign && n > 0 ? "+" : "";
  return `${s}Rs ${abs}`;
}
export function compactRs(n: number) {
  const a = Math.abs(n);
  const s = n < 0 ? "−" : "";
  if (a >= 10_000_000) return `${s}${(a / 10_000_000).toFixed(1)}Cr`;
  if (a >= 100_000) return `${s}${(a / 100_000).toFixed(1)}L`;
  if (a >= 1000) return `${s}${(a / 1000).toFixed(0)}k`;
  return `${s}${Math.round(a)}`;
}
export function pct(n: number) {
  if (!isFinite(n)) return "—";
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`;
}
export function initials(s: string) {
  return s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}
export const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
export const todayISO = () => toISO(new Date());
export function prettyDate(iso: string) {
  const t = todayISO();
  const y = toISO(new Date(Date.now() - 86400000));
  if (iso === t) return "Today";
  if (iso === y) return "Yesterday";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ---------- calculations ----------
export const LIABILITY_TYPES = ["credit", "loan"];

export function accountBalance(acc: Account, txns: Txn[]) {
  let b = Number(acc.opening_balance);
  for (const t of txns) {
    const a = Number(t.amount);
    if (t.type === "income" && t.account_id === acc.id) b += a;
    else if (t.type === "expense" && t.account_id === acc.id) b -= a;
    else if (t.type === "transfer") {
      if (t.account_id === acc.id) b -= a;
      if (t.to_account_id === acc.id) b += a;
    }
  }
  return b;
}

export function totals(d: FinanceData) {
  const balances = d.accounts.map((a) => ({ acc: a, balance: accountBalance(a, d.transactions) }));
  const cash = balances.reduce((s, x) => s + x.balance, 0);
  const assets = balances.filter((x) => x.balance > 0).reduce((s, x) => s + x.balance, 0);
  const liabilities = balances.filter((x) => x.balance < 0).reduce((s, x) => s + x.balance, 0);
  const invested = d.investments.reduce((s, i) => s + Number(i.invested), 0);
  const portfolio = d.investments.reduce((s, i) => s + Number(i.current_value), 0);
  return { balances, cash, assets, liabilities, invested, portfolio, netWorth: cash + portfolio };
}

export type Period = "month" | "quarter" | "year";

export function periodRange(period: Period, offset = 0, ref = new Date()) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  if (period === "month") {
    const s = new Date(y, m + offset, 1);
    const e = new Date(s.getFullYear(), s.getMonth() + 1, 0);
    return { start: s, end: e, label: s.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) };
  }
  if (period === "quarter") {
    const q = Math.floor(m / 3) + offset;
    const s = new Date(y, q * 3, 1);
    const e = new Date(s.getFullYear(), s.getMonth() + 3, 0);
    return { start: s, end: e, label: `Q${Math.floor(s.getMonth() / 3) + 1} ${s.getFullYear()}` };
  }
  const s = new Date(y + offset, 0, 1);
  return { start: s, end: new Date(s.getFullYear(), 11, 31), label: String(s.getFullYear()) };
}

export function inRange(t: Txn, start: Date, end: Date) {
  return t.occurred_on >= toISO(start) && t.occurred_on <= toISO(end);
}

export function flowSummary(txns: Txn[], start: Date, end: Date) {
  let income = 0, expense = 0;
  for (const t of txns) {
    if (!inRange(t, start, end)) continue;
    if (t.type === "income") income += Number(t.amount);
    if (t.type === "expense") expense += Number(t.amount);
  }
  return { income, expense, net: income - expense };
}

/** Net worth at end of each period, derived backwards from today's net worth. */
export function netWorthSeries(d: FinanceData, period: Period) {
  const { netWorth } = totals(d);
  const count = period === "month" ? 12 : period === "quarter" ? 8 : 5;
  const today = todayISO();
  const points: { label: string; value: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const r = periodRange(period, -i);
    const endISO = toISO(r.end) > today ? today : toISO(r.end);
    let after = 0;
    for (const t of d.transactions) {
      if (t.occurred_on > endISO) {
        if (t.type === "income") after += Number(t.amount);
        if (t.type === "expense") after -= Number(t.amount);
      }
    }
    const label =
      period === "month"
        ? r.start.toLocaleDateString("en-GB", { month: "short" })
        : period === "quarter"
          ? `Q${Math.floor(r.start.getMonth() / 3) + 1}'${String(r.start.getFullYear()).slice(2)}`
          : String(r.start.getFullYear());
    points.push({ label, value: netWorth - after });
  }
  return points;
}

export function categoryBreakdown(d: FinanceData, type: "expense" | "income", start: Date, end: Date) {
  const map = new Map<string, number>();
  for (const t of d.transactions) {
    if (t.type !== type || !inRange(t, start, end)) continue;
    const k = t.category_id ?? "none";
    map.set(k, (map.get(k) ?? 0) + Number(t.amount));
  }
  const total = [...map.values()].reduce((s, v) => s + v, 0);
  return [...map.entries()]
    .map(([id, value]) => {
      const c = d.categories.find((x) => x.id === id);
      return { id, name: c?.name ?? "Uncategorised", icon: c?.icon ?? "•", value, share: total ? value / total : 0 };
    })
    .sort((a, b) => b.value - a.value);
}

export function nextDue(bill: Bill, ref = new Date()) {
  const y = ref.getFullYear(), m = ref.getMonth();
  const make = (yy: number, mm: number) => {
    const last = new Date(yy, mm + 1, 0).getDate();
    return new Date(yy, mm, Math.min(bill.due_day, last));
  };
  let due = make(y, m);
  const step = bill.frequency === "yearly" ? 12 : bill.frequency === "quarterly" ? 3 : 1;
  if (bill.last_paid_on) {
    const paid = new Date(bill.last_paid_on + "T00:00:00");
    while (paid >= new Date(due.getFullYear(), due.getMonth() - step + 1, 1) && paid <= due) {
      due = make(due.getFullYear(), due.getMonth() + step);
    }
    while (due <= paid) due = make(due.getFullYear(), due.getMonth() + step);
  }
  const days = Math.round((due.getTime() - new Date(y, m, ref.getDate()).getTime()) / 86400000);
  return { due, days };
}

export const CHART_COLORS = [
  "var(--accent-teal)",
  "var(--accent-blue)",
  "var(--gold)",
  "var(--coral)",
  "var(--accent-violet)",
  "var(--mist)",
];
