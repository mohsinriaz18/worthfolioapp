import { getRates } from "./rates.functions";
// Multi-currency core: currency list, exchange rates (live + cached + fallback + manual),
// and a module-level display context so every total/chart converts consistently.

export type CurrencyInfo = { code: string; name: string; symbol: string; region: string; decimals: number };

export const CURRENCIES: CurrencyInfo[] = [
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨", region: "Pakistan", decimals: 0 },
  { code: "USD", name: "US Dollar", symbol: "$", region: "United States", decimals: 2 },
  { code: "EUR", name: "Euro", symbol: "€", region: "Eurozone", decimals: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", region: "United Kingdom", decimals: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", region: "United Arab Emirates", decimals: 2 },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", region: "Saudi Arabia", decimals: 2 },
  { code: "QAR", name: "Qatari Riyal", symbol: "QR", region: "Qatar", decimals: 2 },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KD", region: "Kuwait", decimals: 3 },
  { code: "BHD", name: "Bahraini Dinar", symbol: "BD", region: "Bahrain", decimals: 3 },
  { code: "OMR", name: "Omani Rial", symbol: "OMR", region: "Oman", decimals: 3 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", region: "India", decimals: 2 },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", region: "Bangladesh", decimals: 2 },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs", region: "Sri Lanka", decimals: 2 },
  { code: "NPR", name: "Nepalese Rupee", symbol: "Rs", region: "Nepal", decimals: 2 },
  { code: "AFN", name: "Afghan Afghani", symbol: "؋", region: "Afghanistan", decimals: 2 },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", region: "China", decimals: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", region: "Japan", decimals: 0 },
  { code: "KRW", name: "South Korean Won", symbol: "₩", region: "South Korea", decimals: 0 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", region: "Hong Kong", decimals: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", region: "Singapore", decimals: 2 },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", region: "Malaysia", decimals: 2 },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", region: "Indonesia", decimals: 0 },
  { code: "THB", name: "Thai Baht", symbol: "฿", region: "Thailand", decimals: 2 },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", region: "Philippines", decimals: 2 },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", region: "Vietnam", decimals: 0 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", region: "Australia", decimals: 2 },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", region: "New Zealand", decimals: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", region: "Canada", decimals: 2 },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$", region: "Mexico", decimals: 2 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", region: "Brazil", decimals: 2 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", region: "Switzerland", decimals: 2 },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", region: "Sweden", decimals: 2 },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", region: "Norway", decimals: 2 },
  { code: "DKK", name: "Danish Krone", symbol: "kr", region: "Denmark", decimals: 2 },
  { code: "PLN", name: "Polish Złoty", symbol: "zł", region: "Poland", decimals: 2 },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", region: "Türkiye", decimals: 2 },
  { code: "RUB", name: "Russian Ruble", symbol: "₽", region: "Russia", decimals: 2 },
  { code: "ZAR", name: "South African Rand", symbol: "R", region: "South Africa", decimals: 2 },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£", region: "Egypt", decimals: 2 },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", region: "Nigeria", decimals: 2 },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", region: "Kenya", decimals: 2 },
];

// Approximate fallback rates: units of currency per 1 USD. Used only when live rates are unavailable.
const FALLBACK: Record<string, number> = {
  USD: 1, PKR: 280, EUR: 0.92, GBP: 0.79, AED: 3.6725, SAR: 3.75, QAR: 3.64, KWD: 0.307, BHD: 0.376, OMR: 0.385,
  INR: 83.5, BDT: 118, LKR: 300, NPR: 133, AFN: 71, CNY: 7.2, JPY: 150, KRW: 1350, HKD: 7.8, SGD: 1.34, MYR: 4.6,
  IDR: 15800, THB: 35.5, PHP: 57, VND: 25000, AUD: 1.5, NZD: 1.65, CAD: 1.36, MXN: 18, BRL: 5.3, CHF: 0.88, SEK: 10.5,
  NOK: 10.7, DKK: 6.9, PLN: 3.95, TRY: 33, RUB: 92, ZAR: 18.5, EGP: 48, NGN: 1500, KES: 130,
};

export const getCurrency = (code: string): CurrencyInfo =>
  CURRENCIES.find((c) => c.code === code) ?? { code, name: code, symbol: code, region: "", decimals: 2 };

// ---------- module state ----------
type State = { perUsd: Record<string, number>; source: "live" | "cached" | "fallback"; updatedAt: string | null; display: string; primary: string; secondary: string };
const state: State = { perUsd: { ...FALLBACK }, source: "fallback", updatedAt: null, display: "PKR", primary: "PKR", secondary: "USD" };

export const fx = () => state;
export function setCurrencyContext(p: Partial<Pick<State, "display" | "primary" | "secondary">>) {
  Object.assign(state, p);
}
export function setManualRates(manual: Record<string, number>) {
  for (const [k, v] of Object.entries(manual)) if (Number(v) > 0) state.perUsd[k] = Number(v);
}

const CACHE_KEY = "wf-fx-v1";
export async function loadRates(manual: Record<string, number> = {}) {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as { rates: Record<string, number>; at: string } | null;
    if (c && Date.now() - new Date(c.at).getTime() < 12 * 3600_000) {
      state.perUsd = { ...FALLBACK, ...c.rates };
      state.source = "cached";
      state.updatedAt = c.at;
      setManualRates(manual);
      return;
    }
  } catch { /* ignore */ }
  try {
    const j = await getRates();
    if (j.rates && j.at) {
      state.perUsd = { ...FALLBACK, ...j.rates };
      state.source = "live";
      state.updatedAt = j.at;
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rates: j.rates, at: j.at }));
    }
  } catch { /* keep fallback */ }
  setManualRates(manual);
}

/** USD value of one unit of `code` right now. */
export const usdPerUnit = (code: string) => 1 / (state.perUsd[code] ?? FALLBACK[code] ?? 1);

/** Convert using current rates. */
export function convert(amount: number, from: string, to: string = state.display) {
  if (from === to) return amount;
  return amount * usdPerUnit(from) / usdPerUnit(to);
}
/** Convert a stored transaction using its snapshot rate when available (keeps history stable). */
export function convertTxn(amount: number, from: string, fxUsd: number | null | undefined, to: string = state.display) {
  if (from === to) return amount;
  const usd = amount * (fxUsd ? Number(fxUsd) : usdPerUnit(from));
  return usd / usdPerUnit(to);
}
/** Rate used to go from `from` to `to` for a txn. */
export function txnRate(from: string, fxUsd: number | null | undefined, to: string) {
  return convertTxn(1, from, fxUsd, to);
}

// ---------- formatting ----------
const ambiguous = new Set(["$", "¥", "kr", "Rs", "R"]);
export function fmtMoney(n: number, code: string = state.display, opts: { sign?: boolean; code?: boolean } = {}) {
  const c = getCurrency(code);
  const big = Math.abs(n) >= 1000;
  const dec = big && c.decimals === 2 && Math.abs(n) >= 100000 ? 0 : c.decimals;
  const abs = new Intl.NumberFormat("en-US", { minimumFractionDigits: dec === 0 ? 0 : Math.abs(n) % 1 ? dec : 0, maximumFractionDigits: dec }).format(Math.abs(n));
  const s = n < 0 ? "−" : opts.sign && n > 0 ? "+" : "";
  const showCode = opts.code ?? (code !== state.display && ambiguous.has(c.symbol));
  return `${s}${c.symbol}${c.symbol.length > 1 ? " " : ""}${abs}${showCode ? ` ${code}` : ""}`;
}
