import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { AppShell, EmptyNote, SectionHead } from "@/components/AppShell";
import { BottomSheet, Field, PrimaryButton } from "@/components/Sheet";
import { supabase } from "@/integrations/supabase/client";
import { CHART_COLORS, financeQuery, pct, rs, totals, useFinance, useRefreshFinance, type Investment } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/investments")({
  head: () => ({ meta: [{ title: "Investments — Worthfolio" }, { name: "description", content: "Your portfolio: stocks, funds, gold, property, crypto and more." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(financeQuery),
  component: () => (
    <AppShell title="Investments">
      <Investments />
    </AppShell>
  ),
  errorComponent: ({ error }) => <div className="p-6 text-coral">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

const TYPES = ["stocks", "mutual funds", "gold", "property", "savings certificates", "crypto", "business", "other"];

function Investments() {
  const d = useFinance();
  const refresh = useRefreshFinance();
  const t = totals(d);
  const [edit, setEdit] = useState<Partial<Investment> | null>(null);
  const gain = t.portfolio - t.invested;
  const alloc = Object.entries(
    d.investments.reduce<Record<string, number>>((m, i) => ((m[i.asset_type] = (m[i.asset_type] ?? 0) + Number(i.current_value)), m), {}),
  ).map(([name, value]) => ({ name, value }));

  async function save() {
    if (!edit?.name) { toast.error("Name required"); return; }
    const row = {
      name: edit.name,
      asset_type: edit.asset_type ?? "stocks",
      invested: Number(edit.invested ?? 0),
      current_value: Number(edit.current_value ?? edit.invested ?? 0),
      updated_at: new Date().toISOString(),
    };
    const { error } = edit.id ? await supabase.from("investments").update(row).eq("id", edit.id) : await supabase.from("investments").insert(row);
    if (error) { toast.error(error.message); return; }
    setEdit(null);
    refresh();
  }
  async function remove(id: string) {
    await supabase.from("investments").delete().eq("id", id);
    setEdit(null);
    refresh();
  }

  return (
    <>
      <div className="glass rise mt-5 rounded-[22px] p-5">
        <p className="eyebrow">Portfolio value</p>
        <p className="num mt-1 text-[30px] font-semibold">{rs(t.portfolio)}</p>
        <p className={`mt-1 text-[13px] font-semibold ${gain >= 0 ? "text-primary" : "text-coral"}`}>
          {rs(gain, { sign: true })} · {t.invested ? pct((gain / t.invested) * 100) : "—"}
          <span className="font-normal text-mist"> on {rs(t.invested)} invested</span>
        </p>
        {alloc.length > 0 && (
          <div className="mt-4 flex items-center gap-4">
            <div className="size-28 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={alloc} dataKey="value" innerRadius={34} outerRadius={54} stroke="none">
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
                  <span className="num ml-auto text-mist">{Math.round((a.value / t.portfolio) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <SectionHead title="Holdings" right={<button onClick={() => setEdit({ asset_type: "stocks" })} className="font-semibold text-primary">+ Add investment</button>} />
      {d.investments.length === 0 && <EmptyNote>Add PSX stocks, mutual funds, gold, plots, prize bonds, crypto…</EmptyNote>}
      <div className="glass mt-3 divide-y divide-foreground/10 rounded-[18px]">
        {d.investments.map((i) => {
          const g = Number(i.current_value) - Number(i.invested);
          return (
            <button key={i.id} onClick={() => setEdit(i)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{i.name}</p>
                <p className="text-[11px] capitalize text-mist">{i.asset_type} · invested {rs(Number(i.invested))}</p>
              </div>
              <div className="text-right">
                <p className="num text-[13px] font-semibold">{rs(Number(i.current_value))}</p>
                <p className={`num text-[11px] ${g >= 0 ? "text-primary" : "text-coral"}`}>{Number(i.invested) ? pct((g / Number(i.invested)) * 100) : "—"}</p>
              </div>
            </button>
          );
        })}
      </div>

      <BottomSheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit?.id ? "Update investment" : "New investment"}>
        {edit && (
          <>
            <Field label="Name"><input className="field" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Meezan Islamic Fund" /></Field>
            <Field label="Type">
              <select className="field capitalize" value={edit.asset_type ?? "stocks"} onChange={(e) => setEdit({ ...edit, asset_type: e.target.value })}>
                {TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount invested"><input className="field num" inputMode="decimal" value={edit.invested ?? ""} onChange={(e) => setEdit({ ...edit, invested: e.target.value as unknown as number })} /></Field>
              <Field label="Current value"><input className="field num" inputMode="decimal" value={edit.current_value ?? ""} onChange={(e) => setEdit({ ...edit, current_value: e.target.value as unknown as number })} /></Field>
            </div>
            <PrimaryButton onClick={save}>Save</PrimaryButton>
            {edit.id && <button onClick={() => remove(edit.id!)} className="mt-3 w-full text-[13px] text-coral">Delete</button>}
          </>
        )}
      </BottomSheet>
    </>
  );
}
