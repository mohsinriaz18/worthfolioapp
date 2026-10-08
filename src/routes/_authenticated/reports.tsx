import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { AppShell, EmptyNote, PeriodToggle, SectionHead } from "@/components/AppShell";
import {
  CHART_COLORS, categoryBreakdown, compactRs, money, debtRemaining, financeQuery, flowSummary, goalStatus, inRange, pct, periodRange, rs, toISO, todayISO, totals, useFinance, type Period,
} from "@/lib/finance";
import { buildReport, downloadCsv, downloadXlsx } from "@/lib/export";
import { useCurrency } from "@/components/CurrencyProvider";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Worthfolio" }, { name: "description", content: "Monthly, quarterly and yearly reports of income and spending." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(financeQuery),
  component: () => (
    <AppShell title="Reports">
      <Reports />
    </AppShell>
  ),
  errorComponent: ({ error }) => <div className="p-6 text-coral">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function Reports() {
  const d = useFinance();
  const [period, setPeriod] = useState<Period | "custom">("month");
  const [offset, setOffset] = useState(0);
  const [from, setFrom] = useState(toISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(todayISO());
  const tot = totals(d);
  const cur = useCurrency();
  const r =
    period === "custom"
      ? { start: new Date(from + "T00:00:00"), end: new Date(to + "T00:00:00"), label: "Custom range" }
      : periodRange(period, offset);
  const span = r.end.getTime() - r.start.getTime() + 86400000;
  const prevR = period === "custom" ? { start: new Date(r.start.getTime() - span), end: new Date(r.start.getTime() - 86400000) } : periodRange(period, offset - 1);
  const f = flowSummary(d.transactions, r.start, r.end);
  const pf = flowSummary(d.transactions, prevR.start, prevR.end);
  const exp = categoryBreakdown(d, "expense", r.start, r.end);
  const inc = categoryBreakdown(d, "income", r.start, r.end);
  const txns = d.transactions.filter((t) => inRange(t, r.start, r.end));

  // buckets: days for month, months for quarter/year
  const buckets: { label: string; in: number; out: number }[] = [];
  const dayCount = Math.round(span / 86400000);
  if (period === "week" || period === "month" || (period === "custom" && dayCount <= 62)) {
    for (let i = 0; i < dayCount; i++) {
      const dd = new Date(r.start.getFullYear(), r.start.getMonth(), r.start.getDate() + i);
      buckets.push({ label: period === "week" ? dd.toLocaleDateString("en-GB", { weekday: "short" }) : String(dd.getDate()), in: 0, out: 0 });
    }
    txns.forEach((t) => {
      const b = buckets[Math.round((new Date(t.occurred_on + "T00:00:00").getTime() - r.start.getTime()) / 86400000)];
      if (!b) return;
      if (t.type === "income") b.in += Number(t.amount);
      if (t.type === "expense") b.out += Number(t.amount);
    });
  } else {
    const months = period === "quarter" ? 3 : period === "year" ? 12 : (r.end.getFullYear() - r.start.getFullYear()) * 12 + r.end.getMonth() - r.start.getMonth() + 1;
    for (let i = 0; i < months; i++) {
      const m = new Date(r.start.getFullYear(), r.start.getMonth() + i, 1);
      buckets.push({ label: m.toLocaleDateString("en-GB", { month: "short" }), in: 0, out: 0 });
    }
    txns.forEach((t) => {
      const idx = (Number(t.occurred_on.slice(0, 4)) - r.start.getFullYear()) * 12 + Number(t.occurred_on.slice(5, 7)) - 1 - r.start.getMonth();
      const b = buckets[idx];
      if (!b) return;
      if (t.type === "income") b.in += Number(t.amount);
      if (t.type === "expense") b.out += Number(t.amount);
    });
  }

  const savingsRate = f.income ? (f.net / f.income) * 100 : 0;
  const days = Math.max(1, Math.round((Math.min(Date.now(), r.end.getTime()) - r.start.getTime()) / 86400000) + 1);
  const biggest = [...txns].filter((t) => t.type === "expense").sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5);

  function exportFile(kind: "xlsx" | "csv") {
    const rep = buildReport(d, r.start, r.end, r.label);
    const name = `worthfolio-${period}-${toISO(r.start)}_${toISO(r.end)}.${kind}`;
    if (kind === "xlsx") downloadXlsx(rep, name);
    else downloadCsv(rep, name);
  }

  const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 };

  return (
    <>
      <div className="no-print mt-5">
        <PeriodToggle
          value={period}
          onChange={(v) => {
            setPeriod(v);
            setOffset(0);
          }}
          options={[{ v: "week", l: "Week" }, { v: "month", l: "Month" }, { v: "quarter", l: "Qtr" }, { v: "year", l: "Year" }, { v: "custom", l: "Custom" }]}
        />
      </div>
      {period === "custom" ? (
        <div className="no-print mt-3 grid grid-cols-2 gap-3">
          <input type="date" className="field" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
          <input type="date" className="field" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        </div>
      ) : (
      <div className="mt-3 flex items-center justify-between">
        <button onClick={() => setOffset(offset - 1)} className="no-print glass-l grid size-9 place-items-center rounded-full">‹</button>
        <p className="text-[16px] font-semibold">{r.label}</p>
        <button onClick={() => setOffset(Math.min(0, offset + 1))} disabled={offset === 0} className="no-print glass-l grid size-9 place-items-center rounded-full disabled:opacity-30">›</button>
      </div>
      )}

      <div className="no-print mt-3 flex items-center justify-between gap-3">
        <span className="text-[12px] text-mist">Report currency</span>
        <PeriodToggle value={cur.display} onChange={cur.setDisplay} options={[cur.primary, cur.secondary].map((c) => ({ v: c, l: c }))} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Earned" value={rs(f.income)} sub={`${pct(pf.income ? ((f.income - pf.income) / pf.income) * 100 : 0)} vs prev`} tone="text-primary" />
        <Stat label="Spent" value={rs(f.expense)} sub={`${pct(pf.expense ? ((f.expense - pf.expense) / pf.expense) * 100 : 0)} vs prev`} tone="text-coral" />
        <Stat label="Net saved" value={rs(f.net, { sign: true })} sub={`Savings rate ${Math.round(savingsRate)}%`} tone={f.net >= 0 ? "text-primary" : "text-coral"} />
        <Stat label="Avg / day spent" value={rs(f.expense / days)} sub={`${txns.length} transactions`} />
      </div>

      <SectionHead title="Money in vs out" />
      <div className="glass mt-3 h-48 rounded-[18px] p-3">
        <ResponsiveContainer>
          <BarChart data={buckets}>
            <XAxis dataKey="label" tick={{ fill: "var(--mist)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [rs(v), n === "in" ? "In" : "Out"]} cursor={{ fill: "oklch(1 0 0 / 5%)" }} />
            <Bar dataKey="in" fill="var(--accent-teal)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="out" fill="var(--coral)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <Breakdown title="Where you spent" items={exp} total={f.expense} />
      <Breakdown title="Where you earned" items={inc} total={f.income} />

      <SectionHead title="Biggest expenses" />
      {biggest.length === 0 ? (
        <EmptyNote>No expenses in this period.</EmptyNote>
      ) : (
        <div className="glass mt-3 divide-y divide-foreground/10 rounded-[18px]">
          {biggest.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3 text-[13px]">
              <span className="truncate">{t.note || d.categories.find((c) => c.id === t.category_id)?.name || "Expense"} <span className="text-[11px] text-mist">· {t.occurred_on}</span></span>
              <span className="num font-semibold">{money(Number(t.amount), t.currency)}</span>
            </div>
          ))}
        </div>
      )}

      <SectionHead title="Investments" right={rs(tot.portfolio)} />
      <div className="glass mt-3 divide-y divide-foreground/10 rounded-[18px]">
        <Line l="Total invested" v={rs(tot.invested)} />
        <Line l="Current value" v={rs(tot.portfolio)} />
        <Line l="Gain / loss" v={`${rs(tot.gain, { sign: true })} · ${pct(tot.gainPct)}`} tone={tot.gain >= 0 ? "text-primary" : "text-coral"} />
        {d.investments.map((i) => <Line key={i.id} l={i.name} v={`${money(Number(i.current_value), i.currency)} (${money(Number(i.current_value) - Number(i.invested), i.currency, { sign: true })})`} small />)}
      </div>

      <SectionHead title="Goals" right={`${Math.round(tot.goalPct)}%`} />
      {d.goals.length === 0 ? <EmptyNote>No goals yet.</EmptyNote> : (
        <div className="glass mt-3 divide-y divide-foreground/10 rounded-[18px]">
          {d.goals.map((g) => {
            const st = goalStatus(g, d.goalContributions);
            const inP = d.goalContributions.filter((c) => c.goal_id === g.id && c.contributed_on >= toISO(r.start) && c.contributed_on <= toISO(r.end)).reduce((a, c) => a + Number(c.amount), 0);
            return <Line key={g.id} l={`${g.name} · ${Math.round(st.pctDone)}%`} v={`${money(st.saved, g.currency)} / ${money(st.target, g.currency)} · +${money(inP, g.currency)} this period`} small />;
          })}
        </div>
      )}

      <SectionHead title="Debts" right={rs(tot.debtTotal)} />
      {d.debts.length === 0 ? <EmptyNote>No debts recorded.</EmptyNote> : (
        <div className="glass mt-3 divide-y divide-foreground/10 rounded-[18px]">
          <Line l="Payments this period" v={rs(d.debtPayments.filter((p) => p.paid_on >= toISO(r.start) && p.paid_on <= toISO(r.end)).reduce((a, p) => a + Number(p.amount), 0))} />
          {d.debts.map((x) => <Line key={x.id} l={x.name} v={`${money(debtRemaining(x, d.debtPayments), x.currency)} left`} small />)}
        </div>
      )}

      <SectionHead title="Net worth" right="Today" />
      <div className="glass mt-3 divide-y divide-foreground/10 rounded-[18px]">
        <Line l="Total assets" v={rs(tot.totalAssets)} tone="text-primary" />
        <Line l="Total liabilities" v={rs(-tot.totalLiabilities)} tone="text-coral" />
        <Line l="Net worth" v={rs(tot.netWorth)} />
      </div>

      <div className="no-print mt-6 grid grid-cols-3 gap-2">
        <button onClick={() => exportFile("xlsx")} className="glow rounded-2xl bg-primary py-3 text-[13px] font-semibold text-primary-foreground">Excel</button>
        <button onClick={() => exportFile("csv")} className="glass-l rounded-2xl py-3 text-[13px] font-semibold">CSV</button>
        <button onClick={() => window.print()} className="glass-l rounded-2xl py-3 text-[13px] font-semibold">PDF</button>
      </div>
    </>
  );

  function Breakdown({ title, items, total }: { title: string; items: ReturnType<typeof categoryBreakdown>; total: number }) {
    return (
      <>
        <SectionHead title={title} right={rs(total)} />
        {items.length === 0 ? (
          <EmptyNote>Nothing recorded.</EmptyNote>
        ) : (
          <div className="glass mt-3 rounded-[18px] p-4">
            <div className="flex items-center gap-4">
              <div className="size-28 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={items} dataKey="value" innerRadius={34} outerRadius={54} stroke="none">
                      {items.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 text-[12px]">
                {items.slice(0, 6).map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="truncate">{c.name}</span>
                    <span className="num ml-auto text-mist">{compactRs(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 divide-y divide-foreground/10 border-t border-foreground/10">
              {items.map((c) => (
                <div key={c.id} className="flex justify-between py-2 text-[12px]">
                  <span>{c.icon} {c.name}</span>
                  <span className="num">{rs(c.value)} <span className="text-mist">· {Math.round(c.share * 100)}%</span></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }
}

function Line({ l, v, tone, small }: { l: string; v: string; tone?: string; small?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-4 ${small ? "py-2 text-[12px]" : "py-3 text-[13px]"}`}>
      <span className={`truncate ${small ? "text-mist" : ""}`}>{l}</span>
      <span className={`num shrink-0 font-semibold ${tone ?? ""}`}>{v}</span>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="glass rounded-[18px] px-4 py-3.5">
      <p className="eyebrow !tracking-[0.16em]">{label}</p>
      <p className={`num mt-1 text-[17px] font-semibold ${tone ?? ""}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-mist">{sub}</p>
    </div>
  );
}
