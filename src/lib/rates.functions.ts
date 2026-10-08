import { createServerFn } from "@tanstack/react-start";

// Exchange rates are fetched on the server (units of currency per 1 USD).
let cache: { rates: Record<string, number>; at: number } | null = null;

export const getRates = createServerFn({ method: "GET" }).handler(async () => {
  if (cache && Date.now() - cache.at < 6 * 3600_000) return { rates: cache.rates, at: new Date(cache.at).toISOString() };
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const j = (await r.json()) as { result: string; rates: Record<string, number> };
    if (j.result === "success") {
      cache = { rates: j.rates, at: Date.now() };
      return { rates: j.rates, at: new Date().toISOString() };
    }
  } catch (e) {
    console.error("rates fetch failed", e);
  }
  return { rates: null as Record<string, number> | null, at: null as string | null };
});
