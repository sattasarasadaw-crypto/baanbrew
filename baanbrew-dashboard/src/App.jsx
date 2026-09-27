import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  billsByHour,
  billsPerDayByHourByBranch,
  computeKpis,
  dailyRevenue,
  formatBaht,
  formatBahtShort,
  formatHour,
  formatNumber,
  formatThaiDate,
  movingAverage,
  prepareRows,
  revenueByBranch,
} from './lib/metrics.js'

const BROWN = '#92400e' // amber-800
const LIGHT_BROWN = '#fcd34d' // amber-300 — เส้นรายวันแบบจาง
const HOUR_BAR = '#d97706' // amber-600 — แท่งชั่วโมงปกติ
const PEAK_BAR = '#78350f' // amber-900 — แท่งชั่วโมงที่บิลมากที่สุด
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
  const hourly = useMemo(() => rows && billsByHour(rows), [rows])
  const hourlyByBranch = useMemo(
    () => rows && billsPerDayByHourByBranch(rows, branches.map((b) => b.branch)),
    [rows, branches],
  )

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
      <Card title="จำนวนบิลตามชั่วโมงของวัน (ทุกสาขา)">
        <HourBars data={hourly} dataKey="bills" height={isMobile ? 220 : 260} isMobile={isMobile}
          valueLabel="บิล" format={formatNumber} />
      </Card>

      <Card title="บิลเฉลี่ยต่อวันตามชั่วโมง แยกสาขา">
        <p className="-mt-1 mb-3 text-xs text-stone-500">
          หารด้วยจำนวนวันที่แต่ละสาขาเปิดขาย เพื่อเทียบกันได้ยุติธรรม (อารีย์เปิด 1 พ.ย. 68 จึงมีวันขายน้อยกว่าสาขาอื่น)
          · แท่งสีเข้ม = ชั่วโมงที่บิลมากที่สุดของสาขานั้น · ทุกกราฟใช้สเกลแกน Y เดียวกัน
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hourlyByBranch.map((b) => (
            <div key={b.branch} className="min-w-0">
              <h3 className="text-sm font-semibold text-stone-700">{b.branch}</h3>
              <p className="mb-1 text-xs text-stone-500">
                พีค {formatHour(b.peakHour)} · {b.peakPerDay.toFixed(1)} บิล/วัน · เปิดขาย {formatNumber(b.openDays)} วัน
              </p>
              <HourBars data={b.data} dataKey="perDay" height={170} isMobile={isMobile} compact
                yMax={Math.ceil(Math.max(...hourlyByBranch.map((x) => x.peakPerDay)) * 2) / 2}
                valueLabel="บิล/วัน" format={(v) => v.toFixed(2)} />
            </div>
          ))}
        </div>
      </Card>
    </main>
  )
}

// กราฟแท่งตามชั่วโมง: แท่งที่ค่ามากที่สุดใช้สีเข้ม (ใช้ทั้งกราฟรวมและกราฟแยกสาขา)
function HourBars({ data, dataKey, height, isMobile, compact = false, yMax, valueLabel, format }) {
  const max = Math.max(...data.map((d) => d[dataKey]))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#e7e5e4" vertical={false} />
        <XAxis dataKey="hour" tickFormatter={(h) => (compact ? String(h) : formatHour(h))}
          interval={compact || isMobile ? 1 : 0} tick={{ fontSize: compact ? 10 : isMobile ? 11 : 12 }} />
        <YAxis domain={yMax ? [0, yMax] : [0, 'auto']} width={compact ? 28 : 48}
          ticks={yMax ? Array.from({ length: yMax / 0.5 + 1 }, (_, i) => i * 0.5) : undefined}
          tickFormatter={(v) => (compact ? String(v) : formatNumber(v))} tick={{ fontSize: compact ? 10 : 12 }} />
        <Tooltip formatter={(v) => [format(v), valueLabel]} labelFormatter={(h) => `เวลา ${formatHour(h)}–${formatHour(h + 1)}`}
          cursor={{ fill: '#fef3c7' }} />
        <Bar dataKey={dataKey} radius={[3, 3, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.hour} fill={d[dataKey] === max ? PEAK_BAR : HOUR_BAR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
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
