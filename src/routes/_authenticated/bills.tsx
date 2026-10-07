import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, EmptyNote, SectionHead } from "@/components/AppShell";
import { BottomSheet, Field, PrimaryButton } from "@/components/Sheet";
import { supabase } from "@/integrations/supabase/client";
import { financeQuery, initials, nextDue, rs, todayISO, useFinance, useRefreshFinance, type Bill } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/bills")({
  head: () => ({ meta: [{ title: "Bills — Ledger" }, { name: "description", content: "Recurring bills, due dates and payments." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(financeQuery),
  component: () => (
    <AppShell title="Bills">
      <Bills />
    </AppShell>
  ),
  errorComponent: ({ error }) => <div className="p-6 text-coral">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function Bills() {
  const d = useFinance();
  const refresh = useRefreshFinance();
  const [edit, setEdit] = useState<Partial<Bill> | null>(null);
  const [paying, setPaying] = useState<Bill | null>(null);
  const [payAcc, setPayAcc] = useState("");
  const list = d.bills.map((b) => ({ b, ...nextDue(b) })).sort((a, b) => a.days - b.days);
  const monthly = d.bills.reduce((s, b) => s + Number(b.amount) / (b.frequency === "yearly" ? 12 : b.frequency === "quarterly" ? 3 : 1), 0);
  const dueSoon = list.filter((x) => x.days <= 7);
  const expenseCats = d.categories.filter((c) => c.kind === "expense");

  async function save() {
    if (!edit?.name) return toast.error("Name required");
    const row = {
      name: edit.name,
      amount: Number(edit.amount ?? 0),
      due_day: Math.min(31, Math.max(1, Number(edit.due_day ?? 1))),
      frequency: edit.frequency ?? "monthly",
      category_id: edit.category_id || null,
    };
    const { error } = edit.id ? await supabase.from("bills").update(row).eq("id", edit.id) : await supabase.from("bills").insert(row);
    if (error) return toast.error(error.message);
    setEdit(null);
    refresh();
  }
  async function remove(id: string) {
    await supabase.from("bills").delete().eq("id", id);
    setEdit(null);
    refresh();
  }
  async function pay() {
    if (!paying) return;
    const { error } = await supabase.from("transactions").insert({
      type: "expense",
      amount: Number(paying.amount),
      category_id: paying.category_id ?? d.categories.find((c) => c.name === "Utilities")?.id ?? null,
      account_id: payAcc || null,
      note: paying.name,
      occurred_on: todayISO(),
    });
    if (error) return toast.error(error.message);
    await supabase.from("bills").update({ last_paid_on: todayISO() }).eq("id", paying.id);
    toast.success(`${paying.name} paid`);
    setPaying(null);
    refresh();
  }

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="glass rise rounded-[18px] p-4">
          <p className="eyebrow !tracking-[0.16em]">Per month</p>
          <p className="num mt-1 text-[20px] font-semibold">{rs(monthly)}</p>
        </div>
        <div className="glass rise rounded-[18px] p-4">
          <p className="eyebrow !tracking-[0.16em]">Due in 7 days</p>
          <p className="num mt-1 text-[20px] font-semibold text-gold">{rs(dueSoon.reduce((s, x) => s + Number(x.b.amount), 0))}</p>
        </div>
      </div>

      <SectionHead title="All bills" right={<button onClick={() => setEdit({ frequency: "monthly", due_day: 1 })} className="font-semibold text-primary">+ Add bill</button>} />
      {list.length === 0 && <EmptyNote>Add rent, electricity, gas, internet, school fees, subscriptions…</EmptyNote>}
      <div className="glass mt-3 divide-y divide-foreground/10 rounded-[18px]">
        {list.map(({ b, due, days }) => (
          <div key={b.id} className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => setEdit(b)} className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-foreground/5 text-[12px] font-semibold">{initials(b.name)}</button>
            <button onClick={() => setEdit(b)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-[13px] font-medium">{b.name}</p>
              <p className={`text-[11px] ${days < 0 ? "text-coral" : days <= 3 ? "text-gold" : "text-mist"}`}>
                {days < 0 ? `Overdue ${-days}d` : days === 0 ? "Due today" : `Due ${due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`} · <span className="capitalize">{b.frequency}</span>
              </p>
            </button>
            <div className="text-right">
              <p className="num text-[13px] font-semibold">{rs(Number(b.amount))}</p>
              <button
                onClick={() => {
                  setPaying(b);
                  setPayAcc(d.accounts[0]?.id ?? "");
                }}
                className="mt-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary"
              >
                Mark paid
              </button>
            </div>
          </div>
        ))}
      </div>

      <BottomSheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit?.id ? "Edit bill" : "New bill"}>
        {edit && (
          <>
            <Field label="Bill name"><input className="field" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. K-Electric" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (Rs)"><input className="field num" inputMode="decimal" value={edit.amount ?? ""} onChange={(e) => setEdit({ ...edit, amount: e.target.value as unknown as number })} /></Field>
              <Field label="Due day of month"><input className="field num" inputMode="numeric" value={edit.due_day ?? ""} onChange={(e) => setEdit({ ...edit, due_day: e.target.value as unknown as number })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Repeats">
                <select className="field" value={edit.frequency ?? "monthly"} onChange={(e) => setEdit({ ...edit, frequency: e.target.value })}>
                  <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
                </select>
              </Field>
              <Field label="Category">
                <select className="field" value={edit.category_id ?? ""} onChange={(e) => setEdit({ ...edit, category_id: e.target.value })}>
                  <option value="">—</option>
                  {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <PrimaryButton onClick={save}>Save bill</PrimaryButton>
            {edit.id && <button onClick={() => remove(edit.id!)} className="mt-3 w-full text-[13px] text-coral">Delete bill</button>}
          </>
        )}
      </BottomSheet>

      <BottomSheet open={!!paying} onOpenChange={(o) => !o && setPaying(null)} title={`Pay ${paying?.name ?? ""}`}>
        <p className="num mb-4 text-3xl font-semibold">{rs(Number(paying?.amount ?? 0))}</p>
        <Field label="Paid from">
          <select className="field" value={payAcc} onChange={(e) => setPayAcc(e.target.value)}>
            <option value="">— Cash / none —</option>
            {d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <PrimaryButton onClick={pay}>Record payment</PrimaryButton>
      </BottomSheet>
    </>
  );
}
