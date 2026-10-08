import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { AppShell, EmptyNote, PeriodToggle, SectionHead } from "@/components/AppShell";
import {
  CHART_COLORS, categoryBreakdown, compactRs, financeQuery, flowSummary, inRange, pct, periodRange, rs, toISO, useFinance, type Period,
} from "@/lib/finance";

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
  const [period, setPeriod] = useState<Period>("month");
  const [offset, setOffset] = useState(0);
  const r = periodRange(period, offset);
  const prevR = periodRange(period, offset - 1);
  const f = flowSummary(d.transactions, r.start, r.end);
  const pf = flowSummary(d.transactions, prevR.start, prevR.end);
  const exp = categoryBreakdown(d, "expense", r.start, r.end);
  const inc = categoryBreakdown(d, "income", r.start, r.end);
  const txns = d.transactions.filter((t) => inRange(t, r.start, r.end));

  // buckets: days for month, months for quarter/year
  const buckets: { label: string; in: number; out: number }[] = [];
  if (period === "month") {
    const n = r.end.getDate();
    for (let i = 1; i <= n; i++) buckets.push({ label: String(i), in: 0, out: 0 });
    txns.forEach((t) => {
      const b = buckets[Number(t.occurred_on.slice(8, 10)) - 1]!;
      if (t.type === "income") b.in += Number(t.amount);
      if (t.type === "expense") b.out += Number(t.amount);
    });
  } else {
    const months = period === "quarter" ? 3 : 12;
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

  function exportCSV() {
    const rows = [["Date", "Type", "Category", "Account", "Note", "Amount (PKR)"]];
    txns.forEach((t) => {
      rows.push([
        t.occurred_on,
        t.type,
        d.categories.find((c) => c.id === t.category_id)?.name ?? "",
        d.accounts.find((a) => a.id === t.account_id)?.name ?? "",
        (t.note ?? "").replace(/"/g, "'"),
        String(t.amount),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `ledger-${period}-${toISO(r.start)}.csv`;
    a.click();
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
          options={[{ v: "month", l: "Monthly" }, { v: "quarter", l: "Quarterly" }, { v: "year", l: "Yearly" }]}
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button onClick={() => setOffset(offset - 1)} className="no-print glass-l grid size-9 place-items-center rounded-full">‹</button>
        <p className="text-[16px] font-semibold">{r.label}</p>
        <button onClick={() => setOffset(Math.min(0, offset + 1))} disabled={offset === 0} className="no-print glass-l grid size-9 place-items-center rounded-full disabled:opacity-30">›</button>
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
              <span className="num font-semibold">{rs(Number(t.amount))}</span>
            </div>
          ))}
        </div>
      )}

      <div className="no-print mt-6 grid grid-cols-2 gap-3">
        <button onClick={exportCSV} className="glass-l rounded-2xl py-3 text-[14px] font-semibold">Export CSV</button>
        <button onClick={() => window.print()} className="glow rounded-2xl bg-primary py-3 text-[14px] font-semibold text-primary-foreground">Save as PDF</button>
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

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="glass rounded-[18px] px-4 py-3.5">
      <p className="eyebrow !tracking-[0.16em]">{label}</p>
      <p className={`num mt-1 text-[17px] font-semibold ${tone ?? ""}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-mist">{sub}</p>
    </div>
  );
}
