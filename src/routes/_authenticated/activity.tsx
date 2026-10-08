import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, EmptyNote, PeriodToggle } from "@/components/AppShell";
import { TxnRow } from "@/components/TxnRow";
import { supabase } from "@/integrations/supabase/client";
import { financeQuery, useFinance, useRefreshFinance } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "All activity — Worthfolio" }, { name: "description", content: "Every income, expense and transfer you've recorded." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(financeQuery),
  component: () => (
    <AppShell title="All activity">
      <Activity />
    </AppShell>
  ),
  errorComponent: ({ error }) => <div className="p-6 text-coral">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function Activity() {
  const d = useFinance();
  const refresh = useRefreshFinance();
  const [type, setType] = useState<"all" | "income" | "expense" | "transfer">("all");
  const [q, setQ] = useState("");
  const list = d.transactions.filter((t) => {
    if (type !== "all" && t.type !== type) return false;
    if (!q) return true;
    const c = d.categories.find((x) => x.id === t.category_id);
    return `${t.note ?? ""} ${c?.name ?? ""}`.toLowerCase().includes(q.toLowerCase());
  });

  async function del(id: string) {
    if (!confirm("Delete this transaction?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  return (
    <>
      <div className="mt-5">
        <PeriodToggle value={type} onChange={setType} options={[{ v: "all", l: "All" }, { v: "income", l: "In" }, { v: "expense", l: "Out" }, { v: "transfer", l: "Transfers" }]} />
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes or categories" className="field mt-3" />
      {list.length === 0 ? (
        <EmptyNote>Nothing here yet.</EmptyNote>
      ) : (
        <div className="glass mt-3 divide-y divide-foreground/10 rounded-[18px]">
          {list.map((t) => (
            <TxnRow key={t.id} t={t} d={d} onDelete={() => del(t.id)} />
          ))}
        </div>
      )}
    </>
  );
}
