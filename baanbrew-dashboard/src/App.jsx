import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  computeKpis,
  dailyRevenue,
  formatBaht,
  formatBahtShort,
  formatNumber,
  formatThaiDate,
  movingAverage,
  prepareRows,
  revenueByBranch,
} from './lib/metrics.js'

const BROWN = '#92400e' // amber-800
const LIGHT_BROWN = '#fcd34d' // amber-300 — เส้นรายวันแบบจาง
const SERIES_NAMES = { revenue: 'ยอดขายรายวัน', avg: 'ค่าเฉลี่ย 7 วัน' }

// true เมื่อจอกว้างน้อยกว่า 640px (จุดเดียวกับ sm: ของ Tailwind) และอัปเดตเมื่อหมุนจอ/ย่อหน้าต่าง
function useIsMobile() {
  const query = '(max-width: 639px)'
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e) => setIsMobile(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return isMobile
}

export default function App() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const isMobile = useIsMobile()

  // อ่าน public/sales.csv ครั้งเดียวตอนเปิดหน้า
  useEffect(() => {
    Papa.parse('/sales.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => setRows(prepareRows(result.data)),
      error: (err) => setError(err.message),
    })
  }, [])

  const kpis = useMemo(() => rows && computeKpis(rows), [rows])
  const daily = useMemo(() => rows && movingAverage(dailyRevenue(rows), 7), [rows])
  const branches = useMemo(() => rows && revenueByBranch(rows), [rows])

  if (error) return <Status text={`อ่านไฟล์ไม่สำเร็จ: ${error}`} />
  if (!rows) return <Status text="กำลังโหลดข้อมูลยอดขาย…" />

  // บนมือถือ: แกนใช้เงินแบบสั้น (฿20K) และแคบลง เพื่อเหลือพื้นที่ให้กราฟ
  const axisMoney = isMobile ? formatBahtShort : (v) => formatBaht(v)
  const axisTick = { fontSize: isMobile ? 11 : 12 }

  return (
    <main className="min-h-screen bg-amber-50 p-4 text-stone-800 sm:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-amber-800 sm:text-4xl">บ้านบรู Dashboard</h1>
        <p className="mt-1 text-sm text-stone-500">
          ข้อมูล {formatThaiDate(daily[0].date)} ถึง {formatThaiDate(daily.at(-1).date)} · {formatNumber(rows.length)} รายการสินค้า
        </p>
      </header>

      {/* มือถือ 2 คอลัมน์ · จอใหญ่ (≥1024px) 4 คอลัมน์ */}
      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <KpiCard label="ยอดขายรวม" value={formatBaht(kpis.totalRevenue)} />
        <KpiCard label="จำนวนบิล" value={formatNumber(kpis.billCount)} />
        <KpiCard label="ยอดเฉลี่ยต่อบิล" value={formatBaht(kpis.avgPerBill, 2)} />
        <KpiCard label="ลูกค้าสมาชิก (ไม่ซ้ำ)" value={formatNumber(kpis.memberCount)} />
      </section>

      <Card title="ยอดขายรายวัน และค่าเฉลี่ย 7 วัน">
        <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
          <LineChart data={daily} margin={{ top: 8, right: isMobile ? 8 : 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e7e5e4" vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatThaiDate} minTickGap={isMobile ? 24 : 40} tick={axisTick} />
            <YAxis tickFormatter={axisMoney} width={isMobile ? 48 : 80} tick={axisTick} />
            <Tooltip
              formatter={(v, key) => [formatBaht(v), SERIES_NAMES[key]]}
              labelFormatter={(d) => `วันที่ ${formatThaiDate(d)}`}
            />
            <Legend formatter={(key) => SERIES_NAMES[key]} wrapperStyle={{ fontSize: isMobile ? 12 : 14 }} />
            {/* เส้นรายวัน: สีอ่อน บาง ไว้เป็นพื้นหลัง */}
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={LIGHT_BROWN}
              strokeWidth={1}
              dot={false}
              activeDot={{ r: 3 }}
            />
            {/* ค่าเฉลี่ย 7 วัน: สีเข้ม หนา วาดทับด้านบน */}
            <Line
              type="monotone"
              dataKey="avg"
              stroke={BROWN}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="ยอดขายแยกสาขา (มาก → น้อย)">
        {isMobile ? (
          // มือถือ: แท่งแนวนอน ชื่อสาขาอยู่ด้านซ้าย จึงเห็นครบทั้ง 5 สาขา (แนวตั้งจะซ่อนชื่อที่ชนกัน)
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={branches} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#e7e5e4" horizontal={false} />
              <XAxis type="number" tickFormatter={formatBahtShort} tick={axisTick} />
              <YAxis type="category" dataKey="branch" width={84} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [formatBaht(v), 'ยอดขาย']} cursor={{ fill: '#fef3c7' }} />
              <Bar dataKey="revenue" fill={BROWN} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={branches} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="#e7e5e4" vertical={false} />
              <XAxis dataKey="branch" tick={{ fontSize: 13 }} />
              <YAxis tickFormatter={axisMoney} width={90} tick={axisTick} />
              <Tooltip formatter={(v) => [formatBaht(v), 'ยอดขาย']} cursor={{ fill: '#fef3c7' }} />
              <Bar dataKey="revenue" fill={BROWN} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </main>
  )
}

function KpiCard({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl bg-white p-3 shadow-sm ring-1 ring-amber-100 sm:p-4">
      <div className="text-xs text-stone-500 sm:text-sm">{label}</div>
      {/* มือถือตัวเล็กลงนิด (text-lg) เพื่อให้ ฿4,466,821 ไม่ล้นการ์ดบนจอแคบ 320px */}
      <div className="mt-1 text-lg font-bold tabular-nums text-amber-900 sm:text-2xl">{value}</div>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <section className="mt-6 rounded-xl bg-white p-3 shadow-sm ring-1 ring-amber-100 sm:p-4">
      <h2 className="mb-3 font-semibold text-stone-700">{title}</h2>
      {children}
    </section>
  )
}

function Status({ text }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-amber-50 text-stone-600">
      {text}
    </main>
  )
}
