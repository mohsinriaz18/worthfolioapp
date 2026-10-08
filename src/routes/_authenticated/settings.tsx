import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PeriodToggle, SectionHead } from "@/components/AppShell";
import { Field, PrimaryButton } from "@/components/Sheet";
import { supabase } from "@/integrations/supabase/client";
import { getThemePref, setThemePref, type ThemePref } from "@/lib/theme";
import { checkReminderNow, notify } from "@/lib/reminders";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Worthfolio" }, { name: "description", content: "Profile, password, theme and reminder settings." }] }),
  component: () => (
    <AppShell title="Settings">
      <Settings />
    </AppShell>
  ),
});

function Settings() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });
  const [name, setName] = useState("");
  const [reminders, setReminders] = useState(false);
  const [time, setTime] = useState("21:00");
  const [theme, setTheme] = useState<ThemePref>("system");
  const [pw, setPw] = useState({ current: "", next: "" });
  const [perm, setPerm] = useState<string>("default");

  useEffect(() => {
    setTheme(getThemePref());
    setPerm("Notification" in window ? Notification.permission : "unsupported");
  }, []);
  useEffect(() => {
    if (profile.data !== undefined) {
      setName(profile.data?.full_name ?? (user.user_metadata?.["full_name"] as string) ?? "");
      setReminders(profile.data?.reminders_enabled ?? false);
      setTime(profile.data?.reminder_time ?? "21:00");
    }
  }, [profile.data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function upsert(patch: { full_name?: string; reminders_enabled?: boolean; reminder_time?: string }) {
    const { error } = await supabase.from("profiles").upsert({ id: user.id, ...patch, updated_at: new Date().toISOString() });
    if (error) { toast.error(error.message); return false; }
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
    return true;
  }
  async function saveName() {
    if (await upsert({ full_name: name.trim() })) {
      await supabase.auth.updateUser({ data: { full_name: name.trim() } });
      toast.success("Profile updated");
    }
  }
  async function toggleReminders(on: boolean) {
    if (on) {
      if (!("Notification" in window)) { toast.error("This browser doesn't support notifications"); return; }
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p !== "granted") { toast.error("Allow notifications in your browser settings to get reminders"); return; }
    }
    setReminders(on);
    if (await upsert({ reminders_enabled: on, reminder_time: time })) {
      toast.success(on ? "Daily reminder on" : "Daily reminder off");
      if (on) checkReminderNow();
    }
  }
  async function saveTime(v: string) {
    setTime(v);
    await upsert({ reminder_time: v });
  }
  async function changePassword() {
    if (pw.next.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    const { error } = await supabase.auth.updateUser({ password: pw.next, current_password: pw.current } as { password: string });
    if (error) { toast.error(error.message); return; }
    setPw({ current: "", next: "" });
    toast.success("Password changed");
  }
  async function resetEmail() {
    const { error } = await supabase.auth.resetPasswordForEmail(user.email!, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) toast.error(error.message);
    else toast.success("Reset link sent to your email");
  }
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <>
      <SectionHead title="Profile" />
      <div className="glass mt-3 rounded-[18px] p-4">
        <Field label="Name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email"><input className="field opacity-70" value={user.email ?? ""} readOnly /></Field>
        <PrimaryButton onClick={saveName}>Save profile</PrimaryButton>
      </div>

      <SectionHead title="Appearance" />
      <div className="glass mt-3 rounded-[18px] p-4">
        <PeriodToggle
          value={theme}
          onChange={(v) => {
            setTheme(v);
            setThemePref(v);
          }}
          options={[{ v: "light", l: "☀ Light" }, { v: "dark", l: "☾ Dark" }, { v: "system", l: "System" }]}
        />
      </div>

      <SectionHead title="Daily reminder" />
      <div className="glass mt-3 rounded-[18px] p-4">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-[14px] font-medium">Remind me to log entries</span>
            <span className="block text-[12px] text-mist">Only if nothing was added that day · once per day</span>
          </span>
          <input type="checkbox" className="size-6 accent-[var(--accent-teal)]" checked={reminders} onChange={(e) => toggleReminders(e.target.checked)} />
        </label>
        {reminders && (
          <div className="mt-3">
            <Field label="Reminder time"><input type="time" className="field" value={time} onChange={(e) => saveTime(e.target.value)} /></Field>
            <button onClick={() => notify("Worthfolio", "Test reminder — notifications are working.").then((ok) => !ok && toast.error("Notifications are blocked"))} className="glass-l w-full rounded-2xl py-3 text-[13px] font-semibold">
              Send a test notification
            </button>
          </div>
        )}
        <p className="mt-3 text-[11px] text-mist">
          Permission: {perm}. Reminders arrive while Worthfolio is open or running in the background on your phone. For best results, install it to your home screen.
        </p>
      </div>

      <SectionHead title="Security" />
      <div className="glass mt-3 rounded-[18px] p-4">
        <Field label="Current password"><input type="password" className="field" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
        <Field label="New password"><input type="password" className="field" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
        <PrimaryButton onClick={changePassword}>Change password</PrimaryButton>
        <button onClick={resetEmail} className="mt-3 w-full text-[13px] text-primary">Forgot password? Email me a reset link</button>
      </div>

      <button onClick={signOut} className="glass-l mt-6 w-full rounded-2xl py-3.5 font-semibold text-coral">Log out</button>
    </>
  );
}
