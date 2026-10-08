import * as XLSX from "xlsx";
import { convert, fx, txnRate } from "./currency";
import {
  categoryBreakdown, txnAmt, debtPaid, debtRemaining, goalStatus, inRange, toISO, totals, type FinanceData,
} from "./finance";

type Row = (string | number | null)[];

export function buildReport(d: FinanceData, start: Date, end: Date, label: string) {
  const t = totals(d);
  const R = fx().display;
  const s = toISO(start), e = toISO(end);
  const period = `${label} (${s} to ${e})`;
  const txns = d.transactions.filter((x) => inRange(x, start, end));
  const cat = (id: string | null) => d.categories.find((c) => c.id === id)?.name ?? "Uncategorised";
  const acc = (id: string | null) => d.accounts.find((a) => a.id === id)?.name ?? "";

  function flowSheet(type: "income" | "expense") {
    const rows: Row[] = [["Report period", period], [], ["Category", "Item", "Date", "Account", "Type", "Original amount", "Currency", "Exchange rate", `Converted (${R})`, `Subtotal (${R})`]];
    let grand = 0;
    for (const c of categoryBreakdown(d, type, start, end)) {
      const items = txns.filter((x) => x.type === type && (x.category_id ?? "none") === c.id).sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
      items.forEach((x) => rows.push([c.name, x.note || c.name, x.occurred_on, acc(x.account_id), type, Number(x.amount), x.currency, round(txnRate(x.currency, x.fx_usd, R), 6), round(txnAmt(x, R), 2), null]));
      rows.push([c.name, "Subtotal", null, null, null, null, null, null, null, round(c.value, 2)]);
      grand += c.value;
    }
    rows.push([], ["Grand total", null, null, null, null, null, null, null, null, round(grand, 2)], ["Report currency", R]);
    return { rows, grand };
  }
  const income = flowSheet("income");
  const expense = flowSheet("expense");

  const goalRows: Row[] = [["Report period", period], [], ["Goal", "Category", "Currency", "Target", "Saved", "Remaining", "Progress %", "Contributed in period", "Target date", `Saved (${R})`]];
  d.goals.forEach((g) => {
    const st = goalStatus(g, d.goalContributions);
    const inPeriod = d.goalContributions.filter((c) => c.goal_id === g.id && c.contributed_on >= s && c.contributed_on <= e).reduce((a, c) => a + Number(c.amount), 0);
    goalRows.push([g.name, g.category, g.currency, st.target, st.saved, st.remaining, Math.round(st.pctDone * 10) / 10, inPeriod, g.target_date, round(convert(st.saved, g.currency, R), 2)]);
  });
  goalRows.push([], [`Grand total (${R})`, null, R, round(t.goalTarget, 2), round(t.goalSaved, 2), round(Math.max(0, t.goalTarget - t.goalSaved), 2), Math.round(t.goalPct * 10) / 10]);

  const invRows: Row[] = [["Report period", period], [], ["Investment", "Type", "Platform", "Currency", "Units", "Purchase date", "Invested", "Current value", "Gain/Loss", "Gain %", `Current value (${R})`, `Gain/Loss (${R})`]];
  d.investments.forEach((i) => {
    const g = Number(i.current_value) - Number(i.invested);
    invRows.push([i.name, i.asset_type, i.platform, i.currency, i.quantity, i.purchase_date, Number(i.invested), Number(i.current_value), g, Number(i.invested) ? Math.round((g / Number(i.invested)) * 1000) / 10 : null, round(convert(Number(i.current_value), i.currency, R), 2), round(convert(g, i.currency, R), 2)]);
  });
  invRows.push([], [`Grand total (${R})`, null, null, R, null, null, round(t.invested, 2), round(t.portfolio, 2), round(t.gain, 2), Math.round(t.gainPct * 10) / 10]);

  const debtRows: Row[] = [["Report period", period], [], ["Debt", "Type", "Lender", "Currency", "Original", "Paid (all time)", "Paid in period", "Remaining", "Interest %", `Remaining (${R})`]];
  d.debts.forEach((x) => {
    const inPeriod = d.debtPayments.filter((p) => p.debt_id === x.id && p.paid_on >= s && p.paid_on <= e).reduce((a, p) => a + Number(p.amount), 0);
    debtRows.push([x.name, x.debt_type, x.lender, x.currency, Number(x.original_amount), debtPaid(x, d.debtPayments), inPeriod, debtRemaining(x, d.debtPayments), Number(x.interest_rate), round(convert(debtRemaining(x, d.debtPayments), x.currency, R), 2)]);
  });
  debtRows.push([], [`Grand total (${R})`, null, null, R, null, null, null, round(t.debtTotal, 2)]);

  const nwRows: Row[] = [["As of", toISO(new Date())], [], ["Item", "Type", "Original amount", "Currency", `Amount (${R})`]];
  t.balances.forEach(({ acc: a, balance, display }) => nwRows.push([a.name, balance >= 0 ? "Asset (account)" : "Liability (account)", balance, a.currency, round(display, 2)]));
  d.investments.forEach((i) => nwRows.push([i.name, "Asset (investment)", Number(i.current_value), i.currency, round(convert(Number(i.current_value), i.currency, R), 2)]));
  d.debts.forEach((x) => { const rem = debtRemaining(x, d.debtPayments); nwRows.push([x.name, "Liability (debt)", -rem, x.currency, round(-convert(rem, x.currency, R), 2)]); });
  nwRows.push([], ["Total assets", null, null, R, round(t.totalAssets, 2)], ["Total liabilities", null, null, R, round(-t.totalLiabilities, 2)], ["Net worth", null, null, R, round(t.netWorth, 2)]);

  const summary: Row[] = [
    ["Worthfolio financial report"], ["Report period", period], ["Generated", new Date().toLocaleString("en-GB")], [],
    ["Report currency", R], ["Exchange rates", `${fx().source} · ${fx().updatedAt ?? "built-in"}`], [],
    ["Metric", `Amount (${R})`],
    ["Total income", income.grand], ["Total expenses", expense.grand], ["Net savings", income.grand - expense.grand],
    ["Savings rate %", income.grand ? Math.round(((income.grand - expense.grand) / income.grand) * 1000) / 10 : 0], [],
    ["Total invested", t.invested], ["Investment value", t.portfolio], ["Investment gain/loss", t.gain], [],
    ["Goals saved", t.goalSaved], ["Goals target", t.goalTarget], [],
    ["Total debt", t.debtTotal], [],
    ["Total assets", t.totalAssets], ["Total liabilities", t.totalLiabilities], ["Net worth", t.netWorth],
  ];

  return {
    sheets: { Summary: summary, Income: income.rows, Expenses: expense.rows, Investments: invRows, Goals: goalRows, Debts: debtRows, "Net Worth": nwRows },
    txns, cat, acc, period,
  };
}

