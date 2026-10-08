import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { AppShell, EmptyNote, SectionHead } from "@/components/AppShell";
import { BottomSheet, Field, PrimaryButton } from "@/components/Sheet";
import { supabase } from "@/integrations/supabase/client";
import { CurrencySelect } from "@/components/CurrencySelect";
import { useCurrency } from "@/components/CurrencyProvider";
import { convert, getCurrency, usdPerUnit } from "@/lib/currency";

import { CHART_COLORS, financeQuery, investmentHistory, money, pct, rs, todayISO, totals, useFinance, useRefreshFinance, type Investment } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/investments")({
  head: () => ({ meta: [{ title: "Investments — Worthfolio" }, { name: "description", content: "Your portfolio: stocks, ETFs, funds, gold, property, crypto and more." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(financeQuery),
  component: () => (
    <AppShell title="Investments">
      <Investments />
    </AppShell>
  ),
  errorComponent: ({ error }) => <div className="p-6 text-coral">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

const TYPES = ["stocks", "etfs", "mutual funds", "crypto", "real estate", "gold", "savings certificates", "business", "other"];
const n = (v: unknown) => (v === "" || v == null ? null : Number(v));

function Investments() {
  const d = useFinance();
  const refresh = useRefreshFinance();
  const t = totals(d);
  const [edit, setEdit] = useState<Partial<Investment> | null>(null);
  const [upd, setUpd] = useState<{ inv: Investment; value: string; date: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const cur = useCurrency();
  const hist = investmentHistory(d);
  const alloc = Object.entries(
    d.investments.reduce<Record<string, number>>((m, i) => ((m[i.asset_type] = (m[i.asset_type] ?? 0) + convert(Number(i.current_value), i.currency)), m), {}),
  ).map(([name, value]) => ({ name, value }));

  async function save() {
    if (!edit?.name) { toast.error("Name required"); return; }
    const invested = Number(edit.invested ?? 0);
    const current = edit.current_value === undefined || (edit.current_value as unknown) === "" ? invested : Number(edit.current_value);
    if (invested < 0 || current < 0) { toast.error("Amounts can't be negative"); return; }
    const row = {
      name: edit.name,
      asset_type: edit.asset_type ?? "stocks",
      platform: edit.platform || null,
      invested,
      quantity: n(edit.quantity),
      purchase_price: n(edit.purchase_price),
      purchase_date: edit.purchase_date || null,
      notes: edit.notes || null,
      currency: edit.currency ?? cur.primary,
      current_value: current,
      updated_at: new Date().toISOString(),
    };
    if (edit.id) {
      const prev = d.investments.find((x) => x.id === edit.id);
      const { error } = await supabase.from("investments").update(row).eq("id", edit.id);
      if (error) { toast.error(error.message); return; }
      if (prev && Number(prev.current_value) !== current) await supabase.from("investment_values").insert({ investment_id: edit.id, value: current, recorded_on: todayISO() });
    } else {
      const { data, error } = await supabase.from("investments").insert(row).select("id").single();
      if (error) { toast.error(error.message); return; }
      await supabase.from("investment_values").insert({ investment_id: data.id, value: current, recorded_on: row.purchase_date ?? todayISO() });
    }
    setEdit(null);
    refresh();
  }
  async function updateValue() {
    if (!upd) return;
    const v = Number(upd.value);
    if (isNaN(v) || v < 0) { toast.error("Enter a valid value"); return; }
    const { error } = await supabase.from("investment_values").insert({ investment_id: upd.inv.id, value: v, recorded_on: upd.date });
    if (error) { toast.error(error.message); return; }
    // keep current_value = latest dated entry
    const latest = [...d.investmentValues.filter((h) => h.investment_id === upd.inv.id), { recorded_on: upd.date, value: v }].sort((a, b) => a.recorded_on.localeCompare(b.recorded_on)).pop()!;
    await supabase.from("investments").update({ current_value: Number(latest.value), updated_at: new Date().toISOString() }).eq("id", upd.inv.id);
    toast.success("Value updated");
    setUpd(null);
    refresh();
  }
  async function remove(id: string) {
    if (!confirm("Delete this investment and its value history?")) return;
    await supabase.from("investments").delete().eq("id", id);
    setEdit(null);
    refresh();
  }

  return (
    <>
      <div className="glass rise mt-5 rounded-[22px] p-5">
        <p className="eyebrow">Portfolio value</p>
        <p className="num mt-1 text-[30px] font-semibold">{rs(t.portfolio)}</p>
        <p className={`mt-1 text-[13px] font-semibold ${t.gain >= 0 ? "text-primary" : "text-coral"}`}>
          {rs(t.gain, { sign: true })} · {t.invested ? pct(t.gainPct) : "—"}
          <span className="font-normal text-mist"> on {rs(t.invested)} invested</span>
        </p>
        {d.investments.length > 0 && (
          <div className="mt-4 h-28">
            <ResponsiveContainer>
              <AreaChart data={hist} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="pf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-teal)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--accent-teal)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fill: "var(--mist)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [rs(v), "Portfolio"]} />
                <Area dataKey="value" stroke="var(--accent-teal)" strokeWidth={2} fill="url(#pf)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {alloc.length > 0 && (
          <div className="mt-4 flex items-center gap-4">
            <div className="size-24 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={alloc} dataKey="value" innerRadius={28} outerRadius={46} stroke="none">
                    {alloc.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5 text-[12px]">
              {alloc.map((a, i) => (
                <div key={a.name} className="flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="capitalize">{a.name}</span>
                  <span className="num ml-auto text-mist">{t.portfolio ? Math.round((a.value / t.portfolio) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <SectionHead title="Holdings" right={<button onClick={() => setEdit({ asset_type: "stocks", purchase_date: todayISO() })} className="font-semibold text-primary">+ Add investment</button>} />
      {d.investments.length === 0 && <EmptyNote>Add PSX stocks, ETFs, mutual funds, gold, plots, crypto…</EmptyNote>}
      <div className="mt-3 space-y-3">
        {d.investments.map((i) => {
          const g = Number(i.current_value) - Number(i.invested);
          const isOpen = open === i.id;
          const h = d.investmentValues.filter((x) => x.investment_id === i.id).slice().reverse();
          return (
            <div key={i.id} className="glass rounded-[18px]">
              <button onClick={() => setOpen(isOpen ? null : i.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{i.name}</p>
                  <p className="truncate text-[11px] capitalize text-mist">{[i.asset_type, i.platform, i.quantity ? `${i.quantity} units` : null].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="text-right">
                  <p className="num text-[14px] font-semibold">{money(Number(i.current_value), i.currency)}</p>
                  <p className={`num text-[11px] ${g >= 0 ? "text-primary" : "text-coral"}`}>{money(g, i.currency, { sign: true })} · {Number(i.invested) ? pct((g / Number(i.invested)) * 100) : "—"}</p>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-foreground/10 px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setUpd({ inv: i, value: String(i.current_value), date: todayISO() })} className="rounded-full bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground">Update value</button>
                    <button onClick={() => setEdit(i)} className="glass-l rounded-full px-4 py-2 text-[12px]">Edit details</button>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                    <Info l="Invested" v={money(Number(i.invested), i.currency)} />
                    <Info l="Buy price" v={i.purchase_price != null ? money(Number(i.purchase_price), i.currency) : "—"} />
                    <Info l="Bought" v={i.purchase_date ?? "—"} />
                  </div>
                  {i.notes && <p className="mt-2 text-[12px] text-mist">{i.notes}</p>}
                  <p className="eyebrow mt-4 mb-1 !tracking-[0.14em]">Value history</p>
                  <div className="divide-y divide-foreground/10">
                    {h.slice(0, 10).map((x) => (
                      <div key={x.id} className="flex justify-between py-1.5 text-[12px]">
                        <span className="text-mist">{x.recorded_on}</span>
                        <span className="num">{money(Number(x.value), i.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <BottomSheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit?.id ? "Edit investment" : "New investment"}>
        {edit && (
          <>
            <Field label="Name"><input className="field" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Meezan Islamic Fund" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Currency"><CurrencySelect value={edit.currency ?? cur.primary} onChange={(c) => setEdit({ ...edit, currency: c })} /></Field>
              <Field label="Type">
                <select className="field capitalize" value={edit.asset_type ?? "stocks"} onChange={(e) => setEdit({ ...edit, asset_type: e.target.value })}>
                  {TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Platform / broker"><input className="field" value={edit.platform ?? ""} onChange={(e) => setEdit({ ...edit, platform: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount invested"><NumIn v={edit.invested} on={(v) => setEdit({ ...edit, invested: v })} /></Field>
              <Field label="Current value"><NumIn v={edit.current_value} on={(v) => setEdit({ ...edit, current_value: v })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity / units"><NumIn v={edit.quantity} on={(v) => setEdit({ ...edit, quantity: v })} /></Field>
              <Field label="Purchase price"><NumIn v={edit.purchase_price} on={(v) => setEdit({ ...edit, purchase_price: v })} /></Field>
            </div>
            <Field label="Purchase date"><input type="date" className="field" value={edit.purchase_date ?? ""} onChange={(e) => setEdit({ ...edit, purchase_date: e.target.value })} /></Field>
            <Field label="Notes"><input className="field" value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <PrimaryButton onClick={save}>Save</PrimaryButton>
            {edit.id && <button onClick={() => remove(edit.id!)} className="mt-3 w-full text-[13px] text-coral">Delete</button>}
          </>
        )}
      </BottomSheet>

      <BottomSheet open={!!upd} onOpenChange={(o) => !o && setUpd(null)} title={`Update ${upd?.inv.name ?? ""}`}>
        {upd && (
          <>
            <Field label={`Current value (${upd.inv.currency})`}><input autoFocus className="field num text-2xl" inputMode="decimal" value={upd.value} onChange={(e) => setUpd({ ...upd, value: e.target.value.replace(/[^\d.]/g, "") })} /></Field>
            <Field label="As of"><input type="date" className="field" value={upd.date} onChange={(e) => setUpd({ ...upd, date: e.target.value })} /></Field>
            <p className="mb-2 text-[12px] text-mist">
              Gain would be <span className="num font-semibold">{money(Number(upd.value) - Number(upd.inv.invested), upd.inv.currency, { sign: true })}</span>. Previous values stay in history.
            </p>
            <PrimaryButton onClick={updateValue}>Save value</PrimaryButton>
          </>
        )}
      </BottomSheet>
    </>
  );
}

function Info({ l, v }: { l: string; v: string }) {
  return (
    <div className="rounded-xl bg-foreground/5 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-[0.12em] text-mist">{l}</p>
      <p className="num truncate font-semibold">{v}</p>
    </div>
  );
}
function NumIn({ v, on }: { v: number | null | undefined; on: (v: number) => void }) {
  return <input className="field num" inputMode="decimal" value={v ?? ""} onChange={(e) => on(e.target.value.replace(/[^\d.]/g, "") as unknown as number)} />;
}
