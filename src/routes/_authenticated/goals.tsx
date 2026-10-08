import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, EmptyNote, SectionHead } from "@/components/AppShell";
import { BottomSheet, Field, PrimaryButton } from "@/components/Sheet";
import { supabase } from "@/integrations/supabase/client";
import { financeQuery, goalStatus, rs, todayISO, totals, useFinance, useRefreshFinance, type Goal } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Goals — Worthfolio" }, { name: "description", content: "Save toward emergency funds, travel, a car, a house and more." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(financeQuery),
  component: () => (
    <AppShell title="Goals">
      <Goals />
    </AppShell>
  ),
  errorComponent: ({ error }) => <div className="p-6 text-coral">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

const CATS: Record<string, string> = {
  "emergency fund": "🛟", vacation: "🏖", "new car": "🚗", house: "🏠", investment: "📈", business: "🏢", education: "🎓", custom: "★",
};

function Goals() {
  const d = useFinance();
  const refresh = useRefreshFinance();
  const t = totals(d);
  const [edit, setEdit] = useState<Partial<Goal> | null>(null);
  const [money, setMoney] = useState<{ goal: Goal; dir: 1 | -1; amount: string; note: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function save() {
    if (!edit?.name) { toast.error("Name required"); return; }
    const target = Number(edit.target_amount);
    if (!target || target <= 0) { toast.error("Enter a target amount"); return; }
    const row = { name: edit.name, category: edit.category ?? "custom", target_amount: target, target_date: edit.target_date || null, notes: edit.notes || null };
    if (edit.id) {
      const { error } = await supabase.from("goals").update(row).eq("id", edit.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data, error } = await supabase.from("goals").insert(row).select("id").single();
      if (error) { toast.error(error.message); return; }
      const start = Number((edit as { _start?: string })._start ?? 0);
      if (start > 0) await supabase.from("goal_contributions").insert({ goal_id: data.id, amount: start, note: "Starting amount" });
    }
    setEdit(null);
    refresh();
  }
  async function remove(id: string) {
    if (!confirm("Delete this goal?")) return;
    await supabase.from("goals").delete().eq("id", id);
    setEdit(null);
    refresh();
  }
  async function move() {
    if (!money) return;
    const amt = Number(money.amount);
    if (!amt || amt <= 0) { toast.error("Enter an amount"); return; }
    const saved = goalStatus(money.goal, d.goalContributions).saved;
    if (money.dir === -1 && amt > saved) { toast.error(`Only ${rs(saved)} saved in this goal`); return; }
    const { error } = await supabase.from("goal_contributions").insert({ goal_id: money.goal.id, amount: amt * money.dir, contributed_on: todayISO(), note: money.note || null });
    if (error) { toast.error(error.message); return; }
    toast.success(money.dir === 1 ? "Added to goal" : "Withdrawn from goal");
    setMoney(null);
    refresh();
  }

  return (
    <>
      <div className="glass rise mt-5 rounded-[22px] p-5">
        <p className="eyebrow">Saved toward goals</p>
        <p className="num mt-1 text-[30px] font-semibold">{rs(t.goalSaved)}</p>
        <p className="text-[12px] text-mist">of {rs(t.goalTarget)} target</p>
        <div className="mt-3 h-2 rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, t.goalPct)}%` }} />
        </div>
        <p className="mt-1.5 text-[12px] text-mist">{Math.round(t.goalPct)}% complete across {d.goals.length} goals</p>
      </div>

      <SectionHead title="Your goals" right={<button onClick={() => setEdit({ category: "emergency fund" })} className="font-semibold text-primary">+ New goal</button>} />
      {d.goals.length === 0 && <EmptyNote>Start an emergency fund, plan a trip, save for a car or a house.</EmptyNote>}
      <div className="mt-3 space-y-3">
        {d.goals.map((g) => {
          const s = goalStatus(g, d.goalContributions);
          const isOpen = open === g.id;
          const contribs = d.goalContributions.filter((c) => c.goal_id === g.id);
          return (
            <div key={g.id} className="glass rounded-[18px]">
              <button onClick={() => setOpen(isOpen ? null : g.id)} className="flex w-full items-center gap-4 px-4 py-4 text-left">
                <Ring pct={s.pctDone} icon={CATS[g.category] ?? "★"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{g.name}</p>
                  <p className="num text-[12px]">{rs(s.saved)} <span className="text-mist">/ {rs(s.target)}</span></p>
                  <p className="text-[11px] text-mist">
                    {s.remaining === 0 ? <span className="text-primary">Goal reached 🎉</span> : <>{rs(s.remaining)} to go{g.target_date ? ` · by ${g.target_date}` : ""}</>}
                  </p>
                </div>
                {s.onTrack !== null && s.remaining > 0 && (
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.onTrack ? "bg-primary/15 text-primary" : "bg-gold/15 text-gold"}`}>
                    {s.onTrack ? "On track" : "Behind"}
                  </span>
                )}
              </button>
              {isOpen && (
                <div className="border-t border-foreground/10 px-4 py-3">
                  {g.target_date && s.remaining > 0 && (
                    <p className="mb-3 text-[12px] text-mist">
                      Save <span className="num font-semibold text-foreground">{rs(s.perMonth)}</span>/month or <span className="num font-semibold text-foreground">{rs(s.perWeek)}</span>/week to reach it on time.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setMoney({ goal: g, dir: 1, amount: "", note: "" })} className="rounded-full bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground">+ Add money</button>
                    <button onClick={() => setMoney({ goal: g, dir: -1, amount: "", note: "" })} className="glass-l rounded-full px-4 py-2 text-[12px]">− Withdraw</button>
                    <button onClick={() => setEdit(g)} className="glass-l rounded-full px-4 py-2 text-[12px]">Edit</button>
                  </div>
                  {g.notes && <p className="mt-2 text-[12px] text-mist">{g.notes}</p>}
                  {contribs.length > 0 && (
                    <div className="mt-3 divide-y divide-foreground/10">
                      {contribs.slice(0, 8).map((c) => (
                        <div key={c.id} className="flex justify-between py-2 text-[12px]">
                          <span>{c.contributed_on}{c.note ? ` · ${c.note}` : ""}</span>
                          <span className={`num font-semibold ${Number(c.amount) < 0 ? "text-coral" : "text-primary"}`}>{rs(Number(c.amount), { sign: true })}</span>
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

      <BottomSheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit?.id ? "Edit goal" : "New goal"}>
        {edit && (
          <>
            <p className="eyebrow mb-2 !tracking-[0.14em]">Category</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {Object.entries(CATS).map(([k, ic]) => (
                <button key={k} onClick={() => setEdit({ ...edit, category: k, name: edit.name || (k === "custom" ? "" : k.replace(/\b\w/g, (c) => c.toUpperCase())) })} className={`rounded-full px-3 py-1.5 text-[12px] capitalize ${edit.category === k ? "bg-primary font-semibold text-primary-foreground" : "glass-l"}`}>
                  {ic} {k}
                </button>
              ))}
            </div>
            <Field label="Goal name"><input className="field" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Target (Rs)"><input className="field num" inputMode="decimal" value={edit.target_amount ?? ""} onChange={(e) => setEdit({ ...edit, target_amount: e.target.value.replace(/[^\d.]/g, "") as unknown as number })} /></Field>
              <Field label="Target date"><input type="date" className="field" value={edit.target_date ?? ""} onChange={(e) => setEdit({ ...edit, target_date: e.target.value })} /></Field>
            </div>
            {!edit.id && (
              <Field label="Already saved (Rs)">
                <input className="field num" inputMode="decimal" value={(edit as { _start?: string })._start ?? ""} onChange={(e) => setEdit({ ...edit, _start: e.target.value.replace(/[^\d.]/g, "") } as Partial<Goal>)} placeholder="0" />
              </Field>
            )}
            <Field label="Notes"><input className="field" value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
            <PrimaryButton onClick={save}>Save goal</PrimaryButton>
            {edit.id && <button onClick={() => remove(edit.id!)} className="mt-3 w-full text-[13px] text-coral">Delete goal</button>}
          </>
        )}
      </BottomSheet>

      <BottomSheet open={!!money} onOpenChange={(o) => !o && setMoney(null)} title={money?.dir === 1 ? `Add to ${money.goal.name}` : `Withdraw from ${money?.goal.name ?? ""}`}>
        {money && (
          <>
            <Field label="Amount (Rs)"><input autoFocus className="field num text-2xl" inputMode="decimal" value={money.amount} onChange={(e) => setMoney({ ...money, amount: e.target.value.replace(/[^\d.]/g, "") })} /></Field>
            <Field label="Note"><input className="field" value={money.note} onChange={(e) => setMoney({ ...money, note: e.target.value })} /></Field>
            <PrimaryButton onClick={move}>{money.dir === 1 ? "Add money" : "Withdraw"}</PrimaryButton>
          </>
        )}
      </BottomSheet>
    </>
  );
}

function Ring({ pct, icon }: { pct: number; icon: string }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <div className="relative size-14 shrink-0">
      <svg viewBox="0 0 56 56" className="size-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--accent-teal)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, pct) / 100)} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold">{pct >= 1 ? `${Math.round(pct)}%` : icon}</span>
    </div>
  );
}
