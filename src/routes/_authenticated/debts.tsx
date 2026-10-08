import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, EmptyNote, SectionHead } from "@/components/AppShell";
import { BottomSheet, Field, PrimaryButton } from "@/components/Sheet";
import { supabase } from "@/integrations/supabase/client";
import { CurrencySelect } from "@/components/CurrencySelect";
import { useCurrency } from "@/components/CurrencyProvider";
import { getCurrency, usdPerUnit } from "@/lib/currency";

import {
  debtPaid, debtProgress, debtRemaining, financeQuery, money, monthlyEquivalent, nextDue, rs, todayISO, totals, useFinance, useRefreshFinance, type Bill, type Debt,
} from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/debts")({
  head: () => ({ meta: [{ title: "Debts & Loans — Worthfolio" }, { name: "description", content: "Track loans, credit cards and mortgages, record payments and see payoff progress." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(financeQuery),
  component: () => (
    <AppShell title="Debts & Loans">
      <Debts />
    </AppShell>
  ),
  errorComponent: ({ error }) => <div className="p-6 text-coral">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

const TYPES = ["personal loan", "credit card", "mortgage", "car loan", "student loan", "other"];
const FREQ = ["weekly", "biweekly", "monthly", "quarterly", "yearly"];

function Debts() {
  const d = useFinance();
  const refresh = useRefreshFinance();
  const t = totals(d);
  const [edit, setEdit] = useState<Partial<Debt> | null>(null);
  const [paying, setPaying] = useState<Debt | null>(null);
  const [pay, setPay] = useState({ amount: "", account: "", date: todayISO(), note: "" });
  const [open, setOpen] = useState<string | null>(null);
  const cur = useCurrency();

  const monthly = d.debts.filter((x) => debtRemaining(x, d.debtPayments) > 0).reduce((s, x) => s + monthlyEquivalent(Number(x.min_payment), x.frequency), 0);
  const paidTotal = d.debtPayments.reduce((s, p) => s + Number(p.amount), 0);
  const origTotal = d.debts.reduce((s, x) => s + (Number(x.original_amount) || Number(x.starting_balance)), 0);
  const overall = origTotal ? ((origTotal - t.debtTotal) / origTotal) * 100 : 0;
  const due = (x: Debt) => nextDue({ due_day: x.due_day, frequency: x.frequency === "quarterly" || x.frequency === "yearly" ? x.frequency : "monthly", last_paid_on: d.debtPayments.find((p) => p.debt_id === x.id)?.paid_on ?? null } as Bill);

  async function save() {
    if (!edit?.name) { toast.error("Name required"); return; }
    const bal = Number(edit.starting_balance ?? 0);
    const row = {
      name: edit.name,
      debt_type: edit.debt_type ?? "personal loan",
      lender: edit.lender || null,
      original_amount: Number(edit.original_amount || bal),
      starting_balance: bal,
      interest_rate: Number(edit.interest_rate ?? 0),
      min_payment: Number(edit.min_payment ?? 0),
      frequency: edit.frequency ?? "monthly",
      due_day: Math.min(31, Math.max(1, Number(edit.due_day ?? 1))),
      start_date: edit.start_date || null,
      payoff_date: edit.payoff_date || null,
      notes: edit.notes || null,
      currency: edit.currency ?? cur.primary,
    };
    if (row.original_amount < 0 || bal < 0) { toast.error("Amounts can't be negative"); return; }
    const { error } = edit.id ? await supabase.from("debts").update(row).eq("id", edit.id) : await supabase.from("debts").insert(row);
    if (error) { toast.error(error.message); return; }
    toast.success("Debt saved");
    setEdit(null);
    refresh();
  }
  async function remove(id: string) {
    if (!confirm("Delete this debt and its payment history?")) return;
    await supabase.from("debts").delete().eq("id", id);
    setEdit(null);
    refresh();
  }
  async function recordPayment() {
    if (!paying) return;
    const amt = Number(pay.amount);
    const left = debtRemaining(paying, d.debtPayments);
    if (!amt || amt <= 0) { toast.error("Enter an amount"); return; }
    if (amt > left + 0.5) { toast.error(`Only ${money(left, paying.currency)} is left on this debt`); return; }
    const cat = d.categories.find((c) => c.name === "Debt Payment");
    const { data: tx, error: e1 } = await supabase
      .from("transactions")
      .insert({ type: "expense", amount: amt, currency: paying.currency, fx_usd: usdPerUnit(paying.currency), category_id: cat?.id ?? null, account_id: pay.account || null, occurred_on: pay.date, note: pay.note || `${paying.name} payment` })
      .select("id")
      .single();
    if (e1) { toast.error(e1.message); return; }
    const { error } = await supabase.from("debt_payments").insert({ debt_id: paying.id, amount: amt, paid_on: pay.date, transaction_id: tx.id, note: pay.note || null });
    if (error) { toast.error(error.message); return; }
    toast.success("Payment recorded");
    setPaying(null);
    refresh();
  }
  async function deletePayment(id: string, txId: string | null) {
    if (!confirm("Delete this payment? The balance goes back up.")) return;
    await supabase.from("debt_payments").delete().eq("id", id);
    if (txId) await supabase.from("transactions").delete().eq("id", txId);
    refresh();
  }

  return (
    <>
      <div className="glass rise mt-5 rounded-[22px] p-5">
        <p className="eyebrow">Total debt</p>
        <p className="num mt-1 text-[30px] font-semibold text-coral">{rs(t.debtTotal)}</p>
        <div className="mt-3 h-2 rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, overall)}%` }} />
        </div>
        <p className="mt-1.5 text-[12px] text-mist">{Math.round(overall)}% paid off overall</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-foreground/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-mist">Per month</p>
            <p className="num text-[14px] font-semibold">{rs(monthly)}</p>
          </div>
          <div className="rounded-xl bg-foreground/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-mist">Paid so far</p>
            <p className="num text-[14px] font-semibold text-primary">{rs(paidTotal)}</p>
          </div>
        </div>
      </div>

      <SectionHead title="Your debts" right={<button onClick={() => setEdit({ debt_type: "personal loan", frequency: "monthly", due_day: 1 })} className="font-semibold text-primary">+ Add debt</button>} />
      {d.debts.length === 0 && <EmptyNote>Add personal loans, credit cards, car or home financing.</EmptyNote>}
      <div className="mt-3 space-y-3">
        {d.debts.map((x) => {
          const left = debtRemaining(x, d.debtPayments);
          const prog = debtProgress(x, d.debtPayments);
          const nd = due(x);
          const pays = d.debtPayments.filter((p) => p.debt_id === x.id);
          const isOpen = open === x.id;
          return (
            <div key={x.id} className="glass rounded-[18px]">
              <button onClick={() => setOpen(isOpen ? null : x.id)} className="w-full px-4 py-4 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold">{x.name}</p>
                    <p className="text-[11px] capitalize text-mist">{[x.debt_type, x.lender, Number(x.interest_rate) ? `${x.interest_rate}% APR` : null].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="num text-[15px] font-semibold">{money(left, x.currency)}</p>
                    <p className="text-[11px] text-mist">left</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-foreground/10">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${prog}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-mist">
                  <span>{Math.round(prog)}% paid</span>
                  {left > 0 ? (
                    <span className={nd.days < 0 ? "text-coral" : nd.days <= 3 ? "text-gold" : ""}>
                      {money(Number(x.min_payment), x.currency)} due {nd.days < 0 ? `${-nd.days}d ago` : nd.days === 0 ? "today" : nd.due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  ) : (
                    <span className="text-primary">Paid off 🎉</span>
                  )}
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-foreground/10 px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {left > 0 && (
                      <button
                        onClick={() => {
                          setPaying(x);
                          setPay({ amount: String(Math.min(left, Number(x.min_payment) || left)), account: d.accounts[0]?.id ?? "", date: todayISO(), note: "" });
                        }}
                        className="rounded-full bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground"
                      >
                        Record payment
                      </button>
                    )}
                    <button onClick={() => setEdit(x)} className="glass-l rounded-full px-4 py-2 text-[12px]">Edit</button>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                    <Info l="Original" v={money(Number(x.original_amount), x.currency)} />
                    <Info l="Paid" v={money(debtPaid(x, d.debtPayments), x.currency)} />
                    <Info l="Payoff by" v={x.payoff_date ?? "—"} />
                  </div>
                  {x.notes && <p className="mt-2 text-[12px] text-mist">{x.notes}</p>}
                  <p className="eyebrow mt-4 mb-1 !tracking-[0.14em]">Payment history</p>
                  {pays.length === 0 ? (
                    <p className="text-[12px] text-mist">No payments yet.</p>
                  ) : (
                    <div className="divide-y divide-foreground/10">
                      {pays.map((p) => (
                        <div key={p.id} className="flex items-center justify-between py-2 text-[12px]">
                          <span>{p.paid_on}{p.note ? ` · ${p.note}` : ""}</span>
                          <span className="flex items-center gap-3">
                            <span className="num font-semibold">{money(Number(p.amount), x.currency)}</span>
                            <button onClick={() => deletePayment(p.id, p.transaction_id)} aria-label="Delete payment" className="text-mist">✕</button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <BottomSheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit?.id ? "Edit debt" : "New debt"}>
        {edit && (
          <>
            <Field label="Name"><input className="field" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Car financing" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Currency"><CurrencySelect value={edit.currency ?? cur.primary} onChange={(c) => setEdit({ ...edit, currency: c })} /></Field>
              <Field label="Type">
                <select className="field capitalize" value={edit.debt_type ?? ""} onChange={(e) => setEdit({ ...edit, debt_type: e.target.value })}>
                  {TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Lender"><input className="field" value={edit.lender ?? ""} onChange={(e) => setEdit({ ...edit, lender: e.target.value })} placeholder="Bank / person" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Original amount"><Num v={edit.original_amount} on={(v) => setEdit({ ...edit, original_amount: v })} /></Field>
              <Field label="Outstanding now"><Num v={edit.starting_balance} on={(v) => setEdit({ ...edit, starting_balance: v })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Interest % / yr"><Num v={edit.interest_rate} on={(v) => setEdit({ ...edit, interest_rate: v })} /></Field>
              <Field label="Minimum payment"><Num v={edit.min_payment} on={(v) => setEdit({ ...edit, min_payment: v })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Frequency">
                <select className="field capitalize" value={edit.frequency ?? "monthly"} onChange={(e) => setEdit({ ...edit, frequency: e.target.value })}>
                  {FREQ.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Due day of month"><Num v={edit.due_day} on={(v) => setEdit({ ...edit, due_day: v })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date"><input type="date" className="field" value={edit.start_date ?? ""} onChange={(e) => setEdit({ ...edit, start_date: e.target.value })} /></Field>
              <Field label="Payoff by"><input type="date" className="field" value={edit.payoff_date ?? ""} onChange={(e) => setEdit({ ...edit, payoff_date: e.target.value })} /></Field>
            </div>
            <Field label="Notes"><input className="field" value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            {edit.id && <p className="mb-2 text-[11px] text-mist">"Outstanding now" is the balance before any payments recorded here. Payments are subtracted automatically.</p>}
            <PrimaryButton onClick={save}>Save debt</PrimaryButton>
            {edit.id && <button onClick={() => remove(edit.id!)} className="mt-3 w-full text-[13px] text-coral">Delete debt</button>}
          </>
        )}
      </BottomSheet>

      <BottomSheet open={!!paying} onOpenChange={(o) => !o && setPaying(null)} title={`Pay ${paying?.name ?? ""}`}>
        <Field label={`Amount (${paying?.currency ?? ""})`}><input className="field num text-2xl" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value.replace(/[^\d.]/g, "") })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid from">
            <select className="field" value={pay.account} onChange={(e) => setPay({ ...pay, account: e.target.value })}>
              <option value="">— Cash / none —</option>
              {d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Date"><input type="date" className="field" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
        </div>
        <Field label="Note"><input className="field" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></Field>
        <p className="mb-2 text-[11px] text-mist">This also records an expense in your ledger.</p>
        <PrimaryButton onClick={recordPayment}>Record payment</PrimaryButton>
      </BottomSheet>
    </>
  );
}

function Info({ l, v }: { l: string; v: string }) {
  return (
    <div className="rounded-xl bg-foreground/5 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-[0.12em] text-mist">{l}</p>
      <p className="num font-semibold">{v}</p>
    </div>
  );
}

export function Num({ v, on }: { v: number | null | undefined; on: (v: number) => void }) {
  return <input className="field num" inputMode="decimal" value={v ?? ""} onChange={(e) => on(e.target.value.replace(/[^\d.]/g, "") as unknown as number)} />;
}
