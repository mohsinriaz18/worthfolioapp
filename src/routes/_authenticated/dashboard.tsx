import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, EmptyNote, PeriodToggle, SectionHead } from "@/components/AppShell";
import { NetWorthChart } from "@/components/NetWorthChart";
import { TxnRow } from "@/components/TxnRow";
import {
  CHART_COLORS, categoryBreakdown, money, debtRemaining, financeQuery, goalStatus, flowSummary, initials, netWorthSeries, nextDue, pct, periodRange, rs, totals, useFinance, type Period,
} from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Worthfolio" }, { name: "description", content: "Your net worth, cash flow, accounts, bills and investments." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(financeQuery),
  component: () => (
    <AppShell title="Dashboard">
      <Dashboard />
    </AppShell>
  ),
  errorComponent: ({ error }) => <div className="p-6 text-coral">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function Dashboard() {
  const d = useFinance();
  const [period, setPeriod] = useState<Period>("month");
  const t = totals(d);
  const series = netWorthSeries(d, period);
  const prev = series[series.length - 2]?.value ?? 0;
  const change = t.netWorth - prev;
  const changePct = prev ? (change / Math.abs(prev)) * 100 : 0;
  const r = periodRange(period);
  const flow = flowSummary(d.transactions, r.start, r.end);
  const cats = categoryBreakdown(d, "expense", r.start, r.end).slice(0, 5);
  const maxCat = cats[0]?.value ?? 1;
  const bills = d.bills.map((b) => ({ b, ...nextDue(b) })).sort((a, b) => a.days - b.days).slice(0, 3);
  const gain = t.gain;
  const periodName = period === "week" ? "week" : period === "month" ? "month" : period === "quarter" ? "quarter" : "year";

  return (
    <>
      <div className="glass rise mt-5 rounded-[22px] px-5 py-5">
        <p className="eyebrow">Net worth · {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>
        <div className="mt-1 flex items-end justify-between gap-2">
          <p className="num text-[30px] leading-none font-semibold">{rs(t.netWorth)}</p>
          <span className={`mb-1 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${change >= 0 ? "bg-primary/15 text-primary" : "bg-coral/15 text-coral"}`}>
            <span className="text-[9px]">{change >= 0 ? "▲" : "▼"}</span> {pct(changePct)}
          </span>
        </div>
        <p className="mt-1.5 text-[12px] font-medium text-mist">{rs(change, { sign: true })} vs last {periodName}</p>
        <div className="mt-4">
          <PeriodToggle value={period} onChange={setPeriod} options={[{ v: "month", l: "Month" }, { v: "quarter", l: "Quarter" }, { v: "year", l: "Year" }]} />
        </div>
        <NetWorthChart data={series} />
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <Mini label="Total assets" value={t.totalAssets} />
          <Mini label="Liabilities" value={-t.totalLiabilities} tone="coral" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="glass rise rounded-[18px] px-4 py-3.5">
          <p className="eyebrow !tracking-[0.16em]">Cash in</p>
          <p className="num mt-1 text-[18px] font-semibold text-primary">{rs(flow.income, { sign: true })}</p>
          <p className="mt-0.5 text-[11px] text-mist">This {periodName}</p>
        </div>
        <div className="glass rise rounded-[18px] px-4 py-3.5">
          <p className="eyebrow !tracking-[0.16em]">Cash out</p>
          <p className="num mt-1 text-[18px] font-semibold text-coral">{rs(-flow.expense)}</p>
          <p className="mt-0.5 text-[11px] text-mist">
            Saved {flow.income ? Math.max(0, Math.round((flow.net / flow.income) * 100)) : 0}%
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <Link to="/investments" className="glass rounded-[18px] px-3 py-3">
          <p className="eyebrow !text-[10px] !tracking-[0.12em]">Invest gain</p>
          <p className={`num mt-1 text-[14px] font-semibold ${t.gain >= 0 ? "text-primary" : "text-coral"}`}>{pct(t.gainPct)}</p>
          <p className="num text-[10px] text-mist">{rs(t.gain, { sign: true })}</p>
        </Link>
        <Link to="/debts" className="glass rounded-[18px] px-3 py-3">
          <p className="eyebrow !text-[10px] !tracking-[0.12em]">Debt</p>
          <p className="num mt-1 text-[14px] font-semibold text-coral">{rs(t.debtTotal)}</p>
          <p className="text-[10px] text-mist">{d.debts.filter((x) => debtRemaining(x, d.debtPayments) > 0).length} active</p>
        </Link>
        <Link to="/goals" className="glass rounded-[18px] px-3 py-3">
          <p className="eyebrow !text-[10px] !tracking-[0.12em]">Goals</p>
          <p className="num mt-1 text-[14px] font-semibold">{Math.round(t.goalPct)}%</p>
          <div className="mt-1 h-1 rounded-full bg-foreground/10"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, t.goalPct)}%` }} /></div>
        </Link>
      </div>

      {d.goals.length > 0 && (
        <>
          <SectionHead title="Goal progress" right={<Link to="/goals" className="text-primary">All goals →</Link>} />
          <div className="mt-3 space-y-3">
            {d.goals.slice(0, 3).map((g) => {
              const s = goalStatus(g, d.goalContributions);
              return (
                <div key={g.id}>
                  <div className="flex justify-between text-[12px]">
                    <span className="font-medium">{g.name}</span>
                    <span className="num text-mist">{money(s.saved, g.currency)} / {money(s.target, g.currency)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-foreground/10"><div className="h-full rounded-full bg-primary" style={{ width: `${s.pctDone}%` }} /></div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <SectionHead title="Accounts" right={<Link to="/accounts" className="text-primary">{d.accounts.length} accounts →</Link>} />
      {t.balances.length === 0 ? (
        <EmptyNote>
          No accounts yet. <Link to="/accounts" className="text-primary">Add your bank accounts</Link>
        </EmptyNote>
      ) : (
        <div className="mt-3 -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {t.balances.map(({ acc, balance }) => (
            <div key={acc.id} className="glass w-[168px] shrink-0 rounded-[18px] px-4 py-4">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12px] font-semibold">{acc.name}</span>
                {acc.last4 && <span className="text-[11px] text-mist">••{acc.last4}</span>}
              </div>
              <p className={`num mt-6 text-[18px] font-semibold ${balance < 0 ? "text-coral" : ""}`}>{money(balance, acc.currency)}</p>
              <p className="text-[11px] capitalize text-mist">{[acc.bank, acc.account_type].filter(Boolean).join(" · ")}</p>
            </div>
          ))}
        </div>
      )}

      <SectionHead title="Upcoming bills" right={<Link to="/bills" className="text-primary">All bills →</Link>} />
      {bills.length === 0 ? (
        <EmptyNote>
          No bills yet. <Link to="/bills" className="text-primary">Add rent, utilities, subscriptions</Link>
        </EmptyNote>
      ) : (
        <div className="glass mt-3 divide-y divide-foreground/10 rounded-[18px]">
          {bills.map(({ b, due, days }) => (
            <div key={b.id} className="flex items-center gap-3 px-4 py-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-foreground/5 text-[12px] font-semibold">{initials(b.name)}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{b.name}</p>
                <p className={`text-[11px] ${days < 0 ? "text-coral" : days <= 3 ? "text-gold" : "text-mist"}`}>
                  {days < 0 ? `Overdue ${-days}d` : days === 0 ? "Due today" : `Due ${due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${days}d`}
                </p>
              </div>
              <p className="num text-[13px] font-semibold">{money(Number(b.amount), b.currency)}</p>
            </div>
          ))}
        </div>
      )}

      <SectionHead title="Spending by category" right={`This ${periodName}`} />
      {cats.length === 0 ? (
        <EmptyNote>No spending recorded this {periodName}.</EmptyNote>
      ) : (
        <div className="mt-3 space-y-3">
          {cats.map((c, i) => (
            <div key={c.id}>
              <div className="flex justify-between text-[12px]">
                <span className="font-medium">{c.icon} {c.name}</span>
                <span className="num text-mist">{rs(c.value)} · {Math.round(c.share * 100)}%</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-foreground/10">
                <div className="h-full rounded-full" style={{ width: `${(c.value / maxCat) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionHead title="Investments" right={<Link to="/investments" className="text-primary">Details →</Link>} />
      <div className="glass mt-3 rounded-[18px] px-4 py-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow !tracking-[0.16em]">Portfolio value</p>
            <p className="num mt-1 text-[22px] font-semibold">{rs(t.portfolio)}</p>
          </div>
          <div className="text-right">
            <p className={`num text-[14px] font-semibold ${gain >= 0 ? "text-primary" : "text-coral"}`}>{rs(gain, { sign: true })}</p>
            <p className="text-[11px] text-mist">{t.invested ? pct((gain / t.invested) * 100) : "—"} all time</p>
          </div>
        </div>
        {d.investments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            {Object.entries(
              d.investments.reduce<Record<string, number>>((m, i) => ((m[i.asset_type] = (m[i.asset_type] ?? 0) + Number(i.current_value)), m), {}),
            ).map(([k, v]) => (
              <span key={k} className="rounded-full bg-foreground/10 px-2.5 py-1 capitalize">
                {k} {t.portfolio ? Math.round((v / t.portfolio) * 100) : 0}%
              </span>
            ))}
          </div>
        )}
      </div>

      <SectionHead title="Recent activity" right={<Link to="/activity" className="text-primary">See all →</Link>} />
      {d.transactions.length === 0 ? (
        <EmptyNote>Tap the + button to record your first income or expense.</EmptyNote>
      ) : (
        <div className="glass mt-3 divide-y divide-foreground/10 rounded-[18px]">
          {d.transactions.slice(0, 6).map((x) => (
            <TxnRow key={x.id} t={x} d={d} />
          ))}
        </div>
      )}
    </>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: "coral" }) {
  return (
    <div className="rounded-xl bg-foreground/5 px-2 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-mist">{label}</p>
      <p className={`num mt-0.5 text-[12px] font-semibold ${tone === "coral" && value < 0 ? "text-coral" : ""}`}>{rs(value)}</p>
    </div>
  );
}