export function downloadXlsx(r: ReturnType<typeof buildReport>, filename: string) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(r.sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = Array.from({ length: 12 }, (_, i) => ({ wch: i === 0 || i === 1 ? 24 : 16 }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, filename);
}

export function downloadCsv(r: ReturnType<typeof buildReport>, filename: string) {
  const R = fx().display;
  const rows: Row[] = [["Report period", "Category", "Item", "Date", "Account", "Type", "Original amount", "Currency", "Exchange rate", "Converted amount", "Report currency"]];
  for (const x of [...r.txns].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on))) {
    rows.push([r.period, x.type === "transfer" ? "Transfer" : r.cat(x.category_id), x.note ?? "", x.occurred_on, r.acc(x.account_id), x.type, Number(x.amount), x.currency, round(txnRate(x.currency, x.fx_usd, R), 6), round(txnAmt(x, R), 2), R]);
  }
  const inc = r.txns.filter((x) => x.type === "income").reduce((a, x) => a + txnAmt(x, R), 0);
  const exp = r.txns.filter((x) => x.type === "expense").reduce((a, x) => a + txnAmt(x, R), 0);
  rows.push([], ["Subtotal", "Income", "", "", "", "income", "", "", "", round(inc, 2), R], ["Subtotal", "Expenses", "", "", "", "expense", "", "", "", round(exp, 2), R], ["Grand total", "Net", "", "", "", "", "", "", "", round(inc - exp, 2), R]);
  const csv = rows.map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
}

function round(n: number, dp: number) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
