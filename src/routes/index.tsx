import { createFileRoute, Link } from "@tanstack/react-router";
import { Backdrop } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ledger — Track Money, Bills & Net Worth" },
      { name: "description", content: "An installable money app: income, expenses, bank accounts, bills, investments, net worth and reports." },
      { property: "og:title", content: "Ledger — Track Money, Bills & Net Worth" },
      { property: "og:description", content: "Income, expenses, accounts, bills, investments, net worth and reports in one app." },
    ],
  }),
  component: Index,
});

const points = ["Money in & out", "Bank accounts", "Bills & due dates", "Investments", "Net worth trend", "Monthly · quarterly · yearly reports"];

function Index() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Backdrop />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[480px] flex-col justify-center px-5 py-10">
        <div className="glow mb-6 grid size-14 place-items-center rounded-2xl bg-primary text-2xl font-extrabold text-primary-foreground">L</div>
        <p className="eyebrow">Private ledger</p>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight">Know exactly where every rupee goes.</h1>
        <p className="mt-3 text-mist">More than an expense tracker — your complete financial picture, on your home screen.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {points.map((p) => (
            <span key={p} className="glass-l rounded-full px-3.5 py-1.5 text-[12px]">{p}</span>
          ))}
        </div>
        <Link to="/dashboard" className="glow mt-8 rounded-2xl bg-primary py-4 text-center font-semibold text-primary-foreground">
          Open my ledger
        </Link>
        <p className="mt-4 text-center text-[12px] text-mist">Tip: in your phone browser, tap Share → "Add to Home Screen" to install.</p>
      </div>
    </div>
  );
}
