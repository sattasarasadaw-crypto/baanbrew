// แท็บ "ลูกค้าสมาชิก" — ข้อมูลจาก public/customers.csv (customers_clean.csv จาก Colab: ตัด nickname/phone ออกแล้วตาม PDPA)
// แสดงเฉพาะตัวเลขรวม ไม่มีข้อมูลรายบุคคล · ตรรกะคำนวณทั้งหมดอยู่ใน src/lib/metrics.js
import { useMemo } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  countBy, customerKpis, dailyRevenue, formatBaht, formatNumber, formatThaiDate, formatThaiMonth,
  membersByAge, membersByHomeBranch, newMembersByMonth,
} from './lib/metrics.js'

const MAIN = '#92400e' // amber-800 สีหลักสีเดียวเหมือนหน้าอื่น
const LIGHT = '#fcd34d' // amber-300 เดือนที่ข้อมูลไม่ครบ ไม่ต้องการให้เด่น
const GRID = '#e7e5e4'
const pct = (x) => `${(x * 100).toFixed(1)}%`
const avg = (list) => list.reduce((s, d) => s + d.count, 0) / list.length

export default function Customers({ rows, customers, branches }) {
  const dataEnd = useMemo(() => dailyRevenue(rows).at(-1).date, [rows])
  const kpis = useMemo(() => customerKpis(customers, rows), [customers, rows])
  const months = useMemo(() => newMembersByMonth(customers, dataEnd), [customers, dataEnd])
  const ages = useMemo(() => membersByAge(customers), [customers])
  const genders = useMemo(() => countBy(customers, 'gender'), [customers])
  const homes = useMemo(() => membersByHomeBranch(customers, rows, branches), [customers, rows, branches])

  // สมาชิกใหม่: เทียบค่าเฉลี่ย 6 เดือนเต็มแรกกับ 6 เดือนเต็มล่าสุด (ไม่นับเดือนที่ข้อมูลไม่ครบ)
  const fullMonths = months.filter((m) => !m.partial)
  const firstAvg = avg(fullMonths.slice(0, 6))
  const lastAvg = avg(fullMonths.slice(-6))
  const partial = months.find((m) => m.partial)
  const topAge = ages.reduce((a, b) => (b.count > a.count ? b : a))
  const lowestHome = homes.reduce((a, b) => (b.homeShare < a.homeShare ? b : a))

  return (
    <main className="p-4 text-stone-800 sm:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-amber-800 sm:text-4xl">ลูกค้าสมาชิก</h1>
        <p className="mt-1 text-sm text-stone-500">
          สมาชิกที่สมัคร {formatThaiDate(customers.map((c) => c.joinedDate).sort()[0])} ถึง {formatThaiDate(dataEnd)} ·
          แสดงเฉพาะตัวเลขรวม ไม่มีชื่อหรือเบอร์โทรรายบุคคล (ตัดออกตั้งแต่ขั้นทำความสะอาดข้อมูล ตาม PDPA)
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Tile label="สมาชิกทั้งหมด" value={`${formatNumber(kpis.total)} คน`} />
        <Tile label="สมาชิกที่เคยซื้อ" value={pct(kpis.activeShare)} note={`${formatNumber(kpis.activeCount)} คน · อีก ${formatNumber(kpis.total - kpis.activeCount)} คนยังไม่เคยซื้อ`} />
        <Tile label="ยอดขายจากสมาชิก" value={pct(kpis.memberShare)} note="ของยอดขายทั้งหมด" />
        <Tile label="ยอดเฉลี่ยต่อบิล" value={formatBaht(kpis.avgMember, 2)} note={`สมาชิก · ลูกค้าทั่วไป ${formatBaht(kpis.avgWalkin, 2)}`} />
      </section>

      <Card
        title="สมาชิกใหม่รายเดือน"
        question="สมาชิกใหม่เพิ่มขึ้นหรือลดลง"
        summary={<>
          เฉลี่ย 6 เดือนล่าสุด <b>{formatNumber(Math.round(lastAvg))} คน/เดือน</b> เทียบกับ 6 เดือนแรก {formatNumber(Math.round(firstAvg))} คน/เดือน
          ({lastAvg >= firstAvg ? '+' : ''}{pct(lastAvg / firstAvg - 1)})
          {partial && <> · {formatThaiMonth(partial.month)} มีข้อมูลแค่ {partial.days} จาก {partial.full} วัน (แท่งสีอ่อน)</>}
        </>}
      >
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={months} margin={{ top: 18, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tickFormatter={formatThaiMonth} tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis domain={[0, 'auto']} width={40} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v, _n, p) => [`${formatNumber(v)} คน${p.payload.partial ? ` (ข้อมูล ${p.payload.days}/${p.payload.full} วัน)` : ''}`, 'สมาชิกใหม่']}
              labelFormatter={formatThaiMonth}
              cursor={{ fill: '#fef3c7' }}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {months.map((m) => <Cell key={m.month} fill={m.partial ? LIGHT : MAIN} />)}
              <LabelList
                dataKey="count"
                content={({ x, y, width, index }) => months[index].partial ? (
                  <text x={x + width / 2} y={y - 5} textAnchor="middle" fill="#78716c" fontSize={10}>{months[index].days} วัน</text>
                ) : null}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid gap-x-6 lg:grid-cols-2">
        <Card
          title="สมาชิกตามช่วงอายุ"
          question="ลูกค้าสมาชิกเป็นคนกลุ่มไหน"
          summary={<>
            กลุ่มใหญ่สุดคือ <b>{topAge.ageGroup} ปี</b> {formatNumber(topAge.count)} คน ({pct(topAge.count / kpis.total)}) ·
            เพศ {genders.map((g) => `${g.value} ${pct(g.count / kpis.total)}`).join(' · ')}
          </>}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ages} margin={{ top: 18, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="ageGroup" tick={{ fontSize: 11 }} interval={0} />
              <YAxis domain={[0, 'auto']} width={40} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${formatNumber(v)} คน (${pct(v / kpis.total)})`, 'สมาชิก']} cursor={{ fill: '#fef3c7' }} />
              <Bar dataKey="count" fill={MAIN} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="count" position="top" formatter={formatNumber} style={{ fontSize: 11, fill: '#44403c' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card
          title="สมาชิกตามสาขาประจำ"
          question="สมาชิกผูกพันกับสาขาของตัวเองแค่ไหน"
          summary={<>
            สมาชิกซื้อที่สาขาประจำ {pct(Math.min(...homes.map((h) => h.homeShare)))}–{pct(Math.max(...homes.map((h) => h.homeShare)))} ของบิล ·
            ต่ำสุดคือ <b>{lowestHome.branch}</b> ({pct(lowestHome.homeShare)}) สมาชิกกลุ่มนี้ไปซื้อสาขาอื่นบ่อยกว่า
          </>}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={homes} layout="vertical" margin={{ top: 0, right: 120, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="branch" width={84} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v, _n, p) => [`${formatNumber(v)} คน · ซื้อที่สาขาประจำ ${pct(p.payload.homeShare)} ของบิล`, 'สมาชิก']} cursor={{ fill: '#fef3c7' }} />
              <Bar dataKey="members" fill={MAIN} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                <LabelList
                  dataKey="members"
                  content={({ x, y, width, height, index }) => (
                    <text x={x + width + 6} y={y + height / 2 + 4} fill="#44403c" fontSize={11}>
                      {formatNumber(homes[index].members)} คน · ประจำ {pct(homes[index].homeShare)}
                    </text>
                  )}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </main>
  )
}

function Tile({ label, value, note }) {
  return (
    <div className="min-w-0 rounded-xl bg-white p-3 shadow-sm ring-1 ring-amber-100 sm:p-4">
      <div className="text-xs text-stone-500 sm:text-sm">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums text-amber-900 sm:text-2xl">{value}</div>
      {note && <div className="mt-1 text-xs text-stone-500">{note}</div>}
    </div>
  )
}

function Card({ title, question, summary, children }) {
  return (
    <section className="mt-6 min-w-0 rounded-xl bg-white p-3 shadow-sm ring-1 ring-amber-100 sm:p-4">
      <h2 className="font-semibold text-stone-700">{title}</h2>
      <p className="text-xs text-stone-500">คำถาม: {question}</p>
      <p className="mb-3 mt-1 text-sm text-stone-700">{summary}</p>
      {children}
    </section>
  )
}
