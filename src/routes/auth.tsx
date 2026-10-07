import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Backdrop } from "@/components/AppShell";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Ledger" },
      { name: "description", content: "Sign in to track your money, accounts, bills and net worth." },
      { property: "og:title", content: "Sign in — Ledger" },
      { property: "og:description", content: "Sign in to track your money, accounts, bills and net worth." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/dashboard", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/dashboard" } });
      if (error) toast.error(error.message);
      else toast.success("Check your email to confirm your account");
    }
    setBusy(false);
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Google sign-in failed");
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Backdrop />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-5">
        <div className="glow mb-6 grid size-14 place-items-center rounded-2xl bg-primary text-2xl font-extrabold text-primary-foreground">L</div>
        <p className="eyebrow">Ledger</p>
        <h1 className="mt-1 text-3xl font-bold">{mode === "in" ? "Welcome back" : "Create your ledger"}</h1>
        <p className="mt-2 text-sm text-mist">Every rupee in and out, your accounts, bills and net worth in one place.</p>
        <form onSubmit={submit} className="glass mt-6 rounded-[22px] p-5">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="field mb-3" />
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="field mb-4" />
          <button disabled={busy} className="glow w-full rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
          </button>
          <button type="button" onClick={google} className="glass-l mt-3 w-full rounded-2xl py-3.5 font-semibold">
            Continue with Google
          </button>
        </form>
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-5 text-sm text-mist">
          {mode === "in" ? "New here? " : "Have an account? "}
          <span className="font-semibold text-primary">{mode === "in" ? "Create an account" : "Sign in"}</span>
        </button>
      </div>
    </div>
  );
}
