import { Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { startReminderLoop } from "@/lib/reminders";
import { CurrencyProvider } from "./CurrencyProvider";
import { Plus, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AddTransactionSheet } from "./AddTransactionSheet";
import { initials } from "@/lib/finance";

const tabs = [
  { to: "/dashboard", label: "Home", icon: "◈" },
  { to: "/accounts", label: "Accounts", icon: "▤" },
  { to: "/investments", label: "Invest", icon: "◔" },
  { to: "/goals", label: "Goals", icon: "◎" },
  { to: "/more", label: "More", icon: "☰" },
] as const;

export function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="animate-drift absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
      <div className="animate-drift2 absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-glow-blue/20 blur-3xl" />
      <div className="absolute bottom-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-glow-violet/10 blur-3xl" />
      <div className="glass-l absolute -top-10 -right-16 h-40 w-40 rotate-[24deg] rounded-[3rem]" />
      <div className="glass-l absolute top-[26rem] -left-12 h-32 w-32 -rotate-12 rounded-[2.5rem]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/40 to-background/80" />
    </div>
  );
}

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  useEffect(() => startReminderLoop(), []);
  const name = (user.user_metadata?.["full_name"] as string | undefined) ?? user.email ?? "You";

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Backdrop />
      <div className="relative z-10 mx-auto w-full max-w-[480px] px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-36">
        <header className="no-print flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="glow grid size-9 place-items-center rounded-[11px] bg-primary text-lg font-extrabold text-primary-foreground">W</div>
            <div>
              <p className="eyebrow">Worthfolio</p>
              <p className="text-[13px] font-semibold">{title}</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={signOut} aria-label="Sign out" className="glass-l grid size-9 place-items-center rounded-full text-mist">
              <LogOut className="size-4" />
            </button>
            <Link to="/settings" aria-label="Profile and settings" className="glass-l grid size-9 place-items-center rounded-full text-[13px] font-semibold">{initials(name)}</Link>
          </div>
        </header>
        <CurrencyProvider userId={user.id} meta={user.user_metadata ?? {}}>
          <Suspense fallback={<div className="mt-10 text-center text-sm text-mist">Loading…</div>}>{children}</Suspense>
          <Suspense fallback={null}>
            <AddTransactionSheet open={addOpen} onOpenChange={setAddOpen} />
          </Suspense>
        </CurrencyProvider>
      </div>

      <button
        onClick={() => setAddOpen(true)}
        aria-label="Add transaction"
        className="no-print glow fixed bottom-[96px] left-1/2 z-30 ml-[min(180px,calc(50vw-68px))] grid size-14 -translate-x-1/2 place-items-center rounded-full bg-primary text-primary-foreground transition active:scale-95"
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </button>

      <nav className="no-print fixed bottom-0 left-1/2 z-20 w-full max-w-[480px] -translate-x-1/2 pb-[env(safe-area-inset-bottom)]">
        <div className="glass-l mx-4 mb-4 flex items-center justify-between rounded-[20px] bg-background/70 px-2 py-2 backdrop-blur-xl">
          {tabs.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="flex flex-1 flex-col items-center gap-1 rounded-[14px] py-2 text-mist"
              activeProps={{ className: "bg-primary/15 !text-primary" }}
            >
              <span className="text-[16px]">{t.icon}</span>
              <span className="text-[10px] font-semibold">{t.label}</span>
            </Link>
          ))}
        </div>
      </nav>

    </div>
  );
}

export function SectionHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="mt-6 flex items-baseline justify-between">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {right && <span className="text-[12px] font-medium text-mist">{right}</span>}
    </div>
  );
}

export function PeriodToggle<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <div className="glass-l flex gap-1 rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`flex-1 rounded-full px-3 py-1.5 text-center text-[12px] font-semibold transition ${
            value === o.v ? "bg-primary text-primary-foreground" : "text-mist"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="glass mt-3 rounded-[18px] px-4 py-6 text-center text-[13px] text-mist">{children}</div>;
}
