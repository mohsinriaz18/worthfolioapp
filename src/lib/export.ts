import * as XLSX from "xlsx";
import {
  categoryBreakdown, debtPaid, debtRemaining, goalStatus, inRange, toISO, totals, type FinanceData,
} from "./finance";

type Row = (string | number | null)[];

export function buildReport(d: FinanceData, start: Date, end: Date, label: string) {
  const t = totals(d);
  const s = toISO(start), e = toISO(end);
  const period = `${label} (${s} to ${e})`;
  const txns = d.transactions.filter((x) => inRange(x, start, end));
  const cat = (id: string | null) => d.categories.find((c) => c.id === id)?.name ?? "Uncategorised";
  const acc = (id: string | null) => d.accounts.find((a) => a.id === id)?.name ?? "";

  function flowSheet(type: "income" | "expense") {
    const rows: Row[] = [["Report period", period], [], ["Category", "Item", "Date", "Account", "Type", "Amount (PKR)", "Subtotal (PKR)"]];
    let grand = 0;
    for (const c of categoryBreakdown(d, type, start, end)) {
      const items = txns.filter((x) => x.type === type && (x.category_id ?? "none") === c.id).sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
      items.forEach((x) => rows.push([c.name, x.note || c.name, x.occurred_on, acc(x.account_id), type, Number(x.amount), null]));
      rows.push([c.name, "Subtotal", null, null, null, null, c.value]);
      grand += c.value;
    }
    rows.push([], ["Grand total", null, null, null, null, null, grand]);
    return { rows, grand };
  }
  const income = flowSheet("income");
  const expense = flowSheet("expense");

  const goalRows: Row[] = [["Report period", period], [], ["Goal", "Category", "Target", "Saved", "Remaining", "Progress %", "Contributed in period", "Target date"]];
  d.goals.forEach((g) => {
    const st = goalStatus(g, d.goalContributions);
    const inPeriod = d.goalContributions.filter((c) => c.goal_id === g.id && c.contributed_on >= s && c.contributed_on <= e).reduce((a, c) => a + Number(c.amount), 0);
    goalRows.push([g.name, g.category, st.target, st.saved, st.remaining, Math.round(st.pctDone * 10) / 10, inPeriod, g.target_date]);
  });
  goalRows.push([], ["Grand total", null, t.goalTarget, t.goalSaved, Math.max(0, t.goalTarget - t.goalSaved), Math.round(t.goalPct * 10) / 10]);

  const invRows: Row[] = [["Report period", period], [], ["Investment", "Type", "Platform", "Units", "Purchase date", "Invested", "Current value", "Gain/Loss", "Gain %"]];
  d.investments.forEach((i) => {
    const g = Number(i.current_value) - Number(i.invested);
    invRows.push([i.name, i.asset_type, i.platform, i.quantity, i.purchase_date, Number(i.invested), Number(i.current_value), g, Number(i.invested) ? Math.round((g / Number(i.invested)) * 1000) / 10 : null]);
  });
  invRows.push([], ["Grand total", null, null, null, null, t.invested, t.portfolio, t.gain, Math.round(t.gainPct * 10) / 10]);

  const debtRows: Row[] = [["Report period", period], [], ["Debt", "Type", "Lender", "Original", "Paid (all time)", "Paid in period", "Remaining", "Interest %"]];
  d.debts.forEach((x) => {
    const inPeriod = d.debtPayments.filter((p) => p.debt_id === x.id && p.paid_on >= s && p.paid_on <= e).reduce((a, p) => a + Number(p.amount), 0);
    debtRows.push([x.name, x.debt_type, x.lender, Number(x.original_amount), debtPaid(x, d.debtPayments), inPeriod, debtRemaining(x, d.debtPayments), Number(x.interest_rate)]);
  });
  debtRows.push([], ["Grand total", null, null, d.debts.reduce((a, x) => a + Number(x.original_amount), 0), d.debtPayments.reduce((a, p) => a + Number(p.amount), 0), null, t.debtTotal]);

  const nwRows: Row[] = [["As of", toISO(new Date())], [], ["Item", "Type", "Amount (PKR)"]];
  t.balances.forEach(({ acc: a, balance }) => nwRows.push([a.name, balance >= 0 ? "Asset (account)" : "Liability (account)", balance]));
  d.investments.forEach((i) => nwRows.push([i.name, "Asset (investment)", Number(i.current_value)]));
  d.debts.forEach((x) => nwRows.push([x.name, "Liability (debt)", -debtRemaining(x, d.debtPayments)]));
  nwRows.push([], ["Total assets", null, t.totalAssets], ["Total liabilities", null, -t.totalLiabilities], ["Net worth", null, t.netWorth]);

  const summary: Row[] = [
    ["Worthfolio financial report"], ["Report period", period], ["Generated", new Date().toLocaleString("en-GB")], [],
    ["Metric", "Amount (PKR)"],
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
    ws["!cols"] = Array.from({ length: 9 }, (_, i) => ({ wch: i === 0 || i === 1 ? 24 : 16 }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, filename);
}

export function downloadCsv(r: ReturnType<typeof buildReport>, filename: string) {
  const rows: Row[] = [["Report period", "Category", "Item", "Date", "Account", "Type", "Amount (PKR)"]];
  for (const x of [...r.txns].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on))) {
    rows.push([r.period, x.type === "transfer" ? "Transfer" : r.cat(x.category_id), x.note ?? "", x.occurred_on, r.acc(x.account_id), x.type, Number(x.amount)]);
  }
  const inc = r.txns.filter((x) => x.type === "income").reduce((a, x) => a + Number(x.amount), 0);
  const exp = r.txns.filter((x) => x.type === "expense").reduce((a, x) => a + Number(x.amount), 0);
  rows.push([], ["Subtotal", "Income", "", "", "", "income", inc], ["Subtotal", "Expenses", "", "", "", "expense", exp], ["Grand total", "Net", "", "", "", "", inc - exp]);
  const csv = rows.map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
}
