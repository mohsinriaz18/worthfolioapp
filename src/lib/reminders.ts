import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "./finance";

/**
 * Daily ledger reminder. Runs while the app is open (or installed and in the background
 * where the browser keeps it alive): at the user's chosen time, if no entry was logged today
 * and no reminder was sent today, shows one notification and records the date so it never
 * repeats the same day (stored on the profile, so it holds across devices).
 */
let timer: ReturnType<typeof setTimeout> | null = null;

export async function notify(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (reg) await reg.showNotification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png", tag: "daily-ledger" });
  else new Notification(title, { body, icon: "/icon-192.png", tag: "daily-ledger" });
  return true;
}

export async function checkReminderNow() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { data: p } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
  if (!p?.reminders_enabled) return;
  const today = todayISO();
  if (p.last_reminder_on === today) return; // already reminded today
  const [h, m] = p.reminder_time.split(":").map(Number);
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < (h ?? 21) * 60 + (m ?? 0)) return;
  const { count } = await supabase.from("transactions").select("id", { count: "exact", head: true }).eq("occurred_on", today);
  if ((count ?? 0) > 0) return; // user already logged something today
  // claim today's slot first so two tabs can't both send
  const { data: claimed } = await supabase
    .from("profiles")
    .update({ last_reminder_on: today })
    .eq("id", u.user.id)
    .or(`last_reminder_on.is.null,last_reminder_on.neq.${today}`)
    .select("id");
  if (!claimed?.length) return;
  await notify("Worthfolio", "You haven't added anything to your ledger today. Take a moment to update Worthfolio.");
}

export function startReminderLoop() {
  if (typeof window === "undefined") return;
  if (timer) clearInterval(timer as unknown as number);
  checkReminderNow();
  timer = setInterval(checkReminderNow, 5 * 60 * 1000) as unknown as ReturnType<typeof setTimeout>;
}

export async function registerNotificationWorker() {
  if (!("serviceWorker" in navigator)) return;
  const inIframe = window.self !== window.top;
  const host = location.hostname;
  if (inIframe || host.includes("id-preview--") || host.includes("lovableproject.com") || host === "localhost") return;
  await navigator.serviceWorker.register("/notify-sw.js");
}
