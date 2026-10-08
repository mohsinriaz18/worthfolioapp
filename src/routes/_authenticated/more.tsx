import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/more")({
  head: () => ({ meta: [{ title: "More — Worthfolio" }, { name: "description", content: "Debts, bills, reports, activity and settings." }] }),
  component: () => (
    <AppShell title="More">
      <More />
    </AppShell>
  ),
});

const items = [
  { to: "/debts", icon: "💳", title: "Debts & Loans", sub: "Balances, payments, payoff progress" },
  { to: "/bills", icon: "◐", title: "Bills", sub: "Recurring bills and due dates" },
  { to: "/reports", icon: "▥", title: "Reports & export", sub: "Weekly, monthly, yearly, custom · Excel / CSV" },
  { to: "/activity", icon: "≡", title: "All activity", sub: "Every income, expense and transfer" },
  { to: "/settings", icon: "⚙", title: "Profile & settings", sub: "Name, password, theme, reminders" },
] as const;

function More() {
  return (
    <div className="glass mt-5 divide-y divide-foreground/10 rounded-[18px]">
      {items.map((i) => (
        <Link key={i.to} to={i.to} className="flex items-center gap-3 px-4 py-4">
          <div className="grid size-10 place-items-center rounded-[12px] bg-primary/15 text-[16px] text-primary">{i.icon}</div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">{i.title}</p>
            <p className="truncate text-[12px] text-mist">{i.sub}</p>
          </div>
          <span className="text-mist">›</span>
        </Link>
      ))}
    </div>
  );
}
