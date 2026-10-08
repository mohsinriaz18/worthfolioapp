import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { convert, convertTxn, fmtMoney, fx } from "./currency";

export type Category = Tables<"categories">;
export type Account = Tables<"accounts">;
export type Txn = Tables<"transactions">;
export type Bill = Tables<"bills">;
export type Investment = Tables<"investments">;
export type InvestmentValue = Tables<"investment_values">;
export type Debt = Tables<"debts">;
export type DebtPayment = Tables<"debt_payments">;
export type Goal = Tables<"goals">;
export type GoalContribution = Tables<"goal_contributions">;

export type FinanceData = {
  categories: Category[];
  accounts: Account[];
  transactions: Txn[];
  bills: Bill[];
  investments: Investment[];
  investmentValues: InvestmentValue[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  goals: Goal[];
  goalContributions: GoalContribution[];
};

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const financeQuery = queryOptions({
  queryKey: ["finance"],
  queryFn: async (): Promise<FinanceData> => {
    const [categories, accounts, transactions, bills, investments, investmentValues, debts, debtPayments, goals, goalContributions] = await Promise.all([
      must<Category[]>(supabase.from("categories").select("*").order("name")),
      must<Account[]>(supabase.from("accounts").select("*").order("created_at")),
      must<Txn[]>(
        supabase.from("transactions").select("*").order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(5000),
      ),
      must<Bill[]>(supabase.from("bills").select("*").order("due_day")),
      must<Investment[]>(supabase.from("investments").select("*").order("created_at")),
      must<InvestmentValue[]>(supabase.from("investment_values").select("*").order("recorded_on")),
      must<Debt[]>(supabase.from("debts").select("*").order("created_at")),
      must<DebtPayment[]>(supabase.from("debt_payments").select("*").order("paid_on", { ascending: false })),
      must<Goal[]>(supabase.from("goals").select("*").order("created_at")),
      must<GoalContribution[]>(supabase.from("goal_contributions").select("*").order("contributed_on", { ascending: false })),
    ]);
    return { categories, accounts, transactions, bills, investments, investmentValues, debts, debtPayments, goals, goalContributions };
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
/** Format an amount already in the current display currency. */
export function rs(n: number, opts: { sign?: boolean } = {}) {
  return fmtMoney(n, fx().display, opts);
}
/** Format an amount in its own original currency. */
export function money(n: number, code: string, opts: { sign?: boolean } = {}) {
  return fmtMoney(n, code, opts);
}
/** Transaction amount converted to the display currency (uses the rate saved with the entry). */
export function txnAmt(t: Txn, to?: string) {
  return convertTxn(Number(t.amount), t.currency, t.fx_usd, to);
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
    if (t.account_id !== acc.id && t.to_account_id !== acc.id) continue;
    const a = txnAmt(t, acc.currency);
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
  // balance = native account currency; display = converted to display currency
  const balances = d.accounts.map((a) => {
    const balance = accountBalance(a, d.transactions);
    return { acc: a, balance, display: convert(balance, a.currency) };
  });
  const cash = balances.reduce((s, x) => s + x.display, 0);
  const assets = balances.filter((x) => x.display > 0).reduce((s, x) => s + x.display, 0);
  const liabilities = balances.filter((x) => x.display < 0).reduce((s, x) => s + x.display, 0);
  const invested = d.investments.reduce((s, i) => s + convert(Number(i.invested), i.currency), 0);
  const portfolio = d.investments.reduce((s, i) => s + convert(Number(i.current_value), i.currency), 0);
  const debtTotal = d.debts.reduce((s, x) => s + convert(debtRemaining(x, d.debtPayments), x.currency), 0);
  const totalAssets = assets + portfolio;
  const totalLiabilities = -liabilities + debtTotal; // positive number
  const goalTarget = d.goals.reduce((s, g) => s + convert(Number(g.target_amount), g.currency), 0);
  const goalSaved = d.goals.reduce((s, g) => s + convert(goalSavedAmount(g, d.goalContributions), g.currency), 0);
  return {
    balances, cash, assets, liabilities, invested, portfolio, debtTotal, totalAssets, totalLiabilities,
    gain: portfolio - invested, gainPct: invested ? ((portfolio - invested) / invested) * 100 : 0,
    goalTarget, goalSaved, goalPct: goalTarget ? (goalSaved / goalTarget) * 100 : 0,
    netWorth: totalAssets - totalLiabilities,
  };
}

// ---------- debts ----------
export function debtPaid(debt: Debt, payments: DebtPayment[]) {
  return payments.filter((p) => p.debt_id === debt.id).reduce((s, p) => s + Number(p.amount), 0);
}
export function debtRemaining(debt: Debt, payments: DebtPayment[]) {
  return Math.max(0, Number(debt.starting_balance) - debtPaid(debt, payments));
}
export function debtProgress(debt: Debt, payments: DebtPayment[]) {
  const orig = Number(debt.original_amount) || Number(debt.starting_balance);
  if (!orig) return 100;
  return Math.min(100, ((orig - debtRemaining(debt, payments)) / orig) * 100);
}
export function monthlyEquivalent(amount: number, frequency: string) {
  return frequency === "weekly" ? (amount * 52) / 12 : frequency === "biweekly" ? (amount * 26) / 12 : frequency === "quarterly" ? amount / 3 : frequency === "yearly" ? amount / 12 : amount;
}

// ---------- goals ----------
export function goalSavedAmount(goal: Goal, contribs: GoalContribution[]) {
  return Math.max(0, contribs.filter((c) => c.goal_id === goal.id).reduce((s, c) => s + Number(c.amount), 0));
}
export function goalStatus(goal: Goal, contribs: GoalContribution[], ref = new Date()) {
  const saved = goalSavedAmount(goal, contribs);
  const target = Number(goal.target_amount);
  const remaining = Math.max(0, target - saved);
  const pctDone = target ? Math.min(100, (saved / target) * 100) : 0;
  let perMonth = 0, perWeek = 0, onTrack: boolean | null = null;
  if (goal.target_date && remaining > 0) {
    const end = new Date(goal.target_date + "T00:00:00");
    const days = Math.max(1, (end.getTime() - ref.getTime()) / 86400000);
    perMonth = remaining / Math.max(1, days / 30.44);
    perWeek = remaining / Math.max(1, days / 7);
    const start = new Date(goal.created_at);
    const total = Math.max(1, end.getTime() - start.getTime());
    const expected = Math.min(1, (ref.getTime() - start.getTime()) / total) * target;
    onTrack = saved >= expected * 0.95;
    if (days <= 1) onTrack = false;
  } else if (remaining === 0) onTrack = true;
  return { saved, target, remaining, pctDone, perMonth, perWeek, onTrack };
}

// ---------- investments ----------
export function investmentHistory(d: FinanceData, count = 12) {
  // portfolio value at end of each of the last `count` months using recorded value updates
  const out: { label: string; value: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const r = periodRange("month", -i);
    const end = toISO(r.end);
    let v = 0;
    for (const inv of d.investments) {
      const hist = d.investmentValues.filter((h) => h.investment_id === inv.id && h.recorded_on <= end);
      const last = hist[hist.length - 1];
      if (last) v += convert(Number(last.value), inv.currency);
    }
    out.push({ label: r.start.toLocaleDateString("en-GB", { month: "short" }), value: v });
  }
  return out;
}

export type Period = "week" | "month" | "quarter" | "year";

export function periodRange(period: Period, offset = 0, ref = new Date()) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  if (period === "week") {
    const day = (ref.getDay() + 6) % 7; // Monday start
    const s = new Date(y, m, ref.getDate() - day + offset * 7);
    const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6);
    const f = (x: Date) => x.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return { start: s, end: e, label: `${f(s)} – ${f(e)} ${e.getFullYear()}` };
  }
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
    if (t.type === "income") income += txnAmt(t);
    if (t.type === "expense") expense += txnAmt(t);
  }
  return { income, expense, net: income - expense };
}

/** Net worth at end of each period, derived backwards from today's net worth. */
export function netWorthSeries(d: FinanceData, period: Period) {
  const { netWorth } = totals(d);
  const count = period === "week" ? 12 : period === "month" ? 12 : period === "quarter" ? 8 : 5;
  const today = todayISO();
  const points: { label: string; value: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const r = periodRange(period, -i);
    const endISO = toISO(r.end) > today ? today : toISO(r.end);
    let after = 0;
    for (const t of d.transactions) {
      if (t.occurred_on > endISO) {
        if (t.type === "income") after += txnAmt(t);
        if (t.type === "expense") after -= txnAmt(t);
      }
    }
    // debt repaid after this date was still owed then
    for (const p of d.debtPayments) {
      if (p.paid_on <= endISO) continue;
      const debt = d.debts.find((x) => x.id === p.debt_id);
      after += convert(Number(p.amount), debt?.currency ?? fx().display);
    }
    // investment value changes after this date
    for (const inv of d.investments) {
      const hist = d.investmentValues.filter((h) => h.investment_id === inv.id && h.recorded_on <= endISO);
      const then = hist.length ? Number(hist[hist.length - 1]!.value) : 0;
      after += convert(Number(inv.current_value) - then, inv.currency);
    }
    const label =
      period === "week"
        ? r.start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
        : period === "month"
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
    map.set(k, (map.get(k) ?? 0) + txnAmt(t));
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
