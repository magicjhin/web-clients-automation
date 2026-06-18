'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  PieChart,
  Pie,
} from 'recharts';
import { useI18n } from '@/lib/i18n/provider';

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid hsl(40 8% 90%)',
  fontSize: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
};

/** Горизонтальный бар: топ ниш по числу лидов. */
export function NicheBarChart({ data }: { data: { name: string; leads: number }[] }) {
  const { dict } = useI18n();
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: 'hsl(0 0% 35%)' }}
        />
        <Tooltip
          cursor={{ fill: 'hsl(48 14% 94%)' }}
          contentStyle={tooltipStyle}
          formatter={(value) => [Number(value ?? 0).toLocaleString('ru-RU'), dict.table.leadsWord]}
        />
        <Bar dataKey="leads" radius={[0, 6, 6, 0]} fill="#a3e635" barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Пончик: распределение кредит-риска A/B/C. */
export function CreditDonutChart({
  a,
  b,
  c,
  d = 0,
  e = 0,
}: {
  a: number;
  b: number;
  c: number;
  d?: number;
  e?: number;
}) {
  const { dict } = useI18n();
  const f = dict.filters;
  const data = [
    { name: f.riskA, value: a, fill: '#65a30d' },
    { name: f.riskB, value: b, fill: '#94a3b8' },
    { name: f.riskC, value: c, fill: '#f59e0b' },
    { name: f.riskD, value: d, fill: '#ef4444' },
    { name: f.riskE, value: e, fill: '#b91c1c' },
  ].filter((x) => x.value > 0);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={52}
          outerRadius={80}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) => [Number(value ?? 0).toLocaleString('ru-RU'), name]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
