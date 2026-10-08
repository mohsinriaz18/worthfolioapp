import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, EmptyNote, SectionHead } from "@/components/AppShell";
import { BottomSheet, Field, PrimaryButton } from "@/components/Sheet";
import { TxnRow } from "@/components/TxnRow";
import { CurrencySelect } from "@/components/CurrencySelect";
import { useCurrency } from "@/components/CurrencyProvider";

import { supabase } from "@/integrations/supabase/client";
import { financeQuery, money, rs, totals, useFinance, useRefreshFinance, type Account } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({ meta: [{ title: "Bank accounts — Worthfolio" }, { name: "description", content: "All your bank accounts, wallets and cards with live balances." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(financeQuery),
  component: () => (
    <AppShell title="Accounts">
      <Accounts />
    </AppShell>
  ),
  errorComponent: ({ error }) => <div className="p-6 text-coral">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

const TYPES = ["checking", "savings", "current", "wallet", "cash", "credit", "loan"];

function Accounts() {
  const d = useFinance();
  const refresh = useRefreshFinance();
  const t = totals(d);
  const [edit, setEdit] = useState<Partial<Account> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const cur = useCurrency();

  async function save() {
    if (!edit?.name) { toast.error("Name required"); return; }
    const row = {
      name: edit.name,
      bank: edit.bank || null,
      account_type: edit.account_type ?? "checking",
      last4: edit.last4 || null,
      opening_balance: Number(edit.opening_balance ?? 0),
      currency: edit.currency ?? cur.primary,
    };
    const { error } = edit.id ? await supabase.from("accounts").update(row).eq("id", edit.id) : await supabase.from("accounts").insert(row);
    if (error) { toast.error(error.message); return; }
    toast.success("Account saved");
    setEdit(null);
    refresh();
  }
  async function remove(id: string) {
    if (!confirm("Delete this account and all its transactions?")) return;
    await supabase.from("accounts").delete().eq("id", id);
    setEdit(null);
    refresh();
  }

  return (
    <>
      <div className="glass rise mt-5 rounded-[22px] p-5">
        <p className="eyebrow">Total across accounts</p>
        <p className="num mt-1 text-[30px] font-semibold">{rs(t.cash)}</p>
        <div className="mt-3 flex gap-4 text-[12px]">
          <span className="text-primary">Assets {rs(t.assets)}</span>
          <span className="text-coral">Owed {rs(t.liabilities)}</span>
        </div>
      </div>

      <SectionHead title="Your accounts" right={<button onClick={() => setEdit({ account_type: "checking" })} className="font-semibold text-primary">+ Add account</button>} />
      {t.balances.length === 0 && <EmptyNote>Add your bank accounts, JazzCash/Easypaisa wallets, cash and credit cards.</EmptyNote>}
      <div className="mt-3 space-y-3">
        {t.balances.map(({ acc, balance }) => {
          const txns = d.transactions.filter((x) => x.account_id === acc.id || x.to_account_id === acc.id);
          const open = selected === acc.id;
          return (
            <div key={acc.id} className="glass rounded-[18px]">
              <button onClick={() => setSelected(open ? null : acc.id)} className="flex w-full items-center gap-3 px-4 py-4 text-left">
                <div className="grid size-10 place-items-center rounded-[12px] bg-primary/15 text-[13px] font-bold text-primary">{acc.name.slice(0, 2).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{acc.name}</p>
                  <p className="text-[11px] capitalize text-mist">{[acc.bank, acc.account_type, acc.last4 && `••${acc.last4}`].filter(Boolean).join(" · ")}</p>
                </div>
                <p className={`num text-[15px] font-semibold ${balance < 0 ? "text-coral" : ""}`}>{money(balance, acc.currency)}</p>
              </button>
              {open && (
                <div className="border-t border-foreground/10">
                  <div className="flex gap-2 px-4 py-3">
                    <button onClick={() => setEdit(acc)} className="glass-l rounded-full px-3 py-1 text-[12px]">Edit</button>
                    <span className="ml-auto self-center text-[11px] text-mist">{txns.length} transactions</span>
                  </div>
                  <div className="divide-y divide-foreground/10">
                    {txns.slice(0, 10).map((x) => <TxnRow key={x.id} t={x} d={d} />)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <BottomSheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit?.id ? "Edit account" : "New account"}>
        {edit && (
          <>
            <Field label="Account name"><input className="field" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Meezan Current" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank"><input className="field" value={edit.bank ?? ""} onChange={(e) => setEdit({ ...edit, bank: e.target.value })} placeholder="HBL, Meezan…" /></Field>
              <Field label="Last 4 digits"><input className="field" maxLength={4} inputMode="numeric" value={edit.last4 ?? ""} onChange={(e) => setEdit({ ...edit, last4: e.target.value })} /></Field>
            </div>
            <Field label="Currency"><CurrencySelect value={edit.currency ?? cur.primary} onChange={(c) => setEdit({ ...edit, currency: c })} /></Field>
            <Field label="Type">
              <select className="field capitalize" value={edit.account_type ?? "checking"} onChange={(e) => setEdit({ ...edit, account_type: e.target.value })}>
                {TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="Starting balance (negative if you owe)">
              <input className="field num" inputMode="decimal" value={edit.opening_balance ?? ""} onChange={(e) => setEdit({ ...edit, opening_balance: e.target.value as unknown as number })} placeholder="0" />
            </Field>
            <PrimaryButton onClick={save}>Save account</PrimaryButton>
            {edit.id && <button onClick={() => remove(edit.id!)} className="mt-3 w-full text-[13px] text-coral">Delete account</button>}
          </>
        )}
      </BottomSheet>
    </>
  );
}
