import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { todayISO, useFinance, useRefreshFinance } from "@/lib/finance";
import { BottomSheet, Field, PrimaryButton } from "./Sheet";

type Kind = "expense" | "income" | "transfer";

export function AddTransactionSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const d = useFinance();
  const refresh = useRefreshFinance();
  const [kind, setKind] = useState<Kind>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount("");
      setNote("");
      setDate(todayISO());
      setCategoryId(null);
      setAccountId(d.accounts[0]?.id ?? "");
      setToAccountId(d.accounts[1]?.id ?? "");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const cats = d.categories.filter((c) => c.kind === (kind === "income" ? "income" : "expense"));

  async function addCustom() {
    const name = customName.trim();
    if (!name) return;
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("categories")
      .insert({ name, kind: kind === "income" ? "income" : "expense", icon: "★", user_id: u.user!.id })
      .select()
      .single();
    if (error) return toast.error(error.message);
    await refresh();
    setCategoryId(data.id);
    setCustomName("");
    setCustomOpen(false);
  }

  async function save() {
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount");
    if (kind === "transfer" && (!accountId || !toAccountId || accountId === toAccountId)) return toast.error("Pick two different accounts");
    setSaving(true);
    const { error } = await supabase.from("transactions").insert({
      type: kind,
      amount: amt,
      category_id: kind === "transfer" ? null : categoryId,
      account_id: accountId || null,
      to_account_id: kind === "transfer" ? toAccountId : null,
      occurred_on: date,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(kind === "income" ? "Income recorded" : kind === "expense" ? "Expense recorded" : "Transfer recorded");
    await refresh();
    onOpenChange(false);
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Add transaction">
      <div className="glass-l mb-4 flex gap-1 rounded-full p-1">
        {(["expense", "income", "transfer"] as Kind[]).map((k) => (
          <button
            key={k}
            onClick={() => {
              setKind(k);
              setCategoryId(null);
            }}
            className={`flex-1 rounded-full py-1.5 text-[13px] font-semibold capitalize ${
              kind === k ? (k === "expense" ? "bg-coral text-primary-foreground" : "bg-primary text-primary-foreground") : "text-mist"
            }`}
          >
            {k === "expense" ? "Money out" : k === "income" ? "Money in" : "Transfer"}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-baseline gap-2 border-b border-border pb-2">
        <span className="num text-xl text-mist">Rs</span>
        <input
          inputMode="decimal"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder="0"
          className="num w-full bg-transparent text-4xl font-semibold text-foreground outline-none placeholder:text-mist/50"
        />
      </div>

      {kind !== "transfer" && (
        <>
          <p className="eyebrow mb-2 !tracking-[0.14em]">Category</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium ${
                  categoryId === c.id ? "bg-primary font-semibold text-primary-foreground" : "glass-l text-foreground"
                }`}
              >
                <span className="mr-1">{c.icon}</span>
                {c.name}
              </button>
            ))}
            {!customOpen ? (
              <button onClick={() => setCustomOpen(true)} className="rounded-full border border-dashed border-foreground/25 px-3.5 py-1.5 text-[12px] font-medium text-mist">
                + Add custom
              </button>
            ) : (
              <div className="flex w-full gap-2">
                <input autoFocus value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="New category name" className="field !py-2" />
                <button onClick={addCustom} className="rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground">
                  Add
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={kind === "transfer" ? "From" : kind === "income" ? "Into account" : "From account"}>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="field">
            <option value="">— Cash / none —</option>
            {d.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        {kind === "transfer" ? (
          <Field label="To">
            <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className="field">
              {d.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
          </Field>
        )}
      </div>
      {kind === "transfer" && (
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
        </Field>
      )}
      <Field label="Note">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Imtiaz groceries" className="field" />
      </Field>
      <PrimaryButton onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </PrimaryButton>
    </BottomSheet>
  );
}
