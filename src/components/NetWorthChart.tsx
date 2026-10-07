import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { rs } from "@/lib/finance";

export function NetWorthChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div className="mt-4 h-32">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fill: "var(--mist)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <Tooltip
            cursor={{ fill: "oklch(1 0 0 / 5%)" }}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: "var(--mist)" }}
            formatter={(v: number) => [rs(v), "Net worth"]}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === data.length - 1 ? "var(--accent-teal)" : "oklch(0.88 0.015 220 / 14%)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
