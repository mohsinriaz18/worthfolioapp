import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fx, loadRates, setCurrencyContext } from "@/lib/currency";

type Ctx = {
  display: string;
  primary: string;
  secondary: string;
  lastUsed: string;
  setDisplay: (c: string) => void;
  rememberCurrency: (c: string) => void;
  savePrefs: (p: { primary?: string; secondary?: string }) => Promise<void>;
  version: number;
};
const CurrencyCtx = createContext<Ctx | null>(null);
export const useCurrency = () => {
  const c = useContext(CurrencyCtx);
  if (!c) throw new Error("useCurrency outside provider");
  return c;
};

export function CurrencyProvider({ userId, meta, children }: { userId: string; meta: Record<string, unknown>; children: ReactNode }) {
  const qc = useQueryClient();
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const profile = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (data) return data;
      // first visit: create profile from currencies chosen at signup
      const primary = (meta["primary_currency"] as string) || "PKR";
      const secondary = (meta["secondary_currency"] as string) || (primary === "USD" ? "PKR" : "USD");
      const { data: created } = await supabase
        .from("profiles")
        .upsert({ id: userId, full_name: (meta["full_name"] as string) ?? null, primary_currency: primary, secondary_currency: secondary, display_currency: primary })
        .select()
        .single();
      return created;
    },
    staleTime: 60_000,
  });

  const p = profile.data;
  useEffect(() => {
    if (!p) return;
    // primary is always the default view; secondary is a session-only toggle
    setCurrencyContext({ primary: p.primary_currency, secondary: p.secondary_currency, display: p.primary_currency });
    loadRates().finally(() => {
      setReady(true);
      setVersion((v) => v + 1);
    });
  }, [p?.primary_currency, p?.secondary_currency]); // eslint-disable-line react-hooks/exhaustive-deps

  async function update(patch: Record<string, unknown>) {
    await supabase.from("profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", userId);
    await qc.invalidateQueries({ queryKey: ["profile", userId] });
  }

  const value: Ctx = {
    display: fx().display,
    primary: fx().primary,
    secondary: fx().secondary,
    lastUsed: p?.last_used_currency || fx().primary,
    version,
    setDisplay: (c) => {
      setCurrencyContext({ display: c });
      setVersion((v) => v + 1);
    },
    rememberCurrency: (c) => {
      if (c !== p?.last_used_currency) update({ last_used_currency: c });
    },
    savePrefs: async (prefs) => {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, primary_currency: prefs.primary ?? fx().primary, secondary_currency: prefs.secondary ?? fx().secondary, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
      setCurrencyContext({ primary: prefs.primary ?? fx().primary, secondary: prefs.secondary ?? fx().secondary, display: prefs.primary ?? fx().primary });
      await qc.invalidateQueries({ queryKey: ["profile", userId] });
      setVersion((v) => v + 1);
    },
  };

  if (!ready) return <div className="mt-10 text-center text-sm text-mist">Loading…</div>;
  return (
    <CurrencyCtx.Provider value={value}>
      <div key={`${fx().display}-${version}`} className="contents">{children}</div>
    </CurrencyCtx.Provider>
  );
}
