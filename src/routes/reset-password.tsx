import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Backdrop } from "@/components/AppShell";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Worthfolio" },
      { name: "description", content: "Choose a new password for your Worthfolio account." },
      { property: "og:title", content: "Reset password — Worthfolio" },
      { property: "og:description", content: "Choose a new password for your Worthfolio account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) { toast.error("At least 6 characters"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Backdrop />
      <form onSubmit={submit} className="relative z-10 mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-5">
        <h1 className="text-3xl font-bold">Set a new password</h1>
        <p className="mt-2 text-sm text-mist">Open this page from the link in your email.</p>
        <div className="glass mt-6 rounded-[22px] p-5">
          <input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className="field mb-4" />
          <button disabled={busy} className="glow w-full rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "Saving…" : "Update password"}
          </button>
        </div>
      </form>
    </div>
  );
}
